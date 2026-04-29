#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import urllib.request
import zipfile

USER_AGENT = 'MinecraftPanelDownloader/1.0'
MCJARS_BASE = "https://mcjars.app/api/v1/builds"


def emit_progress(percent, message):
    percent = max(0, min(100, int(percent)))
    print(f"PROGRESS:{percent}:{message}", flush=True)


def read_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def read_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def pick_latest_build_number(builds):
    if isinstance(builds, list) and builds:
        nums = [b for b in builds if isinstance(b, int)]
        if nums:
            return max(nums)
    return None


def split_version_tokens(version_text):
    parts = re.split(r'([0-9]+)', str(version_text))
    result = []
    for part in parts:
        if not part:
            continue
        if part.isdigit():
            result.append((0, int(part)))
        else:
            result.append((1, part.lower()))
    return tuple(result)


def resolve_mcjars_version(type_name, versions, requested):
    if not versions:
        raise RuntimeError(f"No versions available for {type_name}")

    if requested:
        req = requested.strip().lower()
        exact = [k for k in versions.keys() if k.lower() == req]
        if exact:
            selected = exact[0]
            return selected, versions[selected]

        prefixed = [k for k in versions.keys() if k.lower().startswith(req)]
        if prefixed:
            prefixed.sort(key=split_version_tokens)
            selected = prefixed[-1]
            return selected, versions[selected]

        raise RuntimeError(f"{type_name} version '{requested}' was not found")

    supported = [(k, v) for k, v in versions.items() if isinstance(v, dict) and v.get("supported")]
    pool = supported if supported else list(versions.items())
    pool.sort(key=lambda item: split_version_tokens(item[0]))
    return pool[-1][0], pool[-1][1]


def get_mcjars_url(type_name, version):
    payload = read_json(f"{MCJARS_BASE}/{type_name}")
    versions = payload.get("versions", {})
    selected, entry = resolve_mcjars_version(type_name, versions, version)
    latest = entry.get("latest") or {}

    jar_url = latest.get("jarUrl")
    if jar_url:
        return jar_url, selected

    installation = latest.get("installation") or []
    for stage in installation:
        for action in stage:
            if isinstance(action, dict) and action.get("type") == "download" and action.get("url"):
                return action["url"], selected

    raise RuntimeError(f"No downloadable jar URL found for {type_name} {selected}")


def get_vanilla_url(version):
    manifest = read_json("https://launchermeta.mojang.com/mc/game/version_manifest.json")
    selected = version
    if not selected:
        selected = manifest.get("latest", {}).get("release")
    versions = manifest.get("versions", [])
    meta = next((v for v in versions if v.get("id") == selected), None)
    if not meta:
        raise RuntimeError(f"Vanilla version '{selected}' was not found")
    version_meta = read_json(meta["url"])
    server_dl = version_meta.get("downloads", {}).get("server", {})
    url = server_dl.get("url")
    if not url:
        raise RuntimeError(f"Vanilla version '{selected}' does not provide a server download")
    return url, selected


def get_papermc_url(project, version):
    base = f"https://api.papermc.io/v2/projects/{project}"
    project_meta = read_json(base)
    versions = project_meta.get("versions", [])
    selected = version or (versions[-1] if versions else None)
    if not selected:
        raise RuntimeError(f"No versions available for {project}")

    builds_meta = read_json(f"{base}/versions/{selected}")
    build = pick_latest_build_number(builds_meta.get("builds", []))
    if build is None:
        raise RuntimeError(f"No builds available for {project} {selected}")

    build_meta = read_json(f"{base}/versions/{selected}/builds/{build}")
    downloads = build_meta.get("downloads", {})
    file_name = None

    if isinstance(downloads, dict):
        if "application" in downloads and isinstance(downloads["application"], dict):
            file_name = downloads["application"].get("name")
        if not file_name:
            for value in downloads.values():
                if isinstance(value, dict) and value.get("name"):
                    file_name = value["name"]
                    break

    if not file_name:
        # Fallback common naming
        file_name = f"{project}-{selected}-{build}.jar"

    url = f"{base}/versions/{selected}/builds/{build}/downloads/{file_name}"
    return url, selected


def get_purpur_url(version):
    selected = version
    if not selected:
        versions = read_json("https://api.purpurmc.org/v2/purpur").get("versions", [])
        selected = versions[-1] if versions else None
    if not selected:
        raise RuntimeError("No Purpur versions available")

    meta = read_json(f"https://api.purpurmc.org/v2/purpur/{selected}")
    build = (meta.get("builds") or {}).get("latest")
    if not build:
        all_builds = (meta.get("builds") or {}).get("all", [])
        if all_builds:
            build = all_builds[-1]
    if not build:
        raise RuntimeError(f"No Purpur builds available for {selected}")

    url = f"https://api.purpurmc.org/v2/purpur/{selected}/{build}/download"
    return url, selected


