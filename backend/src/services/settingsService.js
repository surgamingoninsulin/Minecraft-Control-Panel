import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const SERVER_ICON_SOURCE = path.resolve(__dirname, '../../../frontend/public/static/images/server-icon.png');
const DEFAULT_GITHUB_GIST_URL = 'https://gist.github.com/surgamingoninsulin/2b4d90991a5a5a025f69cce2282f67b7';
const RESTART_BAT_CONTENT = `@echo off
setlocal EnableExtensions

REM Always run from this script's folder
cd /d "%~dp0"

REM Find the newest Purpur jar in this folder
set "SERVER_JAR="
for /f "delims=" %%F in ('dir /b /a:-d /o:-d "purpur-*.jar" 2^>nul') do (
  set "SERVER_JAR=%%F"
  goto :found
)

:found
if not defined SERVER_JAR (
  echo [restart.bat] ERROR: Could not find purpur-*.jar in %cd%
  timeout /t 10 /nobreak >nul
  exit /b 1
)

echo [restart.bat] Starting %SERVER_JAR%

REM Adjust RAM values if needed
java -Xms2G -Xmx6G -jar "%SERVER_JAR%" nogui

REM If Java exits immediately, wait a moment to avoid tight crash loops
set "EXIT_CODE=%errorlevel%"
echo [restart.bat] Java exited with code %EXIT_CODE%
timeout /t 5 /nobreak >nul
exit /b %EXIT_CODE%
`;

