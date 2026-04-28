import fs from 'fs/promises';
import path from 'path';
import settingsService from './settingsService.js';

class FileService {
  createError(message, code) {
    const err = new Error(message);
    err.code = code;
    return err;
  }

  normalizeForCompare(p) {
    const normalized = path.resolve(p);
    if (process.platform === 'win32') {
      return normalized.toLowerCase();
    }
    return normalized;
  }

  isWithinBase(basePath, targetPath) {
    const base = this.normalizeForCompare(basePath);
    const target = this.normalizeForCompare(targetPath);
    const relative = path.relative(base, target);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  // Helper to resolve path and prevent directory traversal
  async resolvePath(relativePath = '') {
    const settings = await settingsService.get();
    const configuredBase = String(settings.serverPath || '').trim();
    if (!configuredBase) {
      throw this.createError('Server path is not configured', 'ESERVERPATH');
    }

    const basePath = path.resolve(configuredBase);
    const resolvedPath = path.resolve(basePath, relativePath);

    if (!this.isWithinBase(basePath, resolvedPath)) {
      throw this.createError('Access denied: Path is outside the configured server folder', 'ESECURITY');
    }

    return resolvedPath;
  }

  async listFiles(directory = '') {
    try {
      const dirPath = await this.resolvePath(directory);
      console.log(`[FileService] Listing: ${dirPath}`);
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      return items.map(item => ({
        name: item.name,
        isDirectory: item.isDirectory(),
        size: item.isDirectory() ? 0 : 0, // Could get valid size if needed
        lastModified: new Date() // Placeholder, could use stat
      }));
    } catch (error) {
      if (error.code === 'ENOENT') return []; // Directory doesn't exist?
      throw error;
    }
  }

  async readFile(filePath) {
    const fullPath = await this.resolvePath(filePath);
    const content = await fs.readFile(fullPath, 'utf8');
    return { content };
  }

  async writeFile(filePath, content) {
    const fullPath = await this.resolvePath(filePath);
    await fs.writeFile(fullPath, content);
    return { success: true };
  }

  async deleteFile(filePath) {
    const fullPath = await this.resolvePath(filePath);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }
    return { success: true };
  }

  async createDirectory(dirPath) {
    const fullPath = await this.resolvePath(dirPath);
    await fs.mkdir(fullPath, { recursive: true });
    return { success: true };
  }

  async uploadFile(filePath, buffer) {
    const fullPath = await this.resolvePath(filePath);
    await fs.writeFile(fullPath, buffer);
    return { success: true };
  }
}

export default new FileService();
