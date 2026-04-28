import fs from 'fs/promises';
import path from 'path';
import settingsService from './settingsService.js';

class MinecraftConfigService {
    constructor() {
        this.allowedJsonFiles = [
            'bans.json',
            'whitelist.json',
            'ops.json',
            'usercache.json'
        ];

        this.allowedTextFiles = [
            'server.properties',
            'eula.txt',
            'permissions.yml',
            'bukkit.yml',
            'spigot.yml',
            'paper-global.yml',
            'paper-world-defaults.yml',
            'velocity.toml'
        ];
    }

    async getConfigPath(filename = 'server.properties') {
        if (!this.allowedJsonFiles.includes(filename) && !this.allowedTextFiles.includes(filename)) {
            throw new Error(`Access to file '${filename}' is not allowed`);
        }
        const settings = await settingsService.get();
        return path.join(settings.serverPath, filename);
    }

    parseProperties(content) {
        const properties = {};
        const lines = String(content || '').split(/\r?\n/);

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
                continue;
            }

            const separatorIdx = line.indexOf('=');
            const altSeparatorIdx = line.indexOf(':');
            const idx = separatorIdx === -1
                ? altSeparatorIdx
                : (altSeparatorIdx === -1 ? separatorIdx : Math.min(separatorIdx, altSeparatorIdx));

            if (idx === -1) continue;

