import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import settingsService from './settingsService.js';

class PlayerService {
    normalizePlayerName(name) {
        return String(name || '').trim();
    }

    toOfflineUuid(name) {
        const normalized = this.normalizePlayerName(name);
        const input = `OfflinePlayer:${normalized}`;
        const bytes = createHash('md5').update(input, 'utf8').digest();
        bytes[6] = (bytes[6] & 0x0f) | 0x30;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = bytes.toString('hex');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    async getServerPath() {
        const settings = await settingsService.get();
        const serverPath = String(settings.serverPath || '').trim();
        if (!serverPath) throw new Error('Server path not configured');
        return serverPath;
    }

    async getWhitelistFile() {
        const serverPath = await this.getServerPath();
        return path.join(serverPath, 'whitelist.json');
    }

    async getOpsFile() {
        const serverPath = await this.getServerPath();
        return path.join(serverPath, 'ops.json');
    }

    async getUsercacheFile() {
        const serverPath = await this.getServerPath();
        return path.join(serverPath, 'usercache.json');
    }

    async readJsonArray(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    async writeJsonArray(filePath, data) {
        await fs.writeFile(filePath, JSON.stringify(Array.isArray(data) ? data : [], null, 2), 'utf8');
    }

    async readWhitelist() {
        const file = await this.getWhitelistFile();
        return this.readJsonArray(file);
    }

    async saveWhitelist(entries) {
        const file = await this.getWhitelistFile();
        await this.writeJsonArray(file, entries);
    }

    async readOps() {
        const file = await this.getOpsFile();
        return this.readJsonArray(file);
    }

    async saveOps(entries) {
        const file = await this.getOpsFile();
        await this.writeJsonArray(file, entries);
    }

    async readUsercache() {
        const file = await this.getUsercacheFile();
        return this.readJsonArray(file);
    }

    buildPlayer(player) {
        const uuid = String(player?.uuid || '').trim();
        const name = String(player?.name || `Player ${uuid.slice(0, 8)}`).trim();
        return {
            uuid,
            name,
            gameMode: String(player?.gameMode || 'Unknown'),
            isOp: Boolean(player?.isOp),
            isWhitelisted: Boolean(player?.isWhitelisted),
            health: Number(player?.health || 0),
            lastSeen: player?.lastSeen || null
        };
    }

    async listPlayers() {
        try {
            const whitelist = await this.readWhitelist();
            const ops = await this.readOps();
            const usercache = await this.readUsercache();

            const playersByUuid = new Map();

            for (const entry of usercache) {
                if (!entry || typeof entry !== 'object') continue;
                const uuid = String(entry.uuid || '').trim();
                const name = String(entry.name || '').trim();
                if (!uuid || !name) continue;

                playersByUuid.set(uuid.toLowerCase(), this.buildPlayer({
                    uuid,
                    name,
                    gameMode: 'Unknown',
                    health: 0,
                    isOp: false,
                    isWhitelisted: false,
                    lastSeen: entry.expiresOn || null
                }));
            }

            for (const entry of whitelist) {
                if (!entry || typeof entry !== 'object') continue;
                const uuid = String(entry.uuid || '').trim();
                const name = String(entry.name || '').trim();
                if (!uuid) continue;

                const key = uuid.toLowerCase();
                const existing = playersByUuid.get(key);
                playersByUuid.set(key, this.buildPlayer({
                    ...existing,
                    uuid,
                    name: name || existing?.name || `Player ${uuid.slice(0, 8)}`,
                    isWhitelisted: true
                }));
            }

            for (const entry of ops) {
                if (!entry || typeof entry !== 'object') continue;
                const uuid = String(entry.uuid || '').trim();
                const name = String(entry.name || '').trim();
                if (!uuid) continue;

                const key = uuid.toLowerCase();
                const existing = playersByUuid.get(key);
                playersByUuid.set(key, this.buildPlayer({
                    ...existing,
                    uuid,
                    name: name || existing?.name || `Player ${uuid.slice(0, 8)}`,
                    isOp: true
                }));
            }

            return Array.from(playersByUuid.values()).sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('[PlayerService] Error listing players:', error.message);
            return [];
        }
    }

    async getPlayer(uuid) {
        const list = await this.listPlayers();
        const found = list.find((player) => String(player.uuid).toLowerCase() === String(uuid).toLowerCase());

        if (found) return found;

        return this.buildPlayer({
            uuid,
            name: `Player ${String(uuid).slice(0, 8)}`,
            isOp: await this.isOp(uuid),
            isWhitelisted: await this.isWhitelisted(uuid)
        });
    }

    async updatePlayer(uuid, updates) {
        const nextName = updates?.name || null;

        if (updates?.isOp !== undefined) {
            await this.setOp(uuid, Boolean(updates.isOp), nextName);
        }

        if (updates?.isWhitelisted !== undefined) {
            await this.setWhitelist(uuid, Boolean(updates.isWhitelisted), nextName);
        }

        return this.getPlayer(uuid);
    }

    async isOp(uuid) {
        const ops = await this.readOps();
        const key = String(uuid || '').toLowerCase();
        return ops.some((entry) => String(entry?.uuid || '').toLowerCase() === key);
    }

    async setOp(uuid, isOp, name = null) {
        const ops = await this.readOps();
        const key = String(uuid || '').toLowerCase();
        const idx = ops.findIndex((entry) => String(entry?.uuid || '').toLowerCase() === key);

        if (isOp) {
            if (idx === -1) {
                ops.push({
                    uuid,
                    name: this.normalizePlayerName(name) || `Player ${String(uuid).slice(0, 8)}`,
                    level: 4,
                    bypassesPlayerLimit: false
                });
            } else if (name && !ops[idx].name) {
                ops[idx].name = this.normalizePlayerName(name);
            }
        } else if (idx !== -1) {
            ops.splice(idx, 1);
        }

        await this.saveOps(ops);
    }

    async isWhitelisted(uuid) {
        const whitelist = await this.readWhitelist();
        return whitelist.some((entry) => String(entry?.uuid || '').toLowerCase() === String(uuid || '').toLowerCase());
    }

    async setWhitelist(uuid, isWhitelisted, name = null) {
        const whitelist = await this.readWhitelist();
        const key = String(uuid || '').toLowerCase();
        const idx = whitelist.findIndex((entry) => String(entry?.uuid || '').toLowerCase() === key);

        if (isWhitelisted) {
            if (idx === -1) {
                whitelist.push({
                    uuid,
                    name: this.normalizePlayerName(name) || `Player ${String(uuid).slice(0, 8)}`
                });
            } else if (name && !whitelist[idx].name) {
                whitelist[idx].name = this.normalizePlayerName(name);
            }
        } else if (idx !== -1) {
            whitelist.splice(idx, 1);
        }

        await this.saveWhitelist(whitelist);
    }

    async addPlayerByName(name) {
        const playerName = this.normalizePlayerName(name);
        if (!playerName) throw new Error('Player name is required');
        if (!/^[A-Za-z0-9_]{3,16}$/.test(playerName)) {
            throw new Error('Player name must be 3-16 characters (letters, numbers, underscore)');
        }

        const uuid = this.toOfflineUuid(playerName);
        await this.setWhitelist(uuid, true, playerName);

        return { uuid, name: playerName, isOp: false, isWhitelisted: true };
    }

    async removePlayer(uuid) {
        const targetUuid = String(uuid || '').trim().toLowerCase();
        if (!targetUuid) throw new Error('Player uuid is required');

        const ops = await this.readOps();
        const whitelist = await this.readWhitelist();
        const usercache = await this.readUsercache();

        const nextOps = ops.filter((entry) => String(entry?.uuid || '').trim().toLowerCase() !== targetUuid);
        const nextWhitelist = whitelist.filter((entry) => String(entry?.uuid || '').trim().toLowerCase() !== targetUuid);
        const nextUsercache = usercache.filter((entry) => String(entry?.uuid || '').trim().toLowerCase() !== targetUuid);

        await Promise.all([
            this.saveOps(nextOps),
            this.saveWhitelist(nextWhitelist),
            this.writeJsonArray(await this.getUsercacheFile(), nextUsercache)
        ]);

        return {
            success: true,
            uuid,
            removedFrom: {
                ops: ops.length - nextOps.length,
                whitelist: whitelist.length - nextWhitelist.length,
                usercache: usercache.length - nextUsercache.length
            }
        };
    }
}

export default new PlayerService();
