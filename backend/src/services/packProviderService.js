import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROVIDERS_FILE = path.resolve(__dirname, '../../data/pack-providers.json');
const LEGACY_PROVIDERS_FILE = path.resolve(__dirname, '../../backend/data/pack-providers.json');
const DEFAULT_BUILTIN_PROVIDER = {
  name: 'GitHub Packs',
  url: 'https://gist.github.com/surgamingoninsulin/f59cd85ea2a84cca289086ffd56e2ee3'
};

function safeString(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function normalizePack(raw = {}, providerName = 'Unknown') {
  const id = safeString(raw.id || raw.slug || raw.name, '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (!id) return null;
  const version = safeString(raw.version, '').trim();
  const description = safeString(raw.description, '').trim() || (version ? `Version ${version}` : '');
  const serverTypeRaw = raw.serverType ?? raw.servertype ?? raw.server_type ?? 'vanilla';
  return {
    id,
    name: safeString(raw.name, id),
    description,
    author: safeString(raw.author || raw.auhtor, providerName),
    version,
    minecraftVersion: safeString(raw.minecraftVersion, ''),
    serverType: safeString(serverTypeRaw, 'vanilla').toLowerCase(),
    serverIconImage: safeString(raw.serverIconImage, ''),
    packUrl: safeString(raw.packUrl, ''),
    serverJar: raw.serverJar && typeof raw.serverJar === 'object' ? raw.serverJar : {},
    serverProperties: raw.serverProperties && typeof raw.serverProperties === 'object' ? raw.serverProperties : {},
    plugins: Array.isArray(raw.plugins) ? raw.plugins : [],
    mods: Array.isArray(raw.mods) ? raw.mods : [],
    datapacks: Array.isArray(raw.datapacks) ? raw.datapacks : [],
    files: Array.isArray(raw.files) ? raw.files : []
  };
}

function extractGistId(url) {
  const m = String(url || '').match(/gist\.github\.com\/(?:[^/]+)\/([a-f0-9]{8,})/i);
  return m ? m[1] : null;
}

class PackProviderService {
  async ensureFile() {
    const normalizeShape = (obj) => ({
      builtIn: Array.isArray(obj?.builtIn) ? obj.builtIn : [],
      community: Array.isArray(obj?.community) ? obj.community : []
    });

    try {
      await fs.access(PROVIDERS_FILE);
      const existingRaw = await fs.readFile(PROVIDERS_FILE, 'utf8');
      const existing = normalizeShape(JSON.parse(existingRaw || '{}'));
      if (existing.builtIn.length === 0) {
        existing.builtIn = [DEFAULT_BUILTIN_PROVIDER];
        await fs.writeFile(PROVIDERS_FILE, JSON.stringify(existing, null, 2), 'utf8');
      }
      return;
    } catch {
      // Continue with migration/create flow.
    }

    await fs.mkdir(path.dirname(PROVIDERS_FILE), { recursive: true });

    try {
      await fs.access(LEGACY_PROVIDERS_FILE);
      const legacyRaw = await fs.readFile(LEGACY_PROVIDERS_FILE, 'utf8');
      const legacy = normalizeShape(JSON.parse(legacyRaw || '{}'));
      if (legacy.builtIn.length === 0) {
        legacy.builtIn = [DEFAULT_BUILTIN_PROVIDER];
      }
      await fs.writeFile(PROVIDERS_FILE, JSON.stringify(legacy, null, 2), 'utf8');
      return;
    } catch {
      // No legacy file, create fresh.
    }

    await fs.writeFile(PROVIDERS_FILE, JSON.stringify({
      builtIn: [DEFAULT_BUILTIN_PROVIDER],
      community: []
    }, null, 2), 'utf8');
  }

  async getProviders() {
    await this.ensureFile();
    const raw = await fs.readFile(PROVIDERS_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return {
      builtIn: Array.isArray(parsed.builtIn) ? parsed.builtIn : [],
      community: Array.isArray(parsed.community) ? parsed.community : []
    };
  }

  async saveProviders(next) {
    await this.ensureFile();
    const normalized = {
      builtIn: Array.isArray(next.builtIn) ? next.builtIn : [],
      community: Array.isArray(next.community) ? next.community : []
    };
    await fs.writeFile(PROVIDERS_FILE, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  }

  async addCommunityProvider(provider) {
    const current = await this.getProviders();
    const name = safeString(provider?.name, '').trim();
    const url = safeString(provider?.url, '').trim();
    if (!name || !url) {
      throw new Error('Provider name and url are required');
    }
    if (current.community.some((p) => String(p.url || '').trim().toLowerCase() === url.toLowerCase())) {
      return current;
    }
    current.community.push({ name, url });
    return this.saveProviders(current);
  }

  async removeCommunityProvider(url) {
    const current = await this.getProviders();
    const target = safeString(url, '').trim().toLowerCase();
    current.community = current.community.filter((p) => String(p.url || '').trim().toLowerCase() !== target);
    return this.saveProviders(current);
  }

  async fetchProviderPacks(provider) {
    const url = safeString(provider?.url, '').trim();
    if (!url) return { provider: provider?.name || 'Unknown', packs: [], error: 'Missing URL' };

    try {
      let data;
      const gistId = extractGistId(url);
      if (gistId) {
        const gistResp = await axios.get(`https://api.github.com/gists/${gistId}`, { timeout: 12000 });
        const files = gistResp.data?.files || {};
        const jsonFile = Object.values(files).find((f) => String(f?.filename || '').toLowerCase().endsWith('.json'));
        if (!jsonFile?.content) {
          return { provider: provider?.name || 'Unknown', packs: [], error: 'No JSON file found in gist' };
        }
        data = JSON.parse(jsonFile.content);
      } else {
        const response = await axios.get(url, { timeout: 12000 });
        data = response.data;
      }

      const providerName = safeString(data?.providerName || provider?.name, provider?.name || 'Unknown');
      const rawPacks = Array.isArray(data?.packs) ? data.packs : [];
      const packs = rawPacks.map((pack) => normalizePack(pack, providerName)).filter(Boolean);
      return { provider: providerName, packs, error: null };
    } catch (error) {
      return { provider: provider?.name || 'Unknown', packs: [], error: error.message || 'Failed to load provider' };
    }
  }

  async getAllPacks() {
    const providers = await this.getProviders();
    const builtInResults = await Promise.all(providers.builtIn.map((p) => this.fetchProviderPacks(p)));
    const communityResults = await Promise.all(providers.community.map((p) => this.fetchProviderPacks(p)));

    return {
      builtIn: builtInResults,
      community: communityResults
    };
  }
}

export default new PackProviderService();
