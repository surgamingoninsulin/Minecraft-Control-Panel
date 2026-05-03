import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import axios from 'axios';
import yauzl from 'yauzl';
import settingsService from './settingsService.js';
import serverService from './serverService.js';
import minecraftConfigService from './minecraftConfigService.js';

function safeString(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function ensureWithin(basePath, targetPath) {
  const base = path.resolve(basePath);
  const target = path.resolve(targetPath);
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function isDangerousRoot(targetPath) {
  const resolved = path.resolve(targetPath);
  const parsed = path.parse(resolved);
  return resolved === parsed.root;
}

function pickDownloadUrl(item = {}) {
  return safeString(item.directDownloadUrl || item.contentUrl || item.url, '').trim();
}

async function downloadBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 180000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: (status) => status >= 200 && status < 400
  });
  return Buffer.from(response.data);
}

async function downloadFileToPath(url, targetPath) {
  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 180000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: (status) => status >= 200 && status < 400
  });
  await new Promise((resolve, reject) => {
    const writer = fsSync.createWriteStream(targetPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function extractZipSafely(zipPath, destinationRoot, ensureWithinFn) {
  await new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openErr, zipFile) => {
      if (openErr) return reject(openErr);
      if (!zipFile) return reject(new Error('Failed to open zip file.'));

      const onError = (err) => {
        try { zipFile.close(); } catch { }
        reject(err);
      };

      zipFile.readEntry();
      zipFile.on('entry', async (entry) => {
        try {
          const rawName = String(entry.fileName || '').replace(/\\/g, '/');
          const cleanName = rawName.replace(/^\/+/, '');
          if (!cleanName || cleanName.endsWith('/')) {
            if (cleanName) {
              const dirTarget = path.resolve(destinationRoot, cleanName);
              if (!ensureWithinFn(destinationRoot, dirTarget)) {
                return onError(new Error(`Unsafe ZIP entry blocked: ${entry.fileName}`));
              }
              await fs.mkdir(dirTarget, { recursive: true });
            }
            zipFile.readEntry();
            return;
          }

          const fileTarget = path.resolve(destinationRoot, cleanName);
          if (!ensureWithinFn(destinationRoot, fileTarget)) {
            return onError(new Error(`Unsafe ZIP entry blocked: ${entry.fileName}`));
          }

          await fs.mkdir(path.dirname(fileTarget), { recursive: true });

          zipFile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr) return onError(streamErr);
            if (!readStream) return onError(new Error(`Failed to read ZIP entry: ${entry.fileName}`));

            const writeStream = fsSync.createWriteStream(fileTarget);
            readStream.on('error', onError);
            writeStream.on('error', onError);
            writeStream.on('finish', () => zipFile.readEntry());
            readStream.pipe(writeStream);
          });
        } catch (entryErr) {
          onError(entryErr);
        }
      });

      zipFile.on('end', () => resolve());
      zipFile.on('error', onError);
    });
  });
}