            const key = line.slice(0, idx).trim();
            const value = line.slice(idx + 1).trim();
            if (key) {
                properties[key] = value;
            }
        }

        return properties;
    }

    extractPropertyKey(line) {
        const match = String(line || '').match(/^\s*([^#!\s][^=:]*)\s*[:=]/);
        return match ? match[1].trim() : null;
    }

    toBool(value, fallback = false) {
        if (value === undefined || value === null || value === '') return fallback;
        const normalized = String(value).trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
        return fallback;
    }

    toInt(value, fallback = 0) {
        const n = Number.parseInt(value, 10);
        return Number.isFinite(n) ? n : fallback;
    }

    normalizeDifficulty(value) {
        const allowed = new Set(['peaceful', 'easy', 'normal', 'hard']);
        const normalized = String(value || '').trim().toLowerCase();
        return allowed.has(normalized) ? normalized : 'easy';
    }

    normalizeGamemode(value) {
        const map = new Map([
            ['0', 'survival'],
            ['1', 'creative'],
            ['2', 'adventure'],
            ['3', 'spectator'],
            ['survival', 'survival'],
            ['creative', 'creative'],
            ['adventure', 'adventure'],
            ['spectator', 'spectator']
        ]);
        const normalized = String(value || '').trim().toLowerCase();
        return map.get(normalized) || 'survival';
    }

    serverSettingsFromProperties(properties) {
        return {
            motd: properties['motd'] ?? 'A Minecraft Server',
            maxPlayers: this.toInt(properties['max-players'], 20),
            viewDistance: this.toInt(properties['view-distance'], 10),
            simulationDistance: this.toInt(properties['simulation-distance'], 10),
            onlineMode: this.toBool(properties['online-mode'], true),
            whiteListEnabled: this.toBool(properties['white-list'], false),
            pvp: this.toBool(properties['pvp'], true),
            difficulty: this.normalizeDifficulty(properties['difficulty']),
            gamemode: this.normalizeGamemode(properties['gamemode']),
            levelName: properties['level-name'] || 'world',
            levelSeed: properties['level-seed'] ?? '',
            allowNether: this.toBool(properties['allow-nether'], true),
            enableCommandBlock: this.toBool(properties['enable-command-block'], false),
            spawnProtection: this.toInt(properties['spawn-protection'], 16),
            serverPort: this.toInt(properties['server-port'], 25565)
        };
    }

    serverSettingsToProperties(settings) {
        return {
            'motd': String(settings.motd ?? 'A Minecraft Server'),
            'max-players': String(this.toInt(settings.maxPlayers, 20)),
            'view-distance': String(this.toInt(settings.viewDistance, 10)),
            'simulation-distance': String(this.toInt(settings.simulationDistance, 10)),
            'online-mode': String(Boolean(settings.onlineMode)),
            'white-list': String(Boolean(settings.whiteListEnabled)),
            'pvp': String(Boolean(settings.pvp)),
            'difficulty': this.normalizeDifficulty(settings.difficulty),
            'gamemode': this.normalizeGamemode(settings.gamemode),
            'level-name': String(settings.levelName || 'world'),
            'level-seed': String(settings.levelSeed ?? ''),
            'allow-nether': String(Boolean(settings.allowNether)),
            'enable-command-block': String(Boolean(settings.enableCommandBlock)),
            'spawn-protection': String(this.toInt(settings.spawnProtection, 16)),
            'server-port': String(this.toInt(settings.serverPort, 25565))
        };
    }

    mergePropertiesText(existingText, updates) {
        const lines = String(existingText || '').split(/\r?\n/);
        const remaining = new Set(Object.keys(updates));
        const nextLines = lines.map((line) => {
            const key = this.extractPropertyKey(line);
            if (!key || !remaining.has(key)) return line;
            remaining.delete(key);
            return `${key}=${updates[key]}`;
        });

        if (nextLines.length === 0 || nextLines[nextLines.length - 1].trim() !== '') {
            nextLines.push('');
        }

        for (const key of Object.keys(updates)) {
            if (remaining.has(key)) {
                nextLines.push(`${key}=${updates[key]}`);
            }
        }

        return `${nextLines.join('\n').replace(/\s+$/, '')}\n`;
    }

    async get() {
        const file = await this.getTextFile('server.properties');
        const properties = this.parseProperties(file.content);
        return this.serverSettingsFromProperties(properties);
    }

    async update(newSettings) {
        const file = await this.getTextFile('server.properties');
        const updatedProperties = this.serverSettingsToProperties(newSettings || {});
        const mergedText = this.mergePropertiesText(file.content, updatedProperties);
        await this.saveTextFile('server.properties', mergedText);
        return this.get();
    }

    async getFile(filename) {
        if (!this.allowedJsonFiles.includes(filename)) {
            throw new Error(`File ${filename} is not a JSON settings file`);
        }

        try {
            const configPath = await this.getConfigPath(filename);
            try {
                await fs.access(configPath);
            } catch {
                return [];
            }

            const content = await fs.readFile(configPath, 'utf8');
            if (!content.trim()) {
                return [];
            }
            const parsed = JSON.parse(content);
            return Array.isArray(parsed) ? parsed : parsed || {};
        } catch (error) {
            if (error.code === 'EACCES') {
                console.error(`[ConfigService] Permission denied reading ${filename}.`);
                return [];
            }
            if (error instanceof SyntaxError) {
                throw new Error(`File ${filename} contains invalid JSON.`);
            }
            throw error;
        }
    }

    async saveFile(filename, content) {
        if (!this.allowedJsonFiles.includes(filename)) {
            throw new Error(`File ${filename} is not a JSON settings file`);
        }

        const configPath = await this.getConfigPath(filename);

        await fs.writeFile(configPath, JSON.stringify(content, null, 4));
        return content;
    }

    async getTextFile(filename) {
        if (!this.allowedTextFiles.includes(filename)) {
            throw new Error(`File ${filename} is not an editable text settings file`);
        }

        const configPath = await this.getConfigPath(filename);

        try {
            const content = await fs.readFile(configPath, 'utf8');
            return {
                content,
                exists: true
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    content: '',
                    exists: false
                };
            }
            throw error;
        }
    }

    async saveTextFile(filename, content) {
        if (!this.allowedTextFiles.includes(filename)) {
            throw new Error(`File ${filename} is not an editable text settings file`);
        }

        const configPath = await this.getConfigPath(filename);
        await fs.writeFile(configPath, String(content ?? ''), 'utf8');
        return {
            content: String(content ?? '')
        };
    }

    getAllowedFiles() {
        return {
            json: [...this.allowedJsonFiles],
            text: [...this.allowedTextFiles]
        };
    }
}

export default new MinecraftConfigService();
