import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import settingsService from './settingsService.js';
import minecraftConfigService from './minecraftConfigService.js';

class ServerExportService {
  async getServerPath() {
    const settings = await settingsService.get();
    const serverPath = String(settings.serverPath || '').trim();
    if (!serverPath) {
      throw new Error('Server path is not configured.');
    }
    return { settings, serverPath };
  }

  async exportJsonPack() {
    const { settings, serverPath } = await this.getServerPath();
    const propsFile = await minecraftConfigService.getTextFile('server.properties');
    const props = minecraftConfigService.parseProperties(propsFile.content || '');

    const listDir = async (dirName, filterFn = () => true) => {
      try {
        const full = path.join(serverPath, dirName);
        const entries = await fs.readdir(full, { withFileTypes: true });
        return entries.filter(filterFn).map((e) => e.name);
      } catch {
        return [];
      }
    };

    const plugins = await listDir('plugins', (e) => e.isFile() && e.name.toLowerCase().endsWith('.jar'));
    const mods = await listDir('mods', (e) => e.isFile() && e.name.toLowerCase().endsWith('.jar'));
    const datapacks = await listDir(path.join('world', 'datapacks'));

    return {
      schemaVersion: 1,
      providerType: 'exported_pack',
      packs: [
        {
          id: 'exported-pack',
          name: settings.serverName || 'Exported Server Pack',
          description: 'Generated from current server state',
          author: 'local-export',
          minecraftVersion: settings.serverVersion || '',
          serverType: settings.serverType || 'vanilla',
          serverProperties: props,
          plugins: plugins.map((name) => ({ name })),
          mods: mods.map((name) => ({ name })),
          datapacks: datapacks.map((name) => ({ name })),
          files: []
        }
      ]
    };
  }

  normalizeRelative(relPath = '') {
    return String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  }

  ensureWithin(basePath, targetPath) {
    const base = path.resolve(basePath);
    const target = path.resolve(targetPath);
    const rel = path.relative(base, target);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  }

  async buildZipArchive(includePaths = []) {
    const { serverPath } = await this.getServerPath();
    const zip = new AdmZip();

    const excluded = new Set(['logs', 'cache', 'crash-reports', '.git']);

    const addRecursive = async (base, rel = '') => {
      const current = path.join(base, rel);
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const entryRel = rel ? path.join(rel, entry.name) : entry.name;
        if (excluded.has(entry.name.toLowerCase())) continue;
        const full = path.join(base, entryRel);
        if (entry.isDirectory()) {
          await addRecursive(base, entryRel);
        } else {
          const data = await fs.readFile(full);
          zip.addFile(entryRel.replace(/\\/g, '/'), data);
        }
      }
    };

    const normalizedIncludePaths = Array.isArray(includePaths)
      ? includePaths.map((p) => this.normalizeRelative(p)).filter(Boolean)
      : [];

    if (normalizedIncludePaths.length === 0) {
      await addRecursive(serverPath);
    } else {
      for (const rel of normalizedIncludePaths) {
        const fullPath = path.resolve(serverPath, rel);
        if (!this.ensureWithin(serverPath, fullPath)) continue;
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isDirectory()) {
            await addRecursive(serverPath, rel);
          } else {
            const data = await fs.readFile(fullPath);
            zip.addFile(rel.replace(/\\/g, '/'), data);
          }
        } catch {
          // Ignore missing/invalid selections.
        }
      }
    }

    const fileName = 'server-exported.zip';
    return { zip, fileName };
  }
}

export default new ServerExportService();