function safeString(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function normalizeMemoryGb(value, fallback = '1') {
  const raw = safeString(value, '').trim();
  const digits = raw.replace(/\D+/g, '');
  if (digits) return digits;
  const fallbackDigits = safeString(fallback, '1').replace(/\D+/g, '');
  return fallbackDigits || '1';
}

function toBoolean(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function resolveRuntimeInstallDir(serverType, currentValue = '') {
  const normalized = safeString(serverType, 'vanilla').toLowerCase();
  if (['forge', 'neoforge', 'fabric'].includes(normalized)) return 'mods';
  if (['spigot', 'paper', 'purpur', 'velocity'].includes(normalized)) return 'plugins';
  const fallback = safeString(currentValue, '').trim().toLowerCase();
  return fallback === 'mods' ? 'mods' : 'plugins';
}

function normalizeCustomProviderId(input, fallbackIndex = 0) {
  const base = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (base) return base;
  return `custom-provider-${fallbackIndex + 1}`;
}

function normalizeGithubGistUrl(value) {
  const raw = safeString(value, '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'gist.github.com') {
      return '';
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length !== 2) return '';

    const username = parts[0].trim();
    const gistId = parts[1].trim();

    if (!username || !/^[A-Za-z0-9-]+$/.test(username)) return '';
    if (!/^[A-Fa-f0-9]{8,}$/.test(gistId)) return '';

    return `https://gist.github.com/${username}/${gistId}`;
  } catch {
    return '';
  }
}

function normalizeCustomProviders(list) {
  if (!Array.isArray(list)) return [];

  const seen = new Set();
  const normalized = [];

  list.forEach((provider, index) => {
    if (!provider || typeof provider !== 'object') return;

    const name = safeString(provider.name, '').trim();
    const gistUrl = normalizeGithubGistUrl(provider.gistUrl);
    const type = safeString(provider.type, 'github').trim().toLowerCase() || 'github';

    if (!name || !gistUrl) return;

    let id = normalizeCustomProviderId(provider.id || name, index);
    while (seen.has(id)) {
      id = `${id}-${index + 1}`;
    }
    seen.add(id);

    normalized.push({
      id,
      name,
      type,
      gistUrl,
      enabled: toBoolean(provider.enabled, true)
    });
  });

  return normalized;
}

function mergeModProviderSettings(defaults, incoming) {
  const merged = {
    ...defaults,
    ...(incoming || {}),
    curseforge: {
      ...(defaults.curseforge || {}),
      ...((incoming || {}).curseforge || {})
    },
    modrinth: {
      ...(defaults.modrinth || {}),
      ...((incoming || {}).modrinth || {})
    },
    hangar: {
      ...(defaults.hangar || {}),
      ...((incoming || {}).hangar || {})
    },
    github: {
      ...(defaults.github || {}),
      ...((incoming || {}).github || {})
    }
  };

  merged.communityProviders = normalizeCustomProviders(
    (incoming || {}).communityProviders
    ?? (incoming || {}).customProviders
    ?? defaults.communityProviders
    ?? defaults.customProviders
  );
  return merged;
}

function normalizeModProviderSettings(defaults, incoming) {
  const merged = mergeModProviderSettings(defaults, incoming);
  return {
    ...merged,
    github: {
      ...(merged.github || {}),
      // Built-in Github provider URL is intentionally immutable.
      gistUrl: DEFAULT_GITHUB_GIST_URL
    },
    communityProviders: normalizeCustomProviders(merged.communityProviders ?? merged.customProviders),
    customProviders: normalizeCustomProviders(merged.communityProviders ?? merged.customProviders)
  };
}

function lockExistingCommunityProviderGistUrls(currentModProviders, incomingModProviders) {
  const currentCommunity = normalizeCustomProviders(
    (currentModProviders || {}).communityProviders ?? (currentModProviders || {}).customProviders
  );
  const incomingCommunity = normalizeCustomProviders(
    (incomingModProviders || {}).communityProviders ?? (incomingModProviders || {}).customProviders
  );

  if (!incomingCommunity.length) {
    return {
      ...(incomingModProviders || {}),
      communityProviders: [],
      customProviders: []
    };
  }

  const existingById = new Map(
    currentCommunity
      .filter((entry) => entry?.id)
      .map((entry) => [String(entry.id).toLowerCase(), entry])
  );
  const existingByName = new Map(
    currentCommunity
      .filter((entry) => entry?.name)
      .map((entry) => [String(entry.name).toLowerCase(), entry])
  );

  const lockedCommunity = incomingCommunity.map((entry) => {
    const idKey = String(entry?.id || '').toLowerCase();
    const nameKey = String(entry?.name || '').toLowerCase();
    const existing = (idKey && existingById.get(idKey)) || (nameKey && existingByName.get(nameKey)) || null;
    if (!existing) return entry;
    return {
      ...entry,
      gistUrl: existing.gistUrl
    };
  });

  return {
    ...(incomingModProviders || {}),
    communityProviders: lockedCommunity,
    customProviders: lockedCommunity
  };
}

class SettingsService {
  constructor() {
    this.settings = null;
    this.defaultSettings = {
      os: process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'macos' : 'linux'),
      serverPath: '',
      javaPath: 'java',
      jarFile: 'server.jar',
      assetsFile: '',
      startCommand: 'java -Xmx2G -Xms1G -jar server.jar nogui',
      maxMemory: '2',
      minMemory: '1',
      port: 5520,
      aotEnabled: false,
      pluginInstallDir: 'plugins',
      serverName: 'Minecraft Server',
      serverType: 'vanilla',
      serverVersion: '',
      modProviders: {
        curseforge: {
          apiKey: ''
        },
        modrinth: {
          enabled: true,
          apiToken: ''
        },
        hangar: {
          apiKey: ''
        },
        github: {
          enabled: true,
          gistUrl: DEFAULT_GITHUB_GIST_URL
        }
      },
      communityProviders: []
    };
    this.defaultSettings.modProviders.communityProviders = this.defaultSettings.communityProviders;
    this.defaultSettings.modProviders.customProviders = this.defaultSettings.communityProviders;
    delete this.defaultSettings.communityProviders;
  }

  normalizeSettings(data = {}) {
    const merged = { ...this.defaultSettings, ...(data || {}) };
    if (!merged.modProviders) {
      merged.modProviders = { ...this.defaultSettings.modProviders };
    }

    if (Array.isArray(merged.customProviders) && !Array.isArray(merged.modProviders.communityProviders)) {
      merged.modProviders.communityProviders = merged.customProviders;
    }
    if (Array.isArray(merged.communityProviders) && !Array.isArray(merged.modProviders.communityProviders)) {
      merged.modProviders.communityProviders = merged.communityProviders;
    }
    if (Array.isArray(merged.modProviders.customProviders) && !Array.isArray(merged.modProviders.communityProviders)) {
      merged.modProviders.communityProviders = merged.modProviders.customProviders;
    }

    delete merged.customProviders;
    delete merged.communityProviders;

    merged.modProviders = normalizeModProviderSettings(this.defaultSettings.modProviders, merged.modProviders);

    merged.serverType = safeString(merged.serverType, 'vanilla').toLowerCase();
    merged.serverPath = safeString(merged.serverPath, '').trim();
    merged.serverVersion = safeString(merged.serverVersion, '').trim();
    merged.serverName = safeString(merged.serverName, 'Minecraft Server').trim() || 'Minecraft Server';
    merged.jarFile = safeString(merged.jarFile, 'server.jar').trim() || 'server.jar';
    merged.pluginInstallDir = resolveRuntimeInstallDir(merged.serverType, merged.pluginInstallDir);
    merged.minMemory = normalizeMemoryGb(merged.minMemory, this.defaultSettings.minMemory);
    merged.maxMemory = normalizeMemoryGb(merged.maxMemory, this.defaultSettings.maxMemory);

    return merged;
  }

  buildStartCommand(settings) {
    const javaCmd = safeString(settings.javaPath, 'java').trim() || 'java';
    const minMemory = `${normalizeMemoryGb(settings.minMemory, '1')}G`;
    const maxMemory = `${normalizeMemoryGb(settings.maxMemory, '2')}G`;
    const jarFile = safeString(settings.jarFile, 'server.jar').trim() || 'server.jar';

    return `${javaCmd} -Xms${minMemory} -Xmx${maxMemory} -jar ${jarFile} nogui`;
  }

  async detectSystem() {
    const platform = process.platform;
    let detectedPath = '';
    let defaultPath = '';

    const possiblePaths = [];
    if (platform === 'win32') {
      defaultPath = path.join(os.homedir(), 'minecraft_server');

      const appData = process.env.APPDATA;
      possiblePaths.push(defaultPath);
      if (appData) {
        possiblePaths.push(path.join(appData, 'Minecraft/install/release/package/game/latest/Server'));
      }
      possiblePaths.push('C:\\Minecraft\\Server');
      possiblePaths.push('C:\\Program Files\\Minecraft\\Server');
      possiblePaths.push('D:\\Minecraft\\Server');
    } else if (platform === 'linux') {
      defaultPath = path.join(os.homedir(), 'minecraft_server');

      const xdgData = process.env.XDG_DATA_HOME || path.join(process.env.HOME || '', '.local/share');
      possiblePaths.push(defaultPath);
      possiblePaths.push(path.join(xdgData, 'Minecraft/install/release/package/game/latest/Server'));
      possiblePaths.push('/opt/minecraft/server');
      possiblePaths.push('/minecraft/server');
    } else if (platform === 'darwin') {
      defaultPath = path.join(os.homedir(), 'minecraft_server');
      possiblePaths.push(defaultPath);
      possiblePaths.push(path.join(process.env.HOME || '', 'Library/Application Support/Minecraft/install/release/package/game/latest/Server'));
    }

    for (const p of possiblePaths) {
      try {
        await fs.access(p);
        const stats = await fs.stat(p);

        if (stats.isDirectory()) {
          try {
            await fs.access(path.join(p, 'server.jar'));
            detectedPath = p;
            break;
          } catch {
            // keep scanning
          }
        }
      } catch {
        // keep scanning
      }
    }

    const javaInfo = await this.checkJava();

    return {
      os: platform === 'win32' ? 'windows' : (platform === 'darwin' ? 'macos' : 'linux'),
      detectedPath,
      defaultPath,
      javaVersion: javaInfo.version,
      javaPath: javaInfo.path
    };
  }

  async checkJava() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const parseOutput = (out) => {
        const lines = out.split(/\r?\n/);
        const versionLine = lines.find((line) => {
          const l = line.toLowerCase();
          return l.includes('version') || l.includes('java') || l.includes('openjdk') || l.includes('jdk');
        });
        return versionLine ? versionLine.trim() : null;
      };

      const validateJavaBinary = async (javaPath) => {
        try {
          const { stdout, stderr } = await execAsync(`"${javaPath}" -version`);
          const output = (stdout + stderr).trim();
          const version = parseOutput(output);
          if (version) return { version, path: javaPath };
        } catch {
          // ignore invalid candidate
        }
        return null;
      };

      try {
        let detectedPath = 'java';
        if (process.platform === 'win32') {
          try {
            const { stdout } = await execAsync('where java');
            const firstPath = stdout.split(/\r?\n/).find((line) => line.trim());
            if (firstPath) detectedPath = firstPath.trim();
          } catch {
            // ignore
          }
        } else {
          try {
            const { stdout } = await execAsync('which java');
            if (stdout.trim()) detectedPath = stdout.trim();
          } catch {
            // ignore
          }
        }

        const directCheck = await validateJavaBinary(detectedPath);
        if (directCheck) return directCheck;
      } catch {
        // ignore
      }

      if (process.platform === 'win32') {
        const windowsCandidates = [];

        if (process.env.JAVA_HOME) {
          windowsCandidates.push(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'));
        }

        const rootsToScan = [
          'C:\\Program Files\\Java',
          'C:\\Program Files (x86)\\Java',
          'C:\\Program Files\\Eclipse Adoptium',
          'C:\\Program Files\\Microsoft',
          'C:\\Program Files\\Zulu',
          'C:\\Program Files\\Amazon Corretto',
          'C:\\Program Files\\BellSoft'
        ];

        for (const root of rootsToScan) {
          try {
            const entries = await fs.readdir(root, { withFileTypes: true });
            for (const entry of entries) {
              if (!entry.isDirectory()) continue;
              const name = entry.name.toLowerCase();
              if (
                name.includes('jdk') ||
                name.includes('jre') ||
                name.includes('java') ||
                name.includes('adoptium') ||
                name.includes('corretto') ||
                name.includes('zulu') ||
                name.includes('temurin') ||
                name.includes('liberica')
              ) {
                windowsCandidates.push(path.join(root, entry.name, 'bin', 'java.exe'));
              }
            }
          } catch {
            // ignore missing directories
          }
        }

        for (const candidate of windowsCandidates) {
          const check = await validateJavaBinary(candidate);
          if (check) {
            return check;
          }
        }

        return { version: 'Not Found', path: '' };
      }

      const commonPaths = [
        '/usr/bin/java',
        '/usr/local/bin/java',
        '/bin/java',
        '/opt/java/bin/java',
        '/opt/jdk-21/bin/java'
      ];

      try {
        const jvmDir = '/usr/lib/jvm';
        const entries = await fs.readdir(jvmDir).catch(() => []);
        for (const entry of entries) {
          commonPaths.push(path.join(jvmDir, entry, 'bin/java'));
        }
      } catch {
        // ignore
      }

      try {
        const optDir = '/opt';
        const entries = await fs.readdir(optDir).catch(() => []);
        for (const entry of entries) {
          if (entry.toLowerCase().includes('jdk') || entry.toLowerCase().includes('java')) {
            commonPaths.push(path.join(optDir, entry, 'bin/java'));
          }
        }
      } catch {
        // ignore
      }

      for (const javaPath of commonPaths) {
        const check = await validateJavaBinary(javaPath);
        if (check) {
          return check;
        }
      }

      return { version: 'Not Found', path: '' };
    } catch {
      return { version: 'Not Found', path: '' };
    }
  }

  async ensureDataDir() {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
  }

  async load() {
    try {
      await this.ensureDataDir();
      const data = await fs.readFile(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      this.settings = this.normalizeSettings(parsed);

      if (!this.settings.startCommand || this.settings.startCommand.includes('undefined')) {
        this.settings.startCommand = this.buildStartCommand(this.settings);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.settings = this.normalizeSettings(this.defaultSettings);
        this.settings.startCommand = this.buildStartCommand(this.settings);
        await this.save(this.settings);
      } else {
        throw error;
      }
    }

    return this.settings;
  }

  async save(newSettings) {
    await this.ensureDataDir();

    const settingsToSave = this.normalizeSettings(newSettings);

    if (newSettings.aotEnabled === false) {
      settingsToSave.aotCacheFile = null;
    }

    settingsToSave.startCommand = this.buildStartCommand(settingsToSave);

    this.settings = settingsToSave;
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
    await this.ensureServerIconInRoot(this.settings.serverPath);
    await this.ensureRestartScriptInRoot(this.settings.serverPath);

    return this.settings;
  }

  async ensureServerIconInRoot(serverPath) {
    const targetRoot = safeString(serverPath, '').trim();
    if (!targetRoot) return;
    const targetIconPath = path.join(targetRoot, 'server-icon.png');
    try {
      await fs.mkdir(targetRoot, { recursive: true });
      await fs.copyFile(SERVER_ICON_SOURCE, targetIconPath);
    } catch {
      // Never block settings persistence if icon copy fails.
    }
  }

  async ensureRestartScriptInRoot(serverPath) {
    const targetRoot = safeString(serverPath, '').trim();
    if (!targetRoot) return;
    const restartScriptPath = path.join(targetRoot, 'restart.bat');
    try {
      await fs.mkdir(targetRoot, { recursive: true });
      await fs.writeFile(restartScriptPath, RESTART_BAT_CONTENT, 'utf8');
    } catch {
      // Never block settings persistence if restart script write fails.
    }
  }

  async get() {
    return this.load();
  }

  async update(updates, options = {}) {
    const current = await this.load();
    const allowProtectedUpdates = Boolean(options?.allowProtectedUpdates);
    const protectedKeys = ['serverPath', 'serverType', 'serverVersion', 'jarFile', 'pluginInstallDir'];
    const safeUpdates = { ...(updates || {}) };

    if (!allowProtectedUpdates) {
      for (const key of protectedKeys) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          safeUpdates[key] = current[key];
        }
      }
    }

    const hasIncomingModProviders = Object.prototype.hasOwnProperty.call(safeUpdates, 'modProviders');
    const incomingModProviders = hasIncomingModProviders
      ? lockExistingCommunityProviderGistUrls(current.modProviders || {}, safeUpdates.modProviders || {})
      : undefined;

    const merged = {
      ...current,
      ...safeUpdates,
      modProviders: normalizeModProviderSettings(current.modProviders || {}, incomingModProviders)
    };

    return this.save(merged);
  }

  async listServerJars(serverPathOverride = null) {
    const settings = await this.get();
    const serverPath = (serverPathOverride || settings.serverPath || '').trim();

    if (!serverPath) {
      return [];
    }

    try {
      const entries = await fs.readdir(serverPath, { withFileTypes: true });
      const jars = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jar'))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

      return jars;
    } catch {
      return [];
    }
  }
}

export default new SettingsService();
