import axios from 'axios';
import path from 'path';

function normalizeDependencies(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const id = String(entry.id || entry.modId || '').trim();
      if (!id) return null;
      return {
        id,
        provider: String(entry.provider || entry.providerName || '').trim() || null,
        fileId: String(entry.fileId || '').trim() || null,
        name: String(entry.name || '').trim() || null,
        author: String(entry.author || '').trim() || null,
        minecraftVersion: String(entry.minecraftVersion || entry.minecraftversion || '').trim() || null,
        version: String(entry.version || '').trim() || null,
        image: String(entry.image || entry.logo || '').trim() || null,
        directDownloadUrl: String(entry.directDownloadUrl || entry.downloadUrl || entry.url || '').trim() || null,
        description: String(entry.description || entry.summary || '').trim() || null,
        websiteUrl: String(entry.websiteUrl || entry.projectUrl || entry.repoUrl || '').trim() || null,
        latestFileName: String(entry.latestFileName || '').trim() || null
      };
    })
    .filter(Boolean);
}

function interpolateTemplate(value, variables = {}) {
  let out = String(value || '');
  if (!out) return '';
  out = out.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (m, k) => {
    const v = variables[k];
    return v === undefined || v === null || v === '' ? m : String(v);
  });
  out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, k) => {
    const v = variables[k];
    return v === undefined || v === null || v === '' ? m : String(v);
  });
  out = out.replace(/%\{([a-zA-Z0-9_]+)\}/g, (m, k) => {
    const v = variables[k];
    return v === undefined || v === null || v === '' ? m : String(v);
  });
  return out;
}

function inferModrinthFromUrl(downloadUrl) {
  const raw = String(downloadUrl || '').trim();
  const match = raw.match(/cdn\.modrinth\.com\/data\/([^/]+)\/versions\/([^/]+)\//i);
  if (!match) return null;
  return { projectId: match[1], versionId: match[2] };
}

function isGithubLikeUrl(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return false;
  return raw.includes('github.com/')
    || raw.includes('githubusercontent.com/')
    || raw.includes('objects.githubusercontent.com/');
}

function detectProviderFromUrl(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('curseforge.com/minecraft/mc-mods/')) return 'CurseForge';
  if (raw.includes('api.smithed.dev/v2/')) return 'Smithed';
  if (raw.includes('spigotmc.org/resources/')) return 'Spigot';
  if (raw.includes('hangarcdn.papermc.io/plugins/')) return 'Hangar';
  if (raw.includes('cdn.modrinth.com/data/')) return 'Modrinth';
  if (isGithubLikeUrl(raw)) return 'Github Plugins';
  return '';
}

function chooseVersionFile(versionPayload, resourceType = 'plugin') {
  const files = Array.isArray(versionPayload?.files) ? versionPayload.files : [];
  if (!files.length) return null;
  const wantZip = String(resourceType || '').toLowerCase() === 'datapack';
  return files.find((f) => (f?.filename || '').toLowerCase().endsWith(wantZip ? '.zip' : '.jar'))
    || files.find((f) => (f?.filename || '').toLowerCase().endsWith('.zip'))
    || files.find((f) => (f?.filename || '').toLowerCase().endsWith('.jar'))
    || files[0];
}

function safeFileName(name, fallback) {
  const base = String(name || '').replace(/[^a-z0-9._-]/gi, '_').trim();
  return base || fallback;
}

function extractFileNameFromUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const pathname = String(parsed.pathname || '').trim();
    if (!pathname) return '';
    return decodeURIComponent(pathname.split('/').pop() || '').trim();
  } catch {
    const clean = raw.split('?')[0].split('#')[0];
    return decodeURIComponent(clean.split('/').pop() || '').trim();
  }
}

