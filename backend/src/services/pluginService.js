import fs from 'fs/promises';
import path from 'path';
import settingsService from './settingsService.js';
import axios from 'axios';
import dependencyService from './dependencyService.js';
import { createWriteStream } from 'fs';

const PLUGIN_SERVER_TYPES = new Set(['spigot', 'paper', 'purpur', 'velocity']);
const MODDED_SERVER_TYPES = new Set(['forge', 'neoforge', 'fabric']);

class PluginService {
  constructor() {
    this.registryPath = path.resolve('data/installed_mods.json');
  }

  async getRegistry() {
    try {
      const data = await fs.readFile(this.registryPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {}; // Empty registry if missing
    }
  }

  async saveRegistry(registry) {
    try {
      await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
      await fs.writeFile(this.registryPath, JSON.stringify(registry, null, 2));
    } catch (err) {
      console.error("[PluginService] Failed to save registry:", err);
    }
  }

  parseGithubRepo(url) {
    const raw = String(url || '').trim();
    const match = raw.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (!match) return null;
    return { owner: match[1], repo: match[2].replace(/\.git$/i, '') };
  }

  parseGithubTagFromUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const match = raw.match(/github\.com\/[^/]+\/[^/]+\/releases\/tags?\/([^/?#]+)/i);
    if (!match) return '';
    try {
      return decodeURIComponent(match[1] || '').trim();
    } catch {
      return String(match[1] || '').trim();
    }
  }

  async fetchGithubReleaseAssetUrl(owner, repo, wantedVersion = '', nameHint = '') {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'minecraft-panel-installer'
    };
    const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`;
    const version = String(wantedVersion || '').trim();
    const versionLc = version.toLowerCase();
    const nameHintLc = String(nameHint || '').trim().toLowerCase();

    const pickAsset = (release) => {
      const assets = Array.isArray(release?.assets) ? release.assets : [];
      const jarAssets = assets.filter((a) => String(a?.name || '').toLowerCase().endsWith('.jar'));
      if (jarAssets.length === 0) return null;
      if (versionLc) {
        const exactVersion = jarAssets.find((a) => String(a?.name || '').toLowerCase().includes(versionLc));
        if (exactVersion?.browser_download_url) return exactVersion.browser_download_url;
      }
      if (nameHintLc) {
        const exactName = jarAssets.find((a) => String(a?.name || '').toLowerCase().includes(nameHintLc));
        if (exactName?.browser_download_url) return exactName.browser_download_url;
      }
      return jarAssets[0]?.browser_download_url || null;
    };

    const candidates = [];
    if (version) {
      try {
        const byTag = await axios.get(`${apiBase}/tags/${encodeURIComponent(version)}`, { headers });
        candidates.push(byTag.data);
      } catch { /* ignore */ }
      if (!version.toLowerCase().startsWith('v')) {
        try {
          const byVTag = await axios.get(`${apiBase}/tags/${encodeURIComponent(`v${version}`)}`, { headers });
          candidates.push(byVTag.data);
        } catch { /* ignore */ }
      }
    }

    if (!candidates.length) {
      try {
        const list = await axios.get(apiBase, { headers, params: { per_page: 30 } });
        const rows = Array.isArray(list.data) ? list.data : [];
        if (versionLc) {
          for (const rel of rows) {
            const tag = String(rel?.tag_name || '').toLowerCase();
            if (tag === versionLc || tag === `v${versionLc}` || tag.includes(versionLc)) {
              candidates.push(rel);
            }
          }
        }
        if (!candidates.length && rows.length > 0) {
          candidates.push(rows[0]);
        }
      } catch { /* ignore */ }
    }

    for (const rel of candidates) {
      const resolved = pickAsset(rel);
      if (resolved) return resolved;
    }
    return null;
  }

  async resolveGithubFallbackUrl(metadata = {}, originalUrl = '') {
    const sourceUrl = String(originalUrl || metadata.websiteUrl || '').trim();
    const parsedPrimary = this.parseGithubRepo(sourceUrl);
    if (!parsedPrimary) return null;

    const wantedVersion = String(
      metadata.version
      || this.parseGithubTagFromUrl(originalUrl)
      || this.parseGithubTagFromUrl(metadata.websiteUrl)
      || metadata.serverVersion
      || ''
    ).trim();
    const nameHint = String(metadata.name || metadata.modId || '').trim();

    const direct = await this.fetchGithubReleaseAssetUrl(
      parsedPrimary.owner,
      parsedPrimary.repo,
      wantedVersion,
      nameHint
    );
    if (direct) return direct;

    const fallbackAuthor = String(metadata.author || '').trim();
    if (fallbackAuthor && fallbackAuthor.toLowerCase() !== parsedPrimary.owner.toLowerCase()) {
      const viaAuthor = await this.fetchGithubReleaseAssetUrl(
        fallbackAuthor,
        parsedPrimary.repo,
        wantedVersion,
        nameHint
      );
      if (viaAuthor) return viaAuthor;
    }
    return null;
  }

  async getInstallPath() {
    const settings = await settingsService.get();
    const serverPath = String(settings.serverPath || '').trim();
    const serverType = String(settings.serverType || '').trim().toLowerCase();
    const preferred = MODDED_SERVER_TYPES.has(serverType)
      ? 'mods'
      : (PLUGIN_SERVER_TYPES.has(serverType) ? 'plugins' : (settings.pluginInstallDir || 'plugins'));
    const primaryPath = path.join(serverPath, preferred);
    const fallbackPath = path.join(serverPath, preferred === 'mods' ? 'plugins' : 'mods');

    try {
      await fs.access(primaryPath);
    } catch {
      try {
        await fs.access(fallbackPath);
        return fallbackPath;
      } catch {
        await fs.mkdir(primaryPath, { recursive: true });
      }
    }

    return primaryPath;
  }

  async listPlugins() {
    const modsPath = await this.getInstallPath();
    const registry = await this.getRegistry();
    console.log('[PluginService] Listing plugins from:', modsPath);

    try {
      const files = await fs.readdir(modsPath, { withFileTypes: true });

      const plugins = await Promise.all(files
        .filter(dirent => dirent.isFile() && (dirent.name.toLowerCase().endsWith('.jar') || dirent.name.toLowerCase().endsWith('.zip')))
        .map(async (dirent) => {
          try {
            const stats = await fs.stat(path.join(modsPath, dirent.name));
            const meta = registry[dirent.name] || {};

            return {
              name: dirent.name,
              size: stats.size,
              lastModified: stats.mtime,
              // Metadata fields
              displayName: meta.name || dirent.name,
              logo: meta.logo || null,
              provider: meta.provider || 'manual',
              providerName: meta.providerName || null,
              modId: meta.modId || null,
              description: meta.summary || null,
              websiteUrl: meta.websiteUrl || null
            };
          } catch (err) {
            console.error(`[PluginService] Error stating file ${dirent.name}:`, err);
            return null;
          }
        }));

      const validPlugins = plugins.filter(p => p !== null);
      // console.log('[PluginService] Returning plugins:', validPlugins); // Reduce noise
      return validPlugins;
    } catch (error) {
      console.error('[PluginService] Error listing plugins:', error);
      return [];
    }
  }

  async uploadPlugin(filename, buffer) {
    const modsPath = await this.getInstallPath();
    const resolvedName = path.basename(String(filename || '').trim());
    if (!resolvedName) throw new Error('Invalid plugin filename');
    const filePath = path.join(modsPath, resolvedName);
    await fs.writeFile(filePath, buffer);

    // Register as manual upload
    const registry = await this.getRegistry();
    registry[resolvedName] = {
      name: resolvedName,
      provider: 'manual',
      uploadedAt: new Date().toISOString()
    };
    await this.saveRegistry(registry);

    return { success: true, name: resolvedName };
  }

  async deletePlugin(filename) {
    const modsPath = await this.getInstallPath();
    const filePath = path.join(modsPath, filename);

    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    // Remove from registry
    const registry = await this.getRegistry();
    if (registry[filename]) {
      delete registry[filename];
      await this.saveRegistry(registry);
    }

    return { success: true };
  }

  // Install from a direct URL (used by providers)
  // Metadata: { modId, name, logo, summary, provider }
  async installFromUrl(url, filename, metadata = {}, state = {}) {
    const visited = state.visited instanceof Set ? state.visited : new Set();
    const installKey = `${String(metadata?.modId || filename)}|${String(url)}`.toLowerCase();
    if (visited.has(installKey)) {
      return { success: true, skipped: true };
    }
    visited.add(installKey);
    const resolvedName = path.basename(String(filename || '').trim());
    if (!resolvedName) {
      throw new Error('Dependency download failed: invalid filename');
    }
    const modsPath = await this.getInstallPath();
    const filePath = path.join(modsPath, resolvedName);

    // If the same modId was previously installed under a different filename
    // (for example from older naming logic), remove the stale variant.
    const incomingModId = String(metadata?.modId || '').trim();
    if (incomingModId) {
      const registry = await this.getRegistry();
      const staleNames = Object.keys(registry || {}).filter((entryName) => {
        const meta = registry?.[entryName] || {};
        return String(meta?.modId || '').trim() === incomingModId
          && String(entryName || '').toLowerCase() !== resolvedName.toLowerCase();
      });

      for (const staleName of staleNames) {
        try {
          await fs.unlink(path.join(modsPath, staleName));
        } catch {
          // Best-effort cleanup; continue install.
        }
        delete registry[staleName];
      }

      if (staleNames.length > 0) {
        await this.saveRegistry(registry);
      }
    }

    let effectiveUrl = String(url || '').trim();
    let response;
    try {
      // GitHub release/tag pages are not direct binary links; resolve to a real asset URL first.
      if (/github\.com\/[^/]+\/[^/]+\/releases\/tags?\//i.test(effectiveUrl)) {
        const githubAssetUrl = await this.resolveGithubFallbackUrl(metadata, effectiveUrl);
        if (githubAssetUrl) {
          effectiveUrl = githubAssetUrl;
        }
      }

      response = await axios({
        url: effectiveUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: 60000,
        maxRedirects: 10,
        headers: {
          Accept: '*/*',
          'User-Agent': 'minecraft-panel-installer'
        }
      });
    } catch (error) {
      let fallbackUrl = null;
      try {
        fallbackUrl = await this.resolveGithubFallbackUrl(metadata, effectiveUrl || url);
      } catch {
        fallbackUrl = null;
      }
      if (!fallbackUrl) {
        throw new Error(`Dependency download failed for ${resolvedName}: ${error?.message || 'unknown error'}`);
      }
      response = await axios({
        url: fallbackUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: 60000,
        maxRedirects: 10,
        headers: {
          Accept: '*/*',
          'User-Agent': 'minecraft-panel-installer'
        }
      });
    }

    const writer = createWriteStream(filePath);
    response.data.pipe(writer);

    try {
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      await fs.unlink(filePath).catch(() => { });
      throw error;
    }

    // Save metadata
    const registry = await this.getRegistry();
    registry[resolvedName] = {
      ...metadata,
      installedAt: new Date().toISOString(),
      provider: metadata.provider || 'remote'
    };
    await this.saveRegistry(registry);

    // Install dependencies (best-effort).
    const dependencies = await dependencyService.resolveAll({
      metadata,
      downloadUrl: effectiveUrl || url,
      context: {
        providerName: metadata.providerName || '',
        serverType: metadata.serverType || '',
        serverVersion: metadata.serverVersion || '',
        resourceType: metadata.resourceType || 'plugin'
      }
    });

    for (const dep of dependencies) {
      try {
        await this.installFromUrl(dep.url, dep.filename, {
          ...dep.metadata,
          resourceType: metadata.resourceType || 'plugin',
          serverType: metadata.serverType || '',
          serverVersion: metadata.serverVersion || '',
          dependencies: []
        }, { visited });
      } catch {
        // Continue installing other dependencies or main item even when one dependency fails.
      }
    }

    return { success: true };
  }
}

export default new PluginService();
