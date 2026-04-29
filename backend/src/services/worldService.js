import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import axios from 'axios';
import settingsService from './settingsService.js';
import dependencyService from './dependencyService.js';

function sanitizeFileName(name, fallback = 'datapack.zip') {
  const safeBase = String(name || '').replace(/[^a-z0-9._-]/gi, '_').trim();
  const safe = safeBase || fallback;
  if (/\.zip$/i.test(safe)) return safe;
  if (/\.jar$/i.test(safe)) return safe.replace(/\.jar$/i, '.zip');
  return `${safe}.zip`;
}

class WorldService {
  constructor() {
    this.registryPath = path.resolve('data/installed_datapacks.json');
    this.primaryWorldName = 'world';
  }

  stripLegacyUniverseSegments(inputPath) {
    let resolved = path.resolve(String(inputPath || '').trim());
    const normalized = resolved.replace(/\\/g, '/').toLowerCase();
    let universeIdx = normalized.indexOf('/universe/worlds');
    if (universeIdx < 0) {
      universeIdx = normalized.indexOf('/universe/');
      if (universeIdx < 0 && normalized.endsWith('/universe')) {
        universeIdx = normalized.lastIndexOf('/universe');
      }
    }
    if (universeIdx >= 0) {
      resolved = resolved.slice(0, universeIdx);
    }
    return resolved;
  }

  async getRegistry() {
    try {
      const data = await fs.readFile(this.registryPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async saveRegistry(registry) {
    await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
    await fs.writeFile(this.registryPath, JSON.stringify(registry, null, 2), 'utf8');
  }

  async getServerPath() {
    const settings = await settingsService.get();
    const configured = String(settings.serverPath || '').trim();
    if (!configured) throw new Error('Server path is not configured');

    const resolved = this.stripLegacyUniverseSegments(configured);

    const candidates = [resolved];
    let probe = resolved;
    for (let i = 0; i < 6; i += 1) {
      const parent = path.dirname(probe);
      if (!parent || parent === probe) break;
      candidates.push(parent);
      probe = parent;
    }

    const existsDir = async (dirName, root) => {
      try {
        const stat = await fs.stat(path.join(root, dirName));
        return stat.isDirectory();
      } catch {
        return false;
      }
    };

    const existsFile = async (fileName, root) => {
      try {
        const stat = await fs.stat(path.join(root, fileName));
        return stat.isFile();
      } catch {
        return false;
      }
    };

    for (const candidate of candidates) {
      if (await existsDir('plugins', candidate)) {
        return candidate;
      }
    }

    for (const candidate of candidates) {
      if (await existsFile('server.properties', candidate)) {
        return candidate;
      }
    }

    return resolved;
  }

  async ensurePrimaryWorldDirs() {
    const serverPath = this.stripLegacyUniverseSegments(await this.getServerPath());
    const worldName = this.primaryWorldName;
    const worldPath = path.join(serverPath, worldName);
    const datapacksDir = path.join(worldPath, 'datapacks');

    await fs.mkdir(worldPath, { recursive: true });
    await fs.mkdir(datapacksDir, { recursive: true });

    return { serverPath, worldName, worldPath, datapacksDir };
  }

  async getWorldsRoot() {
    return this.getServerPath();
  }

  async getWorldPath(_worldName) {
    const { worldPath } = await this.ensurePrimaryWorldDirs();
    return worldPath;
  }

  async readWorldConfig(worldPath) {
    const configPath = path.join(worldPath, 'config.json');
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  }

  inferWorldType(name) {
    const lowered = String(name || '').toLowerCase();
    if (lowered === 'world') return 'overworld';
    if (lowered.includes('nether')) return 'nether';
    if (lowered.includes('the_end') || lowered.includes('end')) return 'the_end';
    return 'overworld';
  }

  async listWorlds() {
    const { worldName, worldPath } = await this.ensurePrimaryWorldDirs();

    let config = null;
    try {
      config = await this.readWorldConfig(worldPath);
    } catch {
      config = null;
    }

    return [{
      name: worldName,
      displayName: worldName,
      worldType: this.inferWorldType(worldName),
      version: null,
      pvp: null,
      config: config || {}
    }];
  }

  async getWorld(_name) {
    const { worldName, worldPath, datapacksDir } = await this.ensurePrimaryWorldDirs();

    let config = null;
    try {
      config = await this.readWorldConfig(worldPath);
    } catch {
      config = null;
    }

    let datapacks = [];
    let worldFiles = [];
    const registry = await this.getRegistry();
    const worldRegistry = registry?.[worldName] || {};

    try {
      const entries = await fs.readdir(datapacksDir, { withFileTypes: true });
      datapacks = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(datapacksDir, entry.name);
        const stat = await fs.stat(fullPath);
        return {
          id: String(worldRegistry[entry.name]?.modId || entry.name),
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size: stat.size,
          lastModified: stat.mtime,
          displayName: String(worldRegistry[entry.name]?.name || entry.name),
          logo: worldRegistry[entry.name]?.logo || null,
          summary: worldRegistry[entry.name]?.summary || null,
          author: worldRegistry[entry.name]?.author || null,
          provider: worldRegistry[entry.name]?.provider || 'manual',
          providerName: worldRegistry[entry.name]?.providerName || null,
          websiteUrl: worldRegistry[entry.name]?.websiteUrl || null,
          modId: worldRegistry[entry.name]?.modId || null
        };
      }));
    } catch {
      datapacks = [];
    }

    try {
      const entries = await fs.readdir(worldPath, { withFileTypes: true });
      worldFiles = await Promise.all(entries.slice(0, 50).map(async (entry) => {
        const fullPath = path.join(worldPath, entry.name);
        const stat = await fs.stat(fullPath);
        return {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size: stat.size,
          lastModified: stat.mtime
        };
      }));
    } catch {
      worldFiles = [];
    }

    return {
      name: worldName,
      worldPath,
      datapacksDir,
      config: config || {},
      datapacks,
      files: worldFiles
    };
  }