class DependencyService {
  async lookupDependenciesFromCatalog(context = {}, targetId = '') {
    const providerName = String(context.providerName || '').trim() || detectProviderFromUrl(context.downloadUrl || context.websiteUrl || '');
    const itemId = String(targetId || '').trim();
    if (!providerName || !itemId) return [];
    try {
      const modProviderService = (await import('./modProviderService.js')).default;
      const search = await modProviderService.search(providerName, itemId, {
        serverType: context.serverType,
        serverVersion: context.serverVersion,
        resourceType: context.resourceType,
        page: 1,
        pageSize: 50
      });
      const rows = Array.isArray(search?.items) ? search.items : [];
      const exact = rows.find((r) => String(r?.id || '').trim() === itemId);
      const fallback = rows.find((r) => String(r?.id || '').toLowerCase().includes(itemId.toLowerCase())) || rows[0];
      const chosen = exact || fallback;
      if (!chosen || !Array.isArray(chosen.dependencies)) return [];
      return normalizeDependencies(chosen.dependencies);
    } catch {
      return [];
    }
  }

  async resolveFromProviderList(dependencies, context = {}) {
    const modProviderService = (await import('./modProviderService.js')).default;
    const providerName = String(context.providerName || '').trim();
    const detectedProvider = detectProviderFromUrl(context.downloadUrl || context.websiteUrl || '');
    const out = [];

    for (const dep of dependencies) {
      const provider = dep.provider || providerName || detectedProvider;
      try {
        // If full dependency entry includes direct URL, install it directly.
        if (dep.directDownloadUrl) {
          const url = interpolateTemplate(dep.directDownloadUrl, {
            id: dep.id,
            name: dep.name || dep.id,
            version: dep.version || '',
            minecraftVersion: dep.minecraftVersion || ''
          });
          if (url) {
            const fallbackExt = String(context.resourceType || '').toLowerCase() === 'datapack' ? '.zip' : '.jar';
            const inferredFromUrl = extractFileNameFromUrl(url);
            out.push({
              id: dep.id,
              url,
              filename: safeFileName(dep.latestFileName || inferredFromUrl || `${dep.name || dep.id}${fallbackExt}`, `dependency${fallbackExt}`),
              metadata: {
                modId: dep.id,
                name: dep.name || dep.id,
                author: dep.author || null,
                logo: dep.image || null,
                summary: dep.description || null,
                websiteUrl: dep.websiteUrl || null,
                version: dep.version || null,
                minecraftVersion: dep.minecraftVersion || null,
                provider: String(provider || 'remote').toLowerCase(),
                providerName: provider || null
              }
            });
            continue;
          }
        }

        if (!provider) continue;
        // First try direct resolution by dependency ID.
        let directUrl = null;
        try {
          directUrl = await modProviderService.getDownloadUrl(
            provider,
            dep.id,
            dep.fileId || null,
            {
              serverType: context.serverType,
              serverVersion: context.serverVersion,
              resourceType: context.resourceType
            }
          );
        } catch {
          directUrl = null;
        }

        // If direct ID resolution worked, do not depend on search ranking/availability.
        if (directUrl) {
          const fallbackExt = String(context.resourceType || '').toLowerCase() === 'datapack' ? '.zip' : '.jar';
          const inferredFromUrl = extractFileNameFromUrl(directUrl);
          out.push({
            id: dep.id,
            url: directUrl,
            filename: safeFileName(dep.latestFileName || inferredFromUrl || `${dep.id}${fallbackExt}`, `dependency${fallbackExt}`),
            metadata: {
              modId: dep.id,
              name: dep.id,
              version: dep.version || null,
              minecraftVersion: dep.minecraftVersion || null,
              provider: String(provider).toLowerCase(),
              providerName: provider
            }
          });
          continue;
        }

        const search = await modProviderService.search(provider, dep.id, {
          serverType: context.serverType,
          serverVersion: context.serverVersion,
          resourceType: context.resourceType,
          page: 1,
          pageSize: 20
        });
        const rows = Array.isArray(search?.items) ? search.items : [];
        const item = rows.find((r) => String(r?.id || '').trim() === dep.id)
          || rows.find((r) => String(r?.id || '').toLowerCase().includes(dep.id.toLowerCase()))
          || rows[0];
        if (!item) continue;

        const url = directUrl || item.downloadUrl || await modProviderService.getDownloadUrl(
          provider,
          item.id,
          dep.fileId || item.latestFileId,
          {
            serverType: context.serverType,
            serverVersion: context.serverVersion,
            resourceType: context.resourceType
          }
        );

        if (!url) continue;
        const fallbackExt = String(context.resourceType || '').toLowerCase() === 'datapack' ? '.zip' : '.jar';
        const inferredFromUrl = extractFileNameFromUrl(url);
        const filename = safeFileName(item.latestFileName || dep.latestFileName || inferredFromUrl || `${item.name || item.id}${fallbackExt}`, `dependency${fallbackExt}`);

        out.push({
          id: item.id,
          url,
          filename,
          metadata: {
            modId: item.id,
            name: item.name || item.id,
            author: item.author || null,
            logo: item.logo || null,
            summary: item.summary || null,
            websiteUrl: item.websiteUrl || null,
            version: dep.version || item?.metadata?.version || null,
            minecraftVersion: dep.minecraftVersion || item?.metadata?.minecraftVersion || null,
            provider: String(item.provider || provider || 'remote').toLowerCase(),
            providerName: item.providerName || provider
          }
        });
      } catch {
        // Best-effort dependency resolution; skip failing dependency.
      }
    }
    return out;
  }

