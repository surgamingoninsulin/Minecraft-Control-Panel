import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import axios from 'axios';
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

    normalizeUuidKey(uuid) {
        return String(uuid || '').trim().toLowerCase().replace(/-/g, '');
    }

    toDashedUuid(uuid) {
        const key = this.normalizeUuidKey(uuid);
        if (!/^[0-9a-f]{32}$/.test(key)) return String(uuid || '').trim();
        return `${key.slice(0, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}-${key.slice(16, 20)}-${key.slice(20)}`;
    }

    async fetchMinecraftProfileByName(name) {
        const cleanName = this.normalizePlayerName(name);
        if (!cleanName) return null;
        try {
            const response = await axios.get(
                `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanName)}`,
                { timeout: 7000, validateStatus: () => true }
            );
            if (response.status !== 200 || !response.data?.id || !response.data?.name) return null;
            return {
                uuid: this.toDashedUuid(response.data.id),
                name: String(response.data.name)
            };
        } catch {
            return null;
        }
    }

    async resolveIdentity({ uuid, name } = {}) {
        const uuidKey = this.normalizeUuidKey(uuid);
        const providedName = this.normalizePlayerName(name);

        const [usercache, whitelist, ops] = await Promise.all([
            this.readUsercache(),
            this.readWhitelist(),
            this.readOps()
        ]);

        const all = [...usercache, ...whitelist, ...ops];
        if (uuidKey) {
            const hit = all.find((entry) => this.normalizeUuidKey(entry?.uuid) === uuidKey);
            if (hit?.uuid) {
                return {
                    uuid: this.toDashedUuid(hit.uuid),
                    name: this.normalizePlayerName(hit.name) || providedName || `Player ${uuidKey.slice(0, 8)}`
                };
            }
        }

        if (providedName) {
            const mojang = await this.fetchMinecraftProfileByName(providedName);
            if (mojang) return mojang;
        }

        if (uuidKey) {
            return {
                uuid: this.toDashedUuid(uuid),
                name: providedName || `Player ${uuidKey.slice(0, 8)}`
            };
        }

        return null;
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
        const key = this.normalizeUuidKey(uuid);
        return ops.some((entry) => this.normalizeUuidKey(entry?.uuid) === key);
    }

    async setOp(uuid, isOp, name = null) {
        const ops = await this.readOps();
        const identity = await this.resolveIdentity({ uuid, name });
        const targetUuid = identity?.uuid || this.toDashedUuid(uuid);
        const targetName = this.normalizePlayerName(identity?.name || name);
        const key = this.normalizeUuidKey(targetUuid);
        const idx = ops.findIndex((entry) => this.normalizeUuidKey(entry?.uuid) === key);

        if (isOp) {
            if (idx === -1) {
                ops.push({
                    uuid: targetUuid,
                    name: targetName || `Player ${String(targetUuid).slice(0, 8)}`,
                    level: 4,
                    bypassesPlayerLimit: false
                });
            } else if (targetName && ops[idx].name !== targetName) {
                ops[idx].name = targetName;
            }
        } else if (idx !== -1) {
            ops.splice(idx, 1);
        }

        await this.saveOps(ops);
    }

    async isWhitelisted(uuid) {
        const whitelist = await this.readWhitelist();
        const key = this.normalizeUuidKey(uuid);
        return whitelist.some((entry) => this.normalizeUuidKey(entry?.uuid) === key);
    }

    async setWhitelist(uuid, isWhitelisted, name = null) {
        const whitelist = await this.readWhitelist();
        const identity = await this.resolveIdentity({ uuid, name });
        const targetUuid = identity?.uuid || this.toDashedUuid(uuid);
        const targetName = this.normalizePlayerName(identity?.name || name);
        const key = this.normalizeUuidKey(targetUuid);
        const idx = whitelist.findIndex((entry) => this.normalizeUuidKey(entry?.uuid) === key);

        if (isWhitelisted) {
            if (idx === -1) {
                whitelist.push({
                    uuid: targetUuid,
                    name: targetName || `Player ${String(targetUuid).slice(0, 8)}`
                });
            } else if (targetName && whitelist[idx].name !== targetName) {
                whitelist[idx].name = targetName;
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

        const profile = await this.fetchMinecraftProfileByName(playerName);
        if (!profile) {
            throw new Error('Could not resolve this Minecraft account from Mojang. Please use the exact Java username casing and ensure the account exists.');
        }
        await this.setWhitelist(profile.uuid, true, profile.name);

        return { uuid: profile.uuid, name: profile.name, isOp: false, isWhitelisted: true };
    }

    async removePlayer(uuid) {
        const targetUuid = this.normalizeUuidKey(uuid);
        if (!targetUuid) throw new Error('Player uuid is required');

        const ops = await this.readOps();
        const whitelist = await this.readWhitelist();
        const usercache = await this.readUsercache();

        const nextOps = ops.filter((entry) => this.normalizeUuidKey(entry?.uuid) !== targetUuid);
        const nextWhitelist = whitelist.filter((entry) => this.normalizeUuidKey(entry?.uuid) !== targetUuid);
        const nextUsercache = usercache.filter((entry) => this.normalizeUuidKey(entry?.uuid) !== targetUuid);

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