  async updateWorldConfig(_name, config) {
    const { worldPath } = await this.ensurePrimaryWorldDirs();
    const configPath = path.join(worldPath, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    return { success: true };
  }

  async installDatapackFromUrl(_name, url, filename, metadata = {}, state = {}) {
    const visited = state.visited instanceof Set ? state.visited : new Set();
    if (!url || !filename) throw new Error('URL and filename are required');
    const downloadUrl = String(url || '').trim();
    if (!/^https?:\/\//i.test(downloadUrl)) {
      throw new Error('Datapack download URL must be an absolute http(s) URL.');
    }

    const { worldName, datapacksDir } = await this.ensurePrimaryWorldDirs();

    const safeName = sanitizeFileName(filename, `${metadata.name || 'datapack'}.zip`);
    const outPath = path.join(datapacksDir, safeName);
    const installKey = `${String(metadata?.modId || safeName)}|${String(downloadUrl)}`.toLowerCase();
    if (visited.has(installKey)) {
      return { success: true, filename: safeName, skipped: true };
    }
    visited.add(installKey);
    const normalizedOutPath = outPath.replace(/\\/g, '/').toLowerCase();
    if (normalizedOutPath.includes('/universe/worlds/') || normalizedOutPath.includes('/universe/')) {
      throw new Error('Blocked invalid install target. Datapacks must install to <server_root>/world/datapacks only.');
    }
    let response;
    try {
      response = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: 60000,
        maxRedirects: 10,
        headers: {
          Accept: '*/*',
          'User-Agent': 'minecraft-panel-datapack-installer'
        }
      });
    } catch (error) {
      const status = error?.response?.status;
      const statusText = error?.response?.statusText;
      const reason = status
        ? `Download failed (${status}${statusText ? ` ${statusText}` : ''})`
        : `Download failed (${error.message})`;
      throw new Error(`${reason} for URL: ${downloadUrl}`);
    }