  async resolveFromModrinthUrl(downloadUrl, context = {}) {
    const ref = inferModrinthFromUrl(downloadUrl);
    if (!ref) return [];
    try {
      const version = await axios.get(`https://api.modrinth.com/v2/version/${encodeURIComponent(ref.versionId)}`);
      const dependencies = Array.isArray(version.data?.dependencies) ? version.data.dependencies : [];
      const required = dependencies.filter((dep) => String(dep?.dependency_type || '').toLowerCase() === 'required' && dep?.project_id);
      if (!required.length) return [];

      const loader = String(context.serverType || '').trim().toLowerCase();
      const gameVersion = String(context.serverVersion || '').trim();
      const resourceType = String(context.resourceType || '').trim().toLowerCase();
      const wantZip = resourceType === 'datapack';
      const resolved = [];

      for (const dep of required) {
        try {
          const params = {};
          if (loader) params.loaders = JSON.stringify([loader]);
          if (gameVersion) params.game_versions = JSON.stringify([gameVersion]);
          const versions = await axios.get(`https://api.modrinth.com/v2/project/${encodeURIComponent(dep.project_id)}/version`, { params });
          const rows = Array.isArray(versions.data) ? versions.data : [];
          const chosen = rows[0];
          const file = chooseVersionFile(chosen, resourceType);
          if (!chosen || !file?.url) continue;
          resolved.push({
            id: String(dep.project_id),
            url: file.url,
            filename: safeFileName(file.filename || extractFileNameFromUrl(file.url), wantZip ? 'dependency.zip' : 'dependency.jar'),
            metadata: {
              modId: String(dep.project_id),
              name: String(chosen?.name || dep.project_id),
              provider: 'modrinth',
              providerName: 'Modrinth'
            }
          });
        } catch {
          // skip single dependency
        }
      }

      return resolved;
    } catch {
      return [];
    }
  }

  async resolveAll({ metadata = {}, downloadUrl = '', context = {} } = {}) {
    const normalizedContext = {
      ...context,
      downloadUrl: String(downloadUrl || context.downloadUrl || '').trim(),
      websiteUrl: String(metadata.websiteUrl || context.websiteUrl || '').trim()
    };
    const explicit = normalizeDependencies(metadata.dependencies);

    const catalogFallback = explicit.length === 0
      ? await this.lookupDependenciesFromCatalog(normalizedContext, String(metadata.modId || ''))
      : [];

    const effective = explicit.length > 0 ? explicit : catalogFallback;
    const explicitResolved = await this.resolveFromProviderList(effective, normalizedContext);

    const shouldInferFromSource = effective.length === 0 && !isGithubLikeUrl(normalizedContext.downloadUrl);
    const inferred = shouldInferFromSource
      ? await this.resolveFromModrinthUrl(normalizedContext.downloadUrl, normalizedContext)
      : [];

    const all = [...explicitResolved, ...inferred];
    const unique = [];
    const seen = new Set();
    for (const dep of all) {
      const key = `${String(dep?.id || '')}|${String(dep?.url || '')}`.toLowerCase();
      if (!dep?.url || seen.has(key)) continue;
      seen.add(key);
      unique.push(dep);
    }
    return unique;
  }
}

export default new DependencyService();
