import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

class UserService {
    getPrimaryAdmin(users = []) {
        const admins = (users || []).filter((u) => u?.role === 'admin');
        if (admins.length === 0) return null;

        return admins.sort((a, b) => {
            const aTime = Date.parse(a.createdAt || '') || Number(a.id) || 0;
            const bTime = Date.parse(b.createdAt || '') || Number(b.id) || 0;
            return aTime - bTime;
        })[0];
    }

    async isPrimaryAdmin(userId) {
        const users = await this.getAll();
        const primaryAdmin = this.getPrimaryAdmin(users);
        return Boolean(primaryAdmin && primaryAdmin.id === userId);
    }

    sanitize(user, primaryAdminId = null) {
        if (!user || typeof user !== 'object') return null;
        const { password, resetSecretHash, ...rest } = user;
        return {
            ...rest,
            forcePasswordChange: Boolean(user.forcePasswordChange),
            isPrimaryAdmin: Boolean(primaryAdminId && user.id === primaryAdminId)
        };
    }

    generateRandomSecret(length = 24) {
        const raw = crypto.randomBytes(Math.max(24, length)).toString('base64url');
        return raw.slice(0, length);
    }

    async ensureDataDir() {
        try {
            await fs.access(DATA_DIR);
        } catch {
            await fs.mkdir(DATA_DIR, { recursive: true });
        }
    }

    async getAll() {
        try {
            await this.ensureDataDir();
            const data = await fs.readFile(USERS_FILE, 'utf8');
            if (!data.trim()) return []; // Handle empty file
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT' || error instanceof SyntaxError) {
                // If file doesn't exist or is invalid JSON, reset to empty
                try {
                    await this.ensureDataDir();
                    await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2));
                } catch (e) {
                    console.error('[UserService] Failed to initialize users file:', e.message);
                }
                return [];
            }
            if (error.code === 'EACCES') {
                console.error('[UserService] CRITICAL: Permission denied accessing users.json. Run "chown" fix.');
                return [];
            }
            throw error;
        }
    }

    async saveAll(users) {
        await this.ensureDataDir();
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    }

    async needsSetup() {
        const users = await this.getAll();
        return users.length === 0;
    }

    async create(userData) {
        try {
            // Validate required fields
            if (!userData.user || !userData.password) {
                throw new Error('Username and password are required');
            }

            const users = await this.getAll();

            // Check if user already exists
            const existingUser = users.find(u => u.user === userData.user);
            if (existingUser) {
                throw new Error('User with this username already exists');
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(userData.password, salt);

            const newUser = {
                id: Date.now().toString(),
                user: userData.user,
                // email: userData.email, // Removed
                password: hashedPassword,
                role: userData.role || (users.length === 0 ? 'admin' : 'collaborator'),
                active: true,
                createdAt: new Date().toISOString(),
                loginDate: null,
                forcePasswordChange: false,
                resetSecretHash: null
            };

            users.push(newUser);
            await this.saveAll(users);

            // Return without password
            const { password, ...userWithoutPassword } = newUser;
            return userWithoutPassword;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    async findByUser(username) {
        const users = await this.getAll();
        return users.find(u => u.user === username || u.email === username);
    }

    async findById(id) {
        const users = await this.getAll();
        return users.find(u => u.id === id);
    }

    async update(id, updateData) {
        const users = await this.getAll();
        const index = users.findIndex(u => u.id === id);
        if (index === -1) throw new Error('User not found');

        if (updateData.password && String(updateData.password).trim()) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(updateData.password, salt);
            updateData.forcePasswordChange = false;
        } else {
            delete updateData.password;
        }

        users[index] = { ...users[index], ...updateData };
        await this.saveAll(users);

        const { password, ...userWithoutPassword } = users[index];
        return userWithoutPassword;
    }

    async delete(id) {
        const users = await this.getAll();
        const filtered = users.filter(u => u.id !== id);
        if (filtered.length === users.length) throw new Error('User not found');
        await this.saveAll(filtered);
    }

    async updateLoginDate(id) {
        const users = await this.getAll();
        const index = users.findIndex(u => u.id === id);
        if (index !== -1) {
            users[index].loginDate = new Date().toISOString();
            await this.saveAll(users);
        }
    }

    async generateResetSecret(targetUserId, actorUserId) {
        const users = await this.getAll();
        const primaryAdmin = this.getPrimaryAdmin(users);
        if (!primaryAdmin || primaryAdmin.id !== actorUserId) {
            throw new Error('Only the primary admin can generate reset secrets');
        }

        const index = users.findIndex((u) => u.id === targetUserId);
        if (index === -1) throw new Error('User not found');

        const secretKey = this.generateRandomSecret(24);
        const salt = await bcrypt.genSalt(10);
        const resetSecretHash = await bcrypt.hash(secretKey, salt);

        users[index].resetSecretHash = resetSecretHash;
        await this.saveAll(users);

        return {
            userId: users[index].id,
            username: users[index].user,
            secretKey
        };
    }

    async resetPasswordWithSecret(username, secretKey) {
        const users = await this.getAll();
        const index = users.findIndex((u) => String(u.user || '').toLowerCase() === String(username || '').toLowerCase());
        if (index === -1) throw new Error('Invalid username or secret key');

        const target = users[index];
        if (!target.active) throw new Error('Account is deactivated');
        if (!target.resetSecretHash) throw new Error('No reset secret configured for this account');

        const matches = await bcrypt.compare(String(secretKey || ''), target.resetSecretHash);
        if (!matches) throw new Error('Invalid username or secret key');

        const temporaryPassword = this.generateRandomSecret(16);
        const salt = await bcrypt.genSalt(10);
        users[index].password = await bcrypt.hash(temporaryPassword, salt);
        users[index].forcePasswordChange = true;

        await this.saveAll(users);
        return {
            username: target.user,
            temporaryPassword
        };
    }
}

export default new UserService();
