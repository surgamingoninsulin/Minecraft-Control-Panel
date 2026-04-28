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

  async resolveGithubFallbackUrl(metadata = {}, originalUrl = '') {
    const sourceUrl = String(metadata.websiteUrl || originalUrl || '').trim();
    const parsedPrimary = this.parseGithubRepo(sourceUrl);

    const wantedVersion = String(metadata.version || metadata.serverVersion || '').trim();
    if (!wantedVersion) return null;

    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'minecraft-panel-installer'
    };
    const ownerHints = Array.from(new Set(
      [
        parsedPrimary?.owner,
        String(metadata.author || '').trim()
      ].filter(Boolean)
    ));
    const repoHints = Array.from(new Set(
      [
        parsedPrimary?.repo,
        String(metadata.name || '').trim().toLowerCase().replace(/\s+/g, '-'),
        String(metadata.name || '').trim().toLowerCase().replace(/\s+/g, ''),
        String(metadata.modId || '').trim().toLowerCase().replace(/-plugin$|-mod$|-data$/g, '')
      ].filter(Boolean)
    ));

    const tryRepo = async (owner, repo) => {
      const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`;
      const candidates = [];
      try {
        const byTag = await axios.get(`${apiBase}/tags/${encodeURIComponent(wantedVersion)}`, { headers });
        candidates.push(byTag.data);
      } catch { /* ignore */ }
      try {
        const byVTag = await axios.get(`${apiBase}/tags/${encodeURIComponent(`v${wantedVersion}`)}`, { headers });
        candidates.push(byVTag.data);
      } catch { /* ignore */ }
      if (!candidates.length) {
        try {
          const list = await axios.get(apiBase, { headers, params: { per_page: 20 } });
          const rows = Array.isArray(list.data) ? list.data : [];
          for (const rel of rows) {
            const tag = String(rel?.tag_name || '').toLowerCase();
            if (tag === wantedVersion.toLowerCase() || tag === `v${wantedVersion}`.toLowerCase() || tag.includes(wantedVersion.toLowerCase())) {
              candidates.push(rel);
            }
          }
        } catch { /* ignore */ }
      }

      const nameHint = String(metadata.name || metadata.modId || '').trim().toLowerCase();
      for (const rel of candidates) {
        const assets = Array.isArray(rel?.assets) ? rel.assets : [];
        const jarAssets = assets.filter((a) => String(a?.name || '').toLowerCase().endsWith('.jar'));
        const exact = jarAssets.find((a) => String(a?.name || '').toLowerCase().includes(wantedVersion.toLowerCase()) && (!nameHint || String(a?.name || '').toLowerCase().includes(nameHint.replace(/\s+/g, '-').toLowerCase())));
        if (exact?.browser_download_url) return exact.browser_download_url;
        const loose = jarAssets.find((a) => String(a?.name || '').toLowerCase().includes(wantedVersion.toLowerCase()));
        if (loose?.browser_download_url) return loose.browser_download_url;
        if (jarAssets[0]?.browser_download_url) return jarAssets[0].browser_download_url;
      }
      return null;
    };

    for (const owner of ownerHints) {
      for (const repo of repoHints) {
        const url = await tryRepo(owner, repo);
        if (url) return url;
      }
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
    const filePath = path.join(modsPath, filename);
    await fs.writeFile(filePath, buffer);

    // Register as manual upload
    const registry = await this.getRegistry();
    registry[filename] = {
      name: filename,
      provider: 'manual',
      uploadedAt: new Date().toISOString()
    };
    await this.saveRegistry(registry);

    return { success: true, name: filename };
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
    const modsPath = await this.getInstallPath();
    const filePath = path.join(modsPath, filename);

    let response;
    try {
      response = await axios({
        url,
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
        fallbackUrl = await this.resolveGithubFallbackUrl(metadata, url);
      } catch {
        fallbackUrl = null;
      }
      if (!fallbackUrl) {
        throw new Error(`Dependency download failed for ${filename}: ${error?.message || 'unknown error'}`);
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
    registry[filename] = {
      ...metadata,
      installedAt: new Date().toISOString(),
      provider: metadata.provider || 'remote'
    };
    await this.saveRegistry(registry);

    // Install dependencies (best-effort).
    const dependencies = await dependencyService.resolveAll({
      metadata,
      downloadUrl: url,
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