    const writer = createWriteStream(outPath);
    response.data.pipe(writer);

    try {
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      await fs.unlink(outPath).catch(() => { });
      throw error;
    }

    const registry = await this.getRegistry();
    if (!registry[worldName]) registry[worldName] = {};
    registry[worldName][safeName] = {
      ...metadata,
      installedAt: new Date().toISOString(),
      provider: metadata.provider || 'remote'
    };
    await this.saveRegistry(registry);

    const dependencies = await dependencyService.resolveAll({
      metadata,
      downloadUrl,
      context: {
        providerName: metadata.providerName || '',
        serverType: metadata.serverType || '',
        serverVersion: metadata.serverVersion || '',
        resourceType: 'datapack'
      }
    });

    for (const dep of dependencies) {
      try {
        await this.installDatapackFromUrl(
          worldName,
          dep.url,
          dep.filename,
          {
            ...dep.metadata,
            resourceType: 'datapack',
            serverType: metadata.serverType || '',
            serverVersion: metadata.serverVersion || '',
            dependencies: []
          },
          { visited }
        );
      } catch {
        // Continue with other dependencies.
      }
    }

    return { success: true, filename: safeName };
  }

  async uploadDatapack(_name, filename, buffer, metadata = {}) {
    if (!filename || !buffer) throw new Error('Datapack file is required');
    const { worldName, datapacksDir } = await this.ensurePrimaryWorldDirs();
    const safeName = sanitizeFileName(filename, `${metadata.name || 'datapack'}.zip`);
    const outPath = path.join(datapacksDir, safeName);
    const normalizedOutPath = outPath.replace(/\\/g, '/').toLowerCase();
    if (normalizedOutPath.includes('/universe/worlds/') || normalizedOutPath.includes('/universe/')) {
      throw new Error('Blocked invalid install target. Datapacks must install to <server_root>/world/datapacks only.');
    }

    await fs.writeFile(outPath, buffer);

    const registry = await this.getRegistry();
    if (!registry[worldName]) registry[worldName] = {};
    registry[worldName][safeName] = {
      ...metadata,
      name: metadata.name || safeName,
      installedAt: new Date().toISOString(),
      provider: metadata.provider || 'manual'
    };
    await this.saveRegistry(registry);

    return { success: true, filename: safeName };
  }

  async uninstallDatapack(_name, datapackName) {
    const requestedName = path.basename(String(datapackName || '').trim());
    if (!requestedName || requestedName === '.' || requestedName === '..') throw new Error('Datapack name is required');

    const { worldName, datapacksDir } = await this.ensurePrimaryWorldDirs();
    const outPath = path.join(datapacksDir, requestedName);
    const resolvedBase = path.resolve(datapacksDir);
    const resolvedTarget = path.resolve(outPath);
    const normalizedTarget = resolvedTarget.replace(/\\/g, '/').toLowerCase();

    if (normalizedTarget.includes('/universe/worlds/') || normalizedTarget.includes('/universe/')) {
      throw new Error('Blocked invalid uninstall target. Datapacks must uninstall from <server_root>/world/datapacks only.');
    }

    if (!resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
      throw new Error('Blocked invalid uninstall target path.');
    }

    let stat;
    try {
      stat = await fs.stat(resolvedTarget);
    } catch {
      throw new Error(`Datapack not found: ${requestedName}`);
    }

    if (stat.isDirectory()) {
      await fs.rm(resolvedTarget, { recursive: true, force: true });
    } else {
      await fs.unlink(resolvedTarget);
    }

    const registry = await this.getRegistry();
    if (registry?.[worldName]?.[requestedName]) {
      delete registry[worldName][requestedName];
      if (Object.keys(registry[worldName]).length === 0) {
        delete registry[worldName];
      }
      await this.saveRegistry(registry);
    }

    return { success: true, name: requestedName };
  }
}

export default new WorldService();