class PackInstallService {
  async installPack(packInput, options = {}) {
    const logs = [];
    const log = (line) => logs.push(line);

    const status = serverService.getStatus();
    if (status.status !== 'offline') {
      throw new Error('Server must be offline before pack installation.');
    }

    const settings = await settingsService.get();
    const serverPath = safeString(settings.serverPath, '').trim();
    if (!serverPath) {
      throw new Error('Server path is not configured.');
    }
    const resolvedServerPath = path.resolve(serverPath);
    if (isDangerousRoot(resolvedServerPath)) {
      throw new Error('Refusing to install pack because server path points to a filesystem root.');
    }

    const clearServerRoot = async () => {
      const entries = await fs.readdir(resolvedServerPath, { withFileTypes: true }).catch(async (error) => {
        if (error?.code === 'ENOENT') {
          await fs.mkdir(resolvedServerPath, { recursive: true });
          return [];
        }
        throw error;
      });

      for (const entry of entries) {
        const entryPath = path.resolve(resolvedServerPath, entry.name);
        if (!ensureWithin(resolvedServerPath, entryPath)) {
          throw new Error(`Unsafe server path entry blocked: ${entry.name}`);
        }
        await fs.rm(entryPath, { recursive: true, force: true });
      }
    };

    const pack = {
      name: safeString(packInput?.name, 'Unnamed Pack'),
      serverType: safeString(packInput?.serverType, settings.serverType || 'vanilla').toLowerCase(),
      minecraftVersion: safeString(packInput?.minecraftVersion, settings.serverVersion || ''),
      packUrl: safeString(packInput?.packUrl, ''),
      serverProperties: packInput?.serverProperties && typeof packInput.serverProperties === 'object' ? packInput.serverProperties : {},
      plugins: Array.isArray(packInput?.plugins) ? packInput.plugins : [],
      mods: Array.isArray(packInput?.mods) ? packInput.mods : [],
      datapacks: Array.isArray(packInput?.datapacks) ? packInput.datapacks : [],
      files: Array.isArray(packInput?.files) ? packInput.files : []
    };

    log(`Installing pack: ${pack.name}`);
    await clearServerRoot();
    log('Existing server contents removed.');

    await settingsService.update({
      serverType: pack.serverType || settings.serverType,
      serverVersion: pack.minecraftVersion || settings.serverVersion,
      pluginInstallDir: ['forge', 'fabric', 'neoforge'].includes(pack.serverType) ? 'mods' : 'plugins'
    }, { allowProtectedUpdates: true });

    if (Object.keys(pack.serverProperties).length > 0) {
      const current = await minecraftConfigService.getTextFile('server.properties');
      const merged = minecraftConfigService.mergePropertiesText(current.content || '', pack.serverProperties);
      await minecraftConfigService.saveTextFile('server.properties', merged);
      log('Applied server.properties overrides');
    }

    const ensureDir = async (relative) => {
      const p = path.join(resolvedServerPath, relative);
      await fs.mkdir(p, { recursive: true });
      return p;
    };

    const downloadTo = async (url, targetFile) => {
      await fs.writeFile(targetFile, await downloadBuffer(url));
    };

    if (pack.packUrl) {
      log(`Installing base server ZIP from packUrl: ${pack.packUrl}`);
      const zipFileName = path.basename(new URL(pack.packUrl).pathname || 'server-pack.zip') || 'server-pack.zip';
      const targetZip = path.join(resolvedServerPath, zipFileName.toLowerCase().endsWith('.zip') ? zipFileName : `${zipFileName}.zip`);
      await downloadFileToPath(pack.packUrl, targetZip);
      let zipSizeMb = 0;
      try {
        const st = await fs.stat(targetZip);
        zipSizeMb = Math.round(st.size / (1024 * 1024));
      } catch {
        zipSizeMb = 0;
      }
      log(`Downloaded ZIP (${zipSizeMb} MB). Validating entries...`);

      try {
        log('ZIP entries validating/extracting (streaming)...');
        await extractZipSafely(targetZip, resolvedServerPath, ensureWithin);
        log('ZIP extracted.');
      } catch (error) {
        await fs.unlink(targetZip).catch(() => { });
        throw new Error(`Failed to extract pack ZIP: ${error.message}`);
      }
      await fs.unlink(targetZip).catch(() => { });
      log('Base server ZIP extracted and source ZIP removed.');
    }

    let installedPlugins = 0;
    for (const plugin of pack.plugins) {
      const url = pickDownloadUrl(plugin);
      if (!url) continue;
      const dir = await ensureDir('plugins');
      const name = safeString(plugin.filename || plugin.name, 'plugin').replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = name.toLowerCase().endsWith('.jar') ? name : `${name}.jar`;
      const target = path.join(dir, fileName);
      await downloadTo(url, target);
      installedPlugins += 1;
      log(`Installed plugin: ${fileName}`);
    }

    let installedMods = 0;
    for (const mod of pack.mods) {
      const url = pickDownloadUrl(mod);
      if (!url) continue;
      const dir = await ensureDir('mods');
      const name = safeString(mod.filename || mod.name, 'mod').replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = name.toLowerCase().endsWith('.jar') ? name : `${name}.jar`;
      const target = path.join(dir, fileName);
      await downloadTo(url, target);
      installedMods += 1;
      log(`Installed mod: ${fileName}`);
    }

    let installedDatapacks = 0;
    for (const datapack of pack.datapacks) {
      const url = pickDownloadUrl(datapack);
      if (!url) continue;
      const dir = await ensureDir(path.join('world', 'datapacks'));
      const name = safeString(datapack.filename || datapack.name, 'datapack').replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = name.toLowerCase().endsWith('.zip') ? name : `${name}.zip`;
      const target = path.join(dir, fileName);
      await downloadTo(url, target);
      installedDatapacks += 1;
      log(`Installed datapack: ${fileName}`);
    }

    let installedFiles = 0;
    for (const file of pack.files) {
      const relPath = safeString(file.path, '').replace(/\\/g, '/').trim();
      const url = pickDownloadUrl(file);
      if (!relPath || !url) continue;
      const target = path.resolve(resolvedServerPath, relPath);
      if (!ensureWithin(resolvedServerPath, target)) {
        log(`Skipped unsafe file path: ${relPath}`);
        continue;
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await downloadTo(url, target);
      installedFiles += 1;
      log(`Installed file: ${relPath}`);
    }

    log('Pack installation completed');

    return {
      success: true,
      summary: {
        plugins: installedPlugins,
        mods: installedMods,
        datapacks: installedDatapacks,
        files: installedFiles
      },
      logs
    };
  }
}

export default new PackInstallService();