def get_fabric_url(version):
    selected = version
    if not selected:
        game_versions = read_json("https://meta.fabricmc.net/v2/versions/game")
        stable = [v for v in game_versions if v.get("stable")]
        selected = stable[0].get("version") if stable else (game_versions[0].get("version") if game_versions else None)

    if not selected:
        raise RuntimeError("No Fabric Minecraft versions available")

    loader_versions = read_json("https://meta.fabricmc.net/v2/versions/loader")
    stable_loaders = [v for v in loader_versions if v.get("stable")]
    loader = stable_loaders[0].get("version") if stable_loaders else (loader_versions[0].get("version") if loader_versions else None)

    installer_versions = read_json("https://meta.fabricmc.net/v2/versions/installer")
    stable_installers = [v for v in installer_versions if v.get("stable")]
    installer = stable_installers[0].get("version") if stable_installers else (installer_versions[0].get("version") if installer_versions else None)

    if not loader or not installer:
        raise RuntimeError("Unable to resolve Fabric loader/installer versions")

    url = f"https://meta.fabricmc.net/v2/versions/loader/{selected}/{loader}/{installer}/server/jar"
    return url, selected


def get_forge_url(version):
    # Use MCJars forge server runtime artifact, never installer jars.
    return get_mcjars_url("forge", version)


def get_neoforge_url(version):
    # Use MCJars neoforge server runtime artifact, never installer jars.
    return get_mcjars_url("neoforge", version)


def get_spigot_url(version):
    return get_mcjars_url("spigot", version)


def resolve_download(server_type, version):
    st = (server_type or "vanilla").strip().lower()

    if st == "vanilla":
        return get_vanilla_url(version)
    if st == "paper":
        return get_mcjars_url("paper", version)
    if st == "velocity":
        return get_mcjars_url("velocity", version)
    if st == "purpur":
        return get_mcjars_url("purpur", version)
    if st == "fabric":
        return get_fabric_url(version)
    if st == "forge":
        return get_forge_url(version)
    if st == "neoforge":
        return get_neoforge_url(version)
    if st == "spigot":
        return get_spigot_url(version)

    raise RuntimeError(f"Unsupported server type: {server_type}")


def download_file(url, output_path):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        length_header = resp.headers.get("Content-Length")
        total = int(length_header) if length_header and length_header.isdigit() else 0

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, "wb") as f:
            downloaded = 0
            while True:
                chunk = resp.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)

                if total > 0:
                    pct = 10 + int((downloaded / total) * 85)
                else:
                    pct = min(95, 10 + int(downloaded / (1024 * 1024)))
                emit_progress(pct, "Downloading server files")


def maybe_unwrap_embedded_server_jar(output_path, target_dir):
    # Some provider artifacts ship a .zip (or a zip-like blob) that contains
    # the runnable server jar. If we saved that blob directly as .jar, Java
    # reports "Invalid or corrupt jarfile". In that case, extract inner jar.
    if not output_path.lower().endswith(".jar"):
        return
    if not zipfile.is_zipfile(output_path):
        return

    with zipfile.ZipFile(output_path, "r") as zf:
        names = zf.namelist()
        if "META-INF/MANIFEST.MF" in names:
            # Already a runnable jar archive (or at least a normal jar layout).
            return

        inner_jars = [n for n in names if n.lower().endswith(".jar") and not n.endswith("/")]
        if not inner_jars:
            return

        # Extract all files first so bundled libraries/config are available.
        # Forge server bundles often rely on adjacent /libraries content.
        for name in names:
            if name.endswith("/"):
                continue
            normalized = os.path.normpath(name).replace("\\", "/")
            if normalized.startswith("../") or normalized.startswith("..\\") or os.path.isabs(normalized):
                continue
            dest_path = os.path.join(target_dir, normalized)
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with zf.open(name) as src, open(dest_path, "wb") as dst:
                dst.write(src.read())

        preferred = next((n for n in inner_jars if os.path.basename(n).lower() == "server.jar"), inner_jars[0])
        data = zf.read(preferred)

    with open(output_path, "wb") as f:
        f.write(data)


def main():
    parser = argparse.ArgumentParser(description="Minecraft panel server downloader")
    parser.add_argument("--target-path", required=True)
    parser.add_argument("--server-type", default="vanilla")
    parser.add_argument("--server-version", default="")
    parser.add_argument("--jar-file", default="server.jar")
    parser.add_argument("--server-name", default="Minecraft Server")

    args = parser.parse_args()

    target = os.path.abspath(args.target_path)
    jar_file = args.jar_file.strip() if args.jar_file else "server.jar"
    jar_file = re.sub(r"[^a-zA-Z0-9._-]", "_", jar_file)
    if not jar_file.lower().endswith(".jar"):
        jar_file += ".jar"

    os.makedirs(target, exist_ok=True)

    emit_progress(2, "Resolving server download")
    url, resolved_version = resolve_download(args.server_type, args.server_version.strip())

    emit_progress(8, f"Resolved {args.server_type} {resolved_version}")
    output_path = os.path.join(target, jar_file)
    download_file(url, output_path)
    maybe_unwrap_embedded_server_jar(output_path, target)

    emit_progress(100, "Download complete")
    print(f"DONE:{output_path}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR:{exc}", file=sys.stderr, flush=True)
        sys.exit(1)
