import axios from 'axios';

const PLACEHOLDER_LOGO = '';
const HANGAR_FALLBACK_LOGO = '/static/images/hangar.svg';
const PLUGIN_SERVER_TYPES = new Set([
  'spigot',
  'paper',
  'purpur',
  // 'velocity', // TEMP DISABLED: proxy plugin flow disabled for now.
]);
const MODDED_SERVER_TYPES = new Set(['forge', 'neoforge', 'fabric']);
const DEFAULT_GIST_FILE = 'gist_minecraft_plugins.json';
const DEFAULT_GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'minecraft-panel'
};

function getServerMode(serverType) {
  const normalized = String(serverType || '').trim().toLowerCase();
  if (PLUGIN_SERVER_TYPES.has(normalized)) return 'plugin';
  if (MODDED_SERVER_TYPES.has(normalized)) return 'modded';
  return 'vanilla';
}

function normalizeMcVersion(value) {
  const str = String(value || '').trim().toLowerCase();
  const match = str.match(/^(\d+\.\d+(?:\.\d+)?)/);
  return match ? match[1] : str;
}

function versionLooksCompatible(candidate, wanted) {
  const a = normalizeMcVersion(candidate);
  const b = normalizeMcVersion(wanted);
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;

  const aParts = a.split('.');
  const bParts = b.split('.');
  if (aParts.length >= 2 && bParts.length >= 2) {
    return aParts[0] === bParts[0] && aParts[1] === bParts[1];
  }
  return false;
}

function getHangarPlatformHints(serverType) {
  const st = String(serverType || '').trim().toLowerCase();
  if (st === 'spigot') return ['SPIGOT', 'PAPER'];
  if (st === 'paper') return ['PAPER', 'SPIGOT'];
  if (st === 'purpur') return ['PAPER', 'SPIGOT'];
  // if (st === 'velocity') return ['VELOCITY', 'WATERFALL']; // TEMP DISABLED.
  return [];
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePagination(options = {}) {
  const page = toPositiveInt(options.page, 1);
  const pageSize = Math.min(toPositiveInt(options.pageSize, 20), 50);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function buildPaginatedResult(items, page, pageSize, total) {
  const safeTotal = Number.isFinite(total) ? total : items.length;
  return {
    items,
    page,
    pageSize,
    total: safeTotal,
    hasMore: page * pageSize < safeTotal
  };
}

function sanitizeFileName(name, fallback = 'plugin.jar') {
  const safe = String(name || '').replace(/[^a-z0-9._-]/gi, '_');
  return safe || fallback;
}

function extractFileNameFromUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const pathname = String(parsed.pathname || '').trim();
    if (!pathname) return '';
    const base = decodeURIComponent(pathname.split('/').pop() || '').trim();
    return base;
  } catch {
    const clean = raw.split('?')[0].split('#')[0];
    return decodeURIComponent(clean.split('/').pop() || '').trim();
  }
}

function coerceDatapackFilename(name, fallbackBase = 'datapack') {
  const safe = sanitizeFileName(name, `${fallbackBase}.zip`);
  if (/\.zip$/i.test(safe)) return safe;
  if (/\.jar$/i.test(safe)) return safe.replace(/\.jar$/i, '.zip');
  return `${safe}.zip`;
}

function sanitizeProviderKey(name, fallback = 'github') {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || fallback;
}

function asArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.plugins)) return payload.plugins;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.resources)) return payload.resources;
  }
  return [];
}

function extractGistId(url) {
  const value = String(url || '').trim();
  if (!value) return null;
  const match = value.match(/gist\.github\.com\/(?:[^/]+)\/([a-f0-9]{8,})/i)
    || value.match(/gist\.githubusercontent\.com\/(?:[^/]+)\/([a-f0-9]{8,})/i)
    || value.match(/^([a-f0-9]{8,})$/i);
  return match ? match[1] : null;
}

function normalizeGistRawUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/gist\.githubusercontent\.com/i.test(value)) return value;
  if (/^https?:\/\/.+\.json(?:\?.*)?$/i.test(value)) return value;
  return '';
}

function maybeJsonParse(data) {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }
  return data;
}

function getSectionEntries(payload, section) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const normalized = String(section || '').trim().toLowerCase();
  if (normalized && Array.isArray(payload[normalized])) return payload[normalized];
  if (Array.isArray(payload.plugins)) return payload.plugins;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.resources)) return payload.resources;
  return [];
}

function isVelocityLike(serverType) {
  const normalized = String(serverType || '').trim().toLowerCase();
  return normalized === 'velocity';
}

function isProviderTokenHeaderIssue(error) {
  const status = error?.response?.status;
  const rawMsg = String(
    error?.response?.data?.error
    || error?.response?.data?.message
    || error?.message
    || ''
  ).toLowerCase();
  if (status === 401 || status === 403) return true;
  if (status === 400 && (rawMsg.includes('no token provided') || rawMsg.includes('invalid authorization'))) {
    return true;
  }
  return false;
}

function normalizeDependencyEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const id = String(entry.id || entry.modId || '').trim();
      if (!id) return null;
      return {
        id,
        provider: String(entry.provider || entry.providerName || '').trim() || null,
        fileId: String(entry.fileId || '').trim() || null,
        name: String(entry.name || '').trim() || null,
        author: String(entry.author || '').trim() || null,
        minecraftVersion: String(entry.minecraftVersion || entry.minecraftversion || '').trim() || null,
        version: String(entry.version || '').trim() || null,
        image: String(entry.image || entry.logo || '').trim() || null,
        directDownloadUrl: String(entry.directDownloadUrl || entry.downloadUrl || entry.url || '').trim() || null,
        description: String(entry.description || entry.summary || '').trim() || null,
        websiteUrl: String(entry.websiteUrl || entry.projectUrl || entry.repoUrl || '').trim() || null,
        latestFileName: String(entry.latestFileName || '').trim() || null
      };
    })
    .filter(Boolean);
}

function getResourceType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'datapack' || normalized === 'datapacks') return 'datapack';
  return '';
}

function interpolateTemplate(value, variables = {}) {
  let result = String(value || '');
  if (!result) return '';

  result = result.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (full, key) => {
    const variable = variables[key];
    return variable === undefined || variable === null || variable === '' ? full : String(variable);
  });

  result = result.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key) => {
    const variable = variables[key];
    return variable === undefined || variable === null || variable === '' ? full : String(variable);
  });

  result = result.replace(/%\{([a-zA-Z0-9_]+)\}/g, (full, key) => {
    const variable = variables[key];
    return variable === undefined || variable === null || variable === '' ? full : String(variable);
  });

  return result;
}

function normalizeSearchValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeLooseSearchValue(value) {
  return normalizeSearchValue(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSearchQuery(input) {
  const raw = String(input || '').trim();
  if (!raw) {
    return {
      raw: '',
      textQuery: '',
      authorQuery: ''
    };
  }

  const authorMatch = raw.match(/(?:^|\s)author:(?:"([^"]+)"|'([^']+)'|(\S+))/i);
  const authorQuery = normalizeSearchValue(authorMatch?.[1] || authorMatch?.[2] || authorMatch?.[3] || '');
  const textQuery = normalizeSearchValue(
    raw.replace(/(?:^|\s)author:(?:"[^"]+"|'[^']+'|\S+)/ig, ' ').replace(/\s+/g, ' ').trim()
  );

  return {
    raw,
    textQuery,
    authorQuery
  };
}

function matchesSearchQuery(item, parsedQuery) {
  if (!parsedQuery) return true;

  const author = normalizeSearchValue(item?.author);
  if (parsedQuery.authorQuery && !author.includes(parsedQuery.authorQuery)) {
    return false;
  }

  const effectiveText = parsedQuery.textQuery || (!parsedQuery.authorQuery ? normalizeSearchValue(parsedQuery.raw) : '');
  if (!effectiveText) return true;

  const searchable = [
    item?.id,
    item?.name,
    item?.summary,
    item?.author,
    item?.metadata?.minecraftVersion,
    item?.metadata?.version
  ]
    .map((value) => normalizeSearchValue(value))
    .join(' ');

  if (searchable.includes(effectiveText)) return true;

  const looseEffective = normalizeLooseSearchValue(effectiveText);
  if (!looseEffective) return false;

  const looseSearchable = normalizeLooseSearchValue(searchable);
  if (looseSearchable.includes(looseEffective)) return true;

  const tokens = looseEffective.split(' ').filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => looseSearchable.includes(token));
}

class ModProvider {
  constructor(name) {
    this.name = name;
  }

  async search(_query, _options) {
    throw new Error('Not implemented');
  }

  async getDownloadUrl(_modId, _fileId, _options) {
    throw new Error('Not implemented');
  }
}

class CurseForgeProvider extends ModProvider {
  constructor() {
    super('CurseForge');
    this.gameId = 432; // Minecraft
  }

  async getProviderSettings() {
    const settingsService = (await import('./settingsService.js')).default;
    const settings = await settingsService.get();
    return settings.modProviders?.curseforge || {};
  }

  async search(query, options = {}) {
    const { page, pageSize, offset } = normalizePagination(options);
    const parsedQuery = parseSearchQuery(query);
    const resourceType = getResourceType(options.resourceType);
    const apiQuery = resourceType === 'datapack'
      ? `${parsedQuery.textQuery || ''} datapack`.trim()
      : parsedQuery.textQuery;
    const providerSettings = await this.getProviderSettings();
    const apiKey = providerSettings.apiKey;

    if (!apiKey) {
      const mockResults = [
        {
          id: 'demo-cf-1',
          name: 'EssentialsX (Demo)',
          summary: 'Core admin commands for Spigot/Paper servers.',
          author: 'Essentials Team',
          logo: PLACEHOLDER_LOGO,
          websiteUrl: 'https://example.com/plugin-placeholder',
          latestFileName: 'EssentialsX-Demo.jar',
          provider: 'curseforge'
        },
        {
          id: 'demo-cf-2',
          name: 'LuckPerms (Demo)',
          summary: 'Permissions and groups manager.',
          author: 'Luck',
          logo: PLACEHOLDER_LOGO,
          websiteUrl: 'https://example.com/plugin-placeholder',
          latestFileName: 'LuckPerms-Demo.jar',
          provider: 'curseforge'
        }
      ].filter((item) => matchesSearchQuery(item, parsedQuery));

      return buildPaginatedResult(mockResults.slice(offset, offset + pageSize), page, pageSize, mockResults.length);
    }

    const response = await axios.get('https://api.curseforge.com/v1/mods/search', {
      params: {
        gameId: this.gameId,
        searchFilter: apiQuery || '',
        index: offset,
        pageSize
      },
      headers: {
        Accept: 'application/json',
        'x-api-key': apiKey
      }
    });

    const data = response.data?.data || [];
    const total = response.data?.pagination?.totalCount ?? data.length;

    const items = data.map((mod) => {
      let bestFile = mod.latestFiles?.find((f) => f.id === mod.mainFileId);
      if (resourceType === 'datapack') {
        if (!bestFile || !(String(bestFile.fileName || '').toLowerCase().endsWith('.zip'))) {
          bestFile = mod.latestFiles?.find((f) => (f.fileName || '').toLowerCase().endsWith('.zip'));
        }
      } else if (!bestFile) {
        bestFile = mod.latestFiles?.find((f) => (f.fileName || '').toLowerCase().endsWith('.jar'));
      }
      if (!bestFile) bestFile = mod.latestFiles?.[0];

      return {
        id: String(mod.id),
        name: mod.name,
        summary: mod.summary,
        author: mod.authors?.[0]?.name || 'Unknown',
        logo: mod.logo?.thumbnailUrl || PLACEHOLDER_LOGO,
        websiteUrl: mod.links?.websiteUrl || null,
        downloadUrl: bestFile?.downloadUrl || null,
        latestFileId: bestFile?.id ? String(bestFile.id) : null,
        latestFileName: resourceType === 'datapack'
          ? coerceDatapackFilename(bestFile?.fileName || `${mod.slug || mod.name}`)
          : sanitizeFileName(bestFile?.fileName || `${mod.slug || mod.name}.jar`),
        provider: 'curseforge'
      };
    });

    const filteredItems = items
      .filter((item) => matchesSearchQuery(item, parsedQuery))
      .filter((item) => {
        if (resourceType !== 'datapack') return true;
        const haystack = `${item.name || ''} ${item.summary || ''}`.toLowerCase();
        return haystack.includes('datapack') || haystack.includes('data pack');
      });
    const filteredTotal = parsedQuery.authorQuery
      ? (offset + filteredItems.length + (data.length === pageSize ? 1 : 0))
      : total;

    return buildPaginatedResult(filteredItems, page, pageSize, filteredTotal);
  }

  async getDownloadUrl(modId, fileId) {
    const providerSettings = await this.getProviderSettings();
    const apiKey = providerSettings.apiKey;

    if (!apiKey) throw new Error('CurseForge API key is required');
    if (!modId || !fileId) throw new Error('modId and fileId are required for CurseForge');

    const response = await axios.get(`https://api.curseforge.com/v1/mods/${modId}/files/${fileId}/download-url`, {
      headers: {
        Accept: 'application/json',
        'x-api-key': apiKey
      }
    });

    return response.data?.data;
  }
}

class ModrinthProvider extends ModProvider {
  constructor() {
    super('Modrinth');
  }

  async getProviderSettings() {
    const settingsService = (await import('./settingsService.js')).default;
    const settings = await settingsService.get();
    return settings.modProviders?.modrinth || {};
  }

  async search(query, options = {}) {
    const { page, pageSize, offset } = normalizePagination(options);
    const parsedQuery = parseSearchQuery(query);
    const apiQuery = parsedQuery.textQuery;
    const providerSettings = await this.getProviderSettings();
    const resourceType = getResourceType(options.resourceType);
    const mode = getServerMode(options.serverType);
    if (resourceType !== 'datapack' && mode === 'vanilla') {
      return buildPaginatedResult([], page, pageSize, 0);
    }

    const facets = [[resourceType === 'datapack' ? 'project_type:datapack' : (mode === 'plugin' ? 'project_type:plugin' : 'project_type:mod')]];
    if (options.serverType) {
      facets.push([`categories:${String(options.serverType).toLowerCase()}`]);
    }
    if (options.serverVersion) {
      facets.push([`versions:${options.serverVersion}`]);
    }

    const headers = {};
    if (providerSettings.apiToken) {
      headers.Authorization = providerSettings.apiToken;
    }

    const response = await axios.get('https://api.modrinth.com/v2/search', {
      params: {
        query: apiQuery || '',
        limit: pageSize,
        offset,
        facets: JSON.stringify(facets)
      },
      headers
    });

    const hits = response.data?.hits || [];
    const total = response.data?.total_hits ?? hits.length;

    const items = hits.map((mod) => ({
      id: mod.project_id,
      name: mod.title,
      summary: mod.description,
      author: mod.author || 'Unknown',
      logo: mod.icon_url || PLACEHOLDER_LOGO,
      websiteUrl: `https://modrinth.com/project/${mod.slug || mod.project_id}`,
      latestFileId: mod.latest_version || null,
      latestFileName: resourceType === 'datapack'
        ? coerceDatapackFilename(`${(mod.slug || mod.project_id).replace(/[^a-z0-9._-]/gi, '_')}`)
        : sanitizeFileName(`${(mod.slug || mod.project_id).replace(/[^a-z0-9._-]/gi, '_')}.jar`),
      provider: 'modrinth'
    }));

    const filteredItems = items.filter((item) => matchesSearchQuery(item, parsedQuery));
    const filteredTotal = parsedQuery.authorQuery
      ? (offset + filteredItems.length + (hits.length === pageSize ? 1 : 0))
      : total;

    return buildPaginatedResult(filteredItems, page, pageSize, filteredTotal);
  }

  async getDownloadUrl(modId, versionId, options = {}) {
    if (!modId) throw new Error('modId is required for Modrinth');

    const providerSettings = await this.getProviderSettings();
    const headers = {};
    if (providerSettings.apiToken) {
      headers.Authorization = providerSettings.apiToken;
    }

    const endpoint = versionId
      ? `https://api.modrinth.com/v2/version/${versionId}`
      : `https://api.modrinth.com/v2/project/${modId}/version`;

    const response = await axios.get(endpoint, { headers });
    const version = Array.isArray(response.data) ? response.data[0] : response.data;
    const resourceType = getResourceType(options.resourceType);
    const preferredExt = resourceType === 'datapack' ? '.zip' : '.jar';
    const file = version?.files?.find((f) => (f.filename || '').toLowerCase().endsWith(preferredExt))
      || version?.files?.find((f) => (f.filename || '').toLowerCase().endsWith('.zip'))
      || version?.files?.find((f) => (f.filename || '').toLowerCase().endsWith('.jar'))
      || version?.files?.[0];

    if (!file?.url) throw new Error('No downloadable file found for this Modrinth project');
    return file.url;
  }
}

class SmithedProvider extends ModProvider {
  constructor() {
    super('Smithed');
    this.baseUrl = 'https://api.smithed.dev/v2';
    this.userCache = new Map();
  }

  async resolveOwnerDisplayName(ownerId) {
    const key = String(ownerId || '').trim();
    if (!key) return '';
    if (this.userCache.has(key)) return this.userCache.get(key);

    try {
      const response = await axios.get(`${this.baseUrl}/users/${encodeURIComponent(key)}`);
      const displayName = String(response.data?.displayName || response.data?.cleanName || key).trim() || key;
      this.userCache.set(key, displayName);
      return displayName;
    } catch {
      this.userCache.set(key, key);
      return key;
    }
  }

  async search(query, options = {}) {
    const { page, pageSize } = normalizePagination(options);
    const parsedQuery = parseSearchQuery(query);
    const wantedVersion = String(options.serverVersion || '').trim();
    const searchTerm = parsedQuery.textQuery || parsedQuery.raw || '';

    const listParams = {
      search: searchTerm,
      limit: pageSize,
      page,
      scope: 'data.display.description,data.display.icon,data.display.webPage,meta'
    };
    if (wantedVersion) {
      listParams.version = wantedVersion;
    }

    const countParams = { search: searchTerm };
    if (wantedVersion) {
      countParams.version = wantedVersion;
    }

    const [listResponse, countResponse] = await Promise.all([
      axios.get(`${this.baseUrl}/packs`, { params: listParams }),
      axios.get(`${this.baseUrl}/packs/count`, { params: countParams }).catch(() => null)
    ]);

    const rows = Array.isArray(listResponse.data)
      ? listResponse.data
      : (listResponse.data ? [listResponse.data] : []);

    const owners = Array.from(new Set(
      rows.map((pack) => String(pack?.meta?.owner || '').trim()).filter(Boolean)
    ));
    const ownerDisplayEntries = await Promise.all(
      owners.map(async (owner) => [owner, await this.resolveOwnerDisplayName(owner)])
    );
    const ownerDisplayById = new Map(ownerDisplayEntries);

    const mappedItems = rows.map((pack) => {
      const rawName = String(pack?.displayName || pack?.data?.display?.name || '').trim();
      if (!rawName) return null;

      const uid = String(pack?.id || '').trim();
      const rawId = String(pack?.meta?.rawId || '').trim();
      const owner = String(pack?.meta?.owner || '').trim();
      const ownerDisplay = String(ownerDisplayById.get(owner) || owner || '').trim();
      const webPage = String(pack?.data?.display?.webPage || '').trim();

      return {
        id: uid || rawId || sanitizeProviderKey(rawName, 'smithed-pack'),
        name: rawName,
        summary: String(pack?.data?.display?.description || '').trim() || 'No description provided.',
        author: ownerDisplay || 'Unknown',
        logo: String(pack?.data?.display?.icon || '').trim() || PLACEHOLDER_LOGO,
        websiteUrl: webPage || (rawId ? `https://smithed.net/packs/${rawId}` : 'https://smithed.net/packs'),
        latestFileId: null,
        latestFileName: coerceDatapackFilename(rawId || rawName, 'datapack'),
        provider: 'smithed',
        metadata: {
          rawId: rawId || null,
          ownerId: owner || null
        }
      };
    }).filter(Boolean);

    const filteredItems = mappedItems
      .filter((item) => matchesSearchQuery(item, parsedQuery));

    const countValue = Number.isFinite(Number(countResponse?.data))
      ? Number(countResponse.data)
      : filteredItems.length;
    const inferredTotal = Math.max(filteredItems.length + ((page - 1) * pageSize), countValue);

    return {
      items: filteredItems,
      page,
      pageSize,
      total: inferredTotal,
      hasMore: (page * pageSize) < inferredTotal
    };
  }

  async getDownloadUrl(modId, fileId, options = {}) {
    if (!modId) {
      throw new Error('modId is required for Smithed provider');
    }

    const response = await axios.get(`${this.baseUrl}/packs/${encodeURIComponent(String(modId).trim())}`);
    const versions = Array.isArray(response.data?.versions) ? response.data.versions : [];
    if (!versions.length) {
      throw new Error('No downloadable versions found for this Smithed pack');
    }

    const wantedVersion = String(options.serverVersion || '').trim();
    const hasDatapackDownload = (version) => Boolean(version?.downloads?.datapack);
    const supportsWantedVersion = (version) => {
      if (!wantedVersion) return true;
      const supports = Array.isArray(version?.supports) ? version.supports : [];
      if (supports.length === 0) return true;
      return supports.some((entry) => versionLooksCompatible(entry, wantedVersion));
    };

    let selected = null;
    if (fileId) {
      selected = versions.find((version) => {
        const name = String(version?.name || '').trim();
        return name && name.toLowerCase() === String(fileId).trim().toLowerCase() && hasDatapackDownload(version);
      }) || null;
    }

    if (!selected) {
      const compatible = versions.filter((version) => hasDatapackDownload(version) && supportsWantedVersion(version));
      if (compatible.length > 0) {
        selected = compatible[compatible.length - 1];
      }
    }

    if (!selected) {
      const downloadable = versions.filter(hasDatapackDownload);
      selected = downloadable[downloadable.length - 1] || null;
    }

    const url = String(selected?.downloads?.datapack || '').trim();
    if (!url) {
      throw new Error('No datapack download URL found for this Smithed pack');
    }
    return url;
  }
}

class HangarProvider extends ModProvider {
  constructor() {
    super('Hangar');
    this.baseUrl = 'https://hangar.papermc.io/api/v1';
  }

  async getProviderSettings() {
    const settingsService = (await import('./settingsService.js')).default;
    const settings = await settingsService.get();
    return settings.modProviders?.hangar || {};
  }

  async search(query, options = {}) {
    const { page, pageSize, offset } = normalizePagination(options);
    const parsedQuery = parseSearchQuery(query);
    const apiQuery = parsedQuery.textQuery;
    const providerSettings = await this.getProviderSettings();

    const mode = getServerMode(options.serverType);
    if (mode !== 'plugin') {
      return buildPaginatedResult([], page, pageSize, 0);
    }

    const baseHeaders = { Accept: 'application/json' };
    const authHeaders = providerSettings.apiKey
      ? { ...baseHeaders, Authorization: `Bearer ${providerSettings.apiKey}` }
      : baseHeaders;

    const wantedTypes = getHangarPlatformHints(options.serverType);
    const wantedEnd = offset + pageSize;
    const batchSize = 50;
    const maxCycles = 20;
    let cycle = 0;
    let sourceOffset = 0;
    let exhausted = false;
    let filteredSeen = 0;
    const items = [];

    const fetchProjects = async (limit, batchOffset) => {
      try {
        return await axios.get(`${this.baseUrl}/projects`, {
          params: {
            query: apiQuery || '',
            limit,
            offset: batchOffset
          },
          headers: authHeaders
        });
      } catch (error) {
        if (providerSettings.apiKey && isProviderTokenHeaderIssue(error)) {
          return axios.get(`${this.baseUrl}/projects`, {
            params: {
              query: apiQuery || '',
              limit,
              offset: batchOffset
            },
            headers: baseHeaders
          });
        }
        throw error;
      }
    };

    const toItem = (project) => {
      const owner = project.namespace?.owner;
      const slug = project.namespace?.slug;
      const supportedPlatforms = project.supportedPlatforms || {};

      if (!owner || !slug) return null;
      if (wantedTypes.length > 0 && !wantedTypes.some((platform) => supportedPlatforms[platform])) {
        return null;
      }

      return {
        id: `${owner}/${slug}`,
        name: project.name,
        summary: project.description || 'No description provided.',
        author: owner || 'Unknown',
        logo: project.avatarUrl || HANGAR_FALLBACK_LOGO,
        websiteUrl: `https://hangar.papermc.io/${owner}/${slug}`,
        latestFileId: null,
        latestFileName: sanitizeFileName(`${slug || project.name}.jar`),
        provider: 'hangar',
        metadata: {
          namespaceOwner: owner,
          namespaceSlug: slug,
          supportedPlatforms
        }
      };
    };

    while (!exhausted && filteredSeen < wantedEnd && cycle < maxCycles) {
      cycle += 1;
      const response = await fetchProjects(batchSize, sourceOffset);
      const payload = response.data || {};
      const rows = Array.isArray(payload.result) ? payload.result : [];

      if (rows.length === 0) {
        exhausted = true;
        break;
      }

      for (const project of rows) {
        const mapped = toItem(project);
        if (!mapped) continue;
        if (!matchesSearchQuery(mapped, parsedQuery)) continue;

        if (filteredSeen >= offset && items.length < pageSize) {
          items.push(mapped);
        }
        filteredSeen += 1;
      }

      sourceOffset += rows.length;
      if (rows.length < batchSize) {
        exhausted = true;
      }
    }

    const hasMore = !exhausted && filteredSeen >= wantedEnd;
    const inferredTotal = exhausted ? filteredSeen : (offset + items.length + (hasMore ? 1 : 0));
    return {
      items,
      page,
      pageSize,
      total: inferredTotal,
      hasMore
    };
  }

  async getDownloadUrl(modId, fileId, options = {}) {
    const [owner, slug] = String(modId || '').split('/');
    if (!owner || !slug) {
      throw new Error('Hangar modId must be in the format "owner/slug"');
    }

    const providerSettings = await this.getProviderSettings();
    const baseHeaders = { Accept: 'application/json' };
    const authHeaders = providerSettings.apiKey
      ? { ...baseHeaders, Authorization: `Bearer ${providerSettings.apiKey}` }
      : baseHeaders;

    const mode = getServerMode(options.serverType);
    if (mode !== 'plugin') {
      throw new Error('Hangar supports plugin/proxy server types only');
    }

    const typeHints = getHangarPlatformHints(options.serverType);
    const versionHint = options.serverVersion ? String(options.serverVersion) : null;

    let response;
    try {
      response = await axios.get(`${this.baseUrl}/projects/${owner}/${slug}/versions`, {
        params: {
          limit: 30,
          offset: 0
        },
        headers: authHeaders
      });
    } catch (error) {
      if (providerSettings.apiKey && isProviderTokenHeaderIssue(error)) {
        response = await axios.get(`${this.baseUrl}/projects/${owner}/${slug}/versions`, {
          params: {
            limit: 30,
            offset: 0
          },
          headers: baseHeaders
        });
      } else {
        throw error;
      }
    }

    const versions = response.data?.result || [];
    if (!versions.length) {
      throw new Error('No downloadable versions found on Hangar for this project');
    }

    let selected = null;

    if (fileId) {
      selected = versions.find((v) => String(v.name).toLowerCase() === String(fileId).toLowerCase());
    }

    if (!selected && typeHints.length > 0) {
      selected = versions.find((v) => typeHints.some((platform) => Boolean(v.downloads?.[platform]?.downloadUrl)));
    }

    if (!selected && versionHint) {
      selected = versions.find((v) => {
        const deps = v.platformDependencies || {};
        const values = Object.values(deps).flat();
        return values.some((dep) => versionLooksCompatible(dep, versionHint));
      });
    }

    if (!selected) {
      selected = versions[0];
    }

    const getPlatformUrl = (version, platform) => {
      const entry = version?.downloads?.[platform];
      const direct = String(entry?.downloadUrl || '').trim();
      if (direct) return direct;
      const external = String(entry?.externalUrl || '').trim();
      if (external) return external;
      return '';
    };

    const platformOrder = typeHints.length > 0 ? typeHints : ['PAPER', 'SPIGOT', 'VELOCITY', 'WATERFALL'];
    for (const platform of platformOrder) {
      const url = getPlatformUrl(selected, platform);
      if (url) return url;
    }

    if (isVelocityLike(options.serverType)) {
      // For proxy mode, stay strict on VELOCITY/WATERFALL compatibility,
      // but scan all returned versions before failing.
      for (const version of versions) {
        for (const platform of ['VELOCITY', 'WATERFALL']) {
          const url = getPlatformUrl(version, platform);
          if (url) return url;
        }
      }
      throw new Error('No compatible Velocity/Waterfall download found for this Hangar project/version.');
    }

    for (const version of versions) {
      for (const platform of ['PAPER', 'SPIGOT', 'VELOCITY', 'WATERFALL']) {
        const url = getPlatformUrl(version, platform);
        if (url) return url;
      }
    }

    throw new Error('No direct Hangar download URL found for the selected project/version');
  }
}

class SpigotProvider extends ModProvider {
  constructor() {
    super('Spigot');
    this.baseUrl = 'https://api.spiget.org/v2';
  }

  normalizeAuthorName(value) {
    return normalizeSearchValue(value).replace(/\s+/g, '');
  }

  async resolveAuthorByName(name) {
    const query = String(name || '').trim();
    if (!query) return null;

    const response = await axios.get(`${this.baseUrl}/search/authors/${encodeURIComponent(query)}`, {
      params: { size: 25, page: 1 }
    });

    const rows = Array.isArray(response.data) ? response.data : [];
    if (rows.length === 0) return null;

    const wanted = this.normalizeAuthorName(query);
    const exact = rows.find((entry) => this.normalizeAuthorName(entry?.name) === wanted);
    if (exact) return exact;

    if (rows.length === 1) return rows[0];
    return null;
  }

  toItem(resource = {}) {
    const id = String(resource?.id || '').trim();
    if (!id) return null;
    const iconUrl = String(resource?.icon?.url || '').trim();
    const logo = iconUrl
      ? (/^https?:\/\//i.test(iconUrl) ? iconUrl : `https://www.spigotmc.org/${iconUrl.replace(/^\/+/, '')}`)
      : '';
    const authorId = resource?.author?.id;
    const authorName = String(resource?.author?.name || '').trim();
    return {
      id,
      name: String(resource?.name || `Spigot Resource #${id}`).trim(),
      summary: String(resource?.tag || '').trim() || 'No description provided.',
      author: authorName || (authorId ? `Author #${authorId}` : 'Unknown'),
      logo,
      websiteUrl: `https://www.spigotmc.org/resources/${id}/`,
      latestFileId: resource?.version?.id ? String(resource.version.id) : null,
      latestFileName: sanitizeFileName(`${resource?.name || `spigot-${id}`}.jar`),
      provider: 'spigot',
      metadata: {
        premium: Boolean(resource?.premium),
        authorId: authorId ? String(authorId) : null
      }
    };
  }

  async search(query, options = {}) {
    const { page, pageSize, offset } = normalizePagination(options);
    const parsedQuery = parseSearchQuery(query);
    const textQuery = String(parsedQuery.textQuery || parsedQuery.raw || '').trim();
    const useSearch = Boolean(textQuery);
    const searchQueries = this.buildSearchQueries(textQuery);

    const authorLookupText = String(parsedQuery.authorQuery || textQuery).trim();
    if (authorLookupText) {
      const authorMatch = await this.resolveAuthorByName(authorLookupText).catch(() => null);
      if (authorMatch?.id) {
        const authorResponse = await axios.get(`${this.baseUrl}/authors/${encodeURIComponent(authorMatch.id)}/resources`, {
          params: {
            size: pageSize,
            page
          }
        });

        const authorRows = Array.isArray(authorResponse.data) ? authorResponse.data : [];
        const authorItems = authorRows
          .filter((resource) => resource && resource.premium !== true)
          .map((resource) => {
            const mapped = this.toItem(resource);
            if (!mapped) return null;
            return {
              ...mapped,
              author: String(authorMatch.name || mapped.author || '').trim() || mapped.author
            };
          })
          .filter(Boolean);

        return {
          items: authorItems,
          page,
          pageSize,
          total: offset + authorItems.length + (authorRows.length === pageSize ? 1 : 0),
          hasMore: authorRows.length === pageSize
        };
      }
    }

    // For query-based search we scan upstream pages to fill the requested page with free-only items.
    const sourcePageSize = Math.min(Math.max(pageSize, 20), 50);
    let sourcePage = 1;
    let filteredSeen = 0;
    let exhausted = false;
    let cycle = 0;
    const maxCycles = 40;
    const wantedEnd = offset + pageSize;
    const items = [];
    const seenIds = new Set();
    let queryIndex = 0;

    while (!exhausted && filteredSeen < wantedEnd && cycle < maxCycles) {
      cycle += 1;
      const activeQuery = useSearch ? searchQueries[queryIndex] : '';
      const response = useSearch
        ? await axios.get(`${this.baseUrl}/search/resources/${encodeURIComponent(activeQuery)}`, {
          params: {
            size: sourcePageSize,
            page: sourcePage
          }
        })
        : await axios.get(`${this.baseUrl}/resources/free`, {
          params: {
            size: sourcePageSize,
            page: sourcePage
          }
        });
      const rows = Array.isArray(response.data) ? response.data : [];
      if (rows.length === 0) {
        if (useSearch && queryIndex + 1 < searchQueries.length) {
          queryIndex += 1;
          sourcePage = 1;
          continue;
        }
        exhausted = true;
        break;
      }

      for (const resource of rows) {
        if (!resource) continue;
        if (resource.existenceStatus !== undefined && resource.existenceStatus !== 1) continue;
        if (resource.premium === true) continue;
        const mapped = this.toItem(resource);
        if (!mapped) continue;
        if (seenIds.has(mapped.id)) continue;
        seenIds.add(mapped.id);
        if (!matchesSearchQuery(mapped, parsedQuery)) continue;
        if (filteredSeen >= offset && items.length < pageSize) {
          items.push(mapped);
        }
        filteredSeen += 1;
      }

      if (rows.length < sourcePageSize) {
        if (useSearch && queryIndex + 1 < searchQueries.length) {
          queryIndex += 1;
          sourcePage = 1;
          continue;
        }
        exhausted = true;
      }
      sourcePage += 1;
    }

    if (useSearch && items.length < pageSize) {
      let fallbackPage = 1;
      let fallbackCycle = 0;
      const maxFallbackCycles = 120;
      const fallbackPageSize = 100;
      while (items.length < pageSize && fallbackCycle < maxFallbackCycles) {
        fallbackCycle += 1;
        const fallbackResponse = await axios.get(`${this.baseUrl}/resources/free`, {
          params: {
            size: fallbackPageSize,
            page: fallbackPage
          }
        });
        const fallbackRows = Array.isArray(fallbackResponse.data) ? fallbackResponse.data : [];
        if (fallbackRows.length === 0) break;

        for (const resource of fallbackRows) {
          if (!resource) continue;
          if (resource.existenceStatus !== undefined && resource.existenceStatus !== 1) continue;
          if (resource.premium === true) continue;
          const mapped = this.toItem(resource);
          if (!mapped) continue;
          if (seenIds.has(mapped.id)) continue;
          seenIds.add(mapped.id);
          if (!matchesSearchQuery(mapped, parsedQuery)) continue;
          if (filteredSeen >= offset && items.length < pageSize) {
            items.push(mapped);
          }
          filteredSeen += 1;
        }

        if (fallbackRows.length < fallbackPageSize) break;
        fallbackPage += 1;
      }
    }

    const hasMore = !exhausted && filteredSeen >= wantedEnd;
    const inferredTotal = exhausted ? filteredSeen : (offset + items.length + (hasMore ? 1 : 0));
    return {
      items,
      page,
      pageSize,
      total: inferredTotal,
      hasMore
    };
  }

  buildSearchQueries(rawQuery) {
    const base = String(rawQuery || '').trim();
    if (!base) return [''];

    const cleaned = base.replace(/[^a-zA-Z0-9\s._-]/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = cleaned.toLowerCase().split(' ').filter((t) => t.length >= 3);

    const variants = [
      base,
      base.replace(/[\[\]\(\)\{\}"'`]/g, ' ').replace(/\s+/g, ' ').trim(),
      cleaned,
      base.replace(/[\[\]]/g, '').trim()
    ];

    if (tokens.length > 0) {
      variants.push(tokens.join(' '));
      variants.push(tokens[0]);
    }

    return variants.filter((q, idx, arr) => q && arr.indexOf(q) === idx);
  }

  async getDownloadUrl(modId) {
    const resourceId = String(modId || '').trim();
    if (!resourceId) throw new Error('modId is required for Spigot');

    const response = await axios.get(`${this.baseUrl}/resources/${encodeURIComponent(resourceId)}`);
    const resource = response.data || {};
    if (resource?.premium === true) {
      throw new Error('Paid Spigot plugins are not supported in-browser. Upload the plugin jar manually.');
    }

    return `${this.baseUrl}/resources/${encodeURIComponent(resourceId)}/download`;
  }
}

class GitHubGistProvider extends ModProvider {
  constructor({ name = 'Github', providerKey = 'github', gistUrl = '', isCustom = false, resourceSection = 'plugins', resourceType = 'plugin' } = {}) {
    super(name);
    this.providerKey = sanitizeProviderKey(providerKey || name, 'github');
    this.staticGistUrl = String(gistUrl || '').trim();
    this.isCustom = Boolean(isCustom);
    this.resourceSection = String(resourceSection || 'plugins').trim().toLowerCase();
    this.resourceType = String(resourceType || 'plugin').trim().toLowerCase();
    this.cache = {
      key: '',
      ts: 0,
      items: []
    };
    this.cacheMs = 60_000;
  }

  async getProviderSettings() {
    const settingsService = (await import('./settingsService.js')).default;
    const settings = await settingsService.get();
    return settings.modProviders?.github || {};
  }

  async resolveGistUrl() {
    if (this.staticGistUrl) return this.staticGistUrl;
    const providerSettings = await this.getProviderSettings();
    return String(providerSettings.gistUrl || '').trim();
  }

  async resolveCatalogSources() {
    const primaryUrl = await this.resolveGistUrl();
    const primaryKey = sanitizeProviderKey(this.providerKey, 'github');
    const sources = [];

    if (primaryUrl) {
      sources.push({
        sourceKey: primaryKey,
        gistUrl: primaryUrl
      });
    }

    // Built-in Github provider also aggregates enabled community Github gists.
    if (!this.isCustom && primaryKey === 'github') {
      const settingsService = (await import('./settingsService.js')).default;
      const settings = await settingsService.get();
      const communityProviders = Array.isArray(settings.modProviders?.communityProviders)
        ? settings.modProviders.communityProviders
        : (Array.isArray(settings.modProviders?.customProviders) ? settings.modProviders.customProviders : []);

      for (const custom of communityProviders) {
        if (!custom || typeof custom !== 'object') continue;
        if (custom.enabled === false) continue;
        const type = String(custom.type || 'github').trim().toLowerCase();
        if (type !== 'github') continue;

        const gistUrl = String(custom.gistUrl || '').trim();
        if (!gistUrl) continue;

        const sourceKey = sanitizeProviderKey(custom.id || custom.name || 'community-github', 'community-github');
        sources.push({ sourceKey, gistUrl });
      }
    }

    return sources;
  }

  async fetchRawJsonFromUrl(url) {
    const response = await axios.get(url, {
      headers: {
        ...DEFAULT_GITHUB_HEADERS,
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8'
      }
    });
    return maybeJsonParse(response.data);
  }

  async fetchGistJson(url) {
    const directRaw = normalizeGistRawUrl(url);
    if (directRaw) {
      return this.fetchRawJsonFromUrl(directRaw);
    }

    const gistId = extractGistId(url);
    if (!gistId) {
      throw new Error(`${this.name} provider requires a valid GitHub gist URL or gist ID.`);
    }

    const gist = await axios.get(`https://api.github.com/gists/${gistId}`, {
      headers: DEFAULT_GITHUB_HEADERS
    });

    const files = gist.data?.files || {};
    const allFiles = Object.values(files);
    if (!allFiles.length) {
      throw new Error(`No files found in gist ${gistId}.`);
    }

    const exact = allFiles.find((file) => String(file.filename || '').toLowerCase() === DEFAULT_GIST_FILE.toLowerCase());
    const jsonFile = exact || allFiles.find((file) => String(file.filename || '').toLowerCase().endsWith('.json')) || allFiles[0];

    if (jsonFile.content && !jsonFile.truncated) {
      return maybeJsonParse(jsonFile.content);
    }

    if (!jsonFile.raw_url) {
      throw new Error(`Could not load content from gist file ${jsonFile.filename || 'unknown'}.`);
    }

    return this.fetchRawJsonFromUrl(jsonFile.raw_url);
  }

  toItem(entry, index, source = {}) {
    const name = String(entry?.name || entry?.title || '').trim();
    const author = String(entry?.author || entry?.publisher || 'Community').trim() || 'Community';
    const version = String(entry?.version || entry?.pluginVersion || '').trim();
    const minecraftVersion = String(
      entry?.minecraftVersion
      || entry?.minecraft_version
      || entry?.mcVersion
      || ''
    ).trim();
    const rawDownloadUrl = String(
      entry?.directDownloadUrl
      || entry?.direct_download_url
      || entry?.downloadUrl
      || entry?.url
      || ''
    ).trim();
    const downloadUrl = interpolateTemplate(rawDownloadUrl, {
      id: String(entry?.id || '').trim(),
      name,
      version,
      minecraftVersion
    });

    if (!name || !downloadUrl) return null;

    const providerTag = sanitizeProviderKey(this.providerKey, 'github');
    const sourceKey = sanitizeProviderKey(source?.sourceKey || this.providerKey, providerTag);
    const rawId = String(entry?.id || '').trim();
    const stableId = rawId
      ? (sourceKey === providerTag ? rawId : `${sourceKey}-${rawId}`)
      : `${sourceKey}-${index + 1}-${sanitizeProviderKey(name, `item-${index + 1}`)}`;
    const websiteRaw = String(entry?.websiteUrl || entry?.repoUrl || entry?.projectUrl || entry?.sourceUrl || '').trim();
    const websiteInterpolated = interpolateTemplate(websiteRaw, {
      id: String(entry?.id || '').trim(),
      name,
      author,
      version,
      minecraftVersion
    });
    const websiteUrl = websiteInterpolated.trim() || null;

    const inferredFromUrl = extractFileNameFromUrl(downloadUrl);
    const explicitLatestName = String(entry?.latestFileName || '').trim();

    return {
      id: stableId,
      name,
      summary: String(entry?.description || entry?.summary || '').trim() || 'No description provided.',
      author,
      logo: String(entry?.image || entry?.imageUrl || entry?.logo || entry?.icon || '').trim() || PLACEHOLDER_LOGO,
      websiteUrl,
      downloadUrl,
      latestFileId: null,
      latestFileName: this.resourceType === 'datapack'
        ? coerceDatapackFilename(explicitLatestName || inferredFromUrl || `${name}.zip`, name)
        : sanitizeFileName(explicitLatestName || inferredFromUrl || `${name}.jar`),
      provider: providerTag,
      providerName: this.name,
      metadata: {
        minecraftVersion,
        version,
        resourceType: this.resourceType,
        serverType: String(entry?.type || '').trim().toLowerCase()
      },
      dependencies: normalizeDependencyEntries(entry?.dependencies)
    };
  }

  async loadCatalog() {
    const sources = await this.resolveCatalogSources();
    if (!sources.length) {
      if (this.isCustom) {
        throw new Error(`${this.name} is missing a gist URL.`);
      }
      return [];
    }

    const cacheKey = `${this.providerKey}:${sources.map((source) => `${source.sourceKey}:${source.gistUrl}`).join('|')}`;
    const now = Date.now();
    if (this.cache.key === cacheKey && (now - this.cache.ts) < this.cacheMs) {
      return this.cache.items;
    }

    const items = [];
    const seenIds = new Set();
    const sourceErrors = [];

    for (const source of sources) {
      try {
        const payload = await this.fetchGistJson(source.gistUrl);
        const rows = getSectionEntries(payload, this.resourceSection);
        rows.forEach((entry, index) => {
          const mapped = this.toItem(entry, index, source);
          if (!mapped) return;
          if (seenIds.has(mapped.id)) return;
          seenIds.add(mapped.id);
          items.push(mapped);
        });
      } catch (error) {
        sourceErrors.push({ source, error });
        console.error(
          `[GitHubGistProvider] Failed loading source '${source?.sourceKey || 'unknown'}' from ${source?.gistUrl || 'unknown URL'}:`,
          error?.message || error
        );
      }
    }

    if (items.length === 0 && sourceErrors.length > 0) {
      const latestError = sourceErrors[sourceErrors.length - 1]?.error;
      throw new Error(`${this.name} provider could not load any gist sources: ${latestError?.message || 'unknown error'}`);
    }

    this.cache = {
      key: cacheKey,
      ts: now,
      items
    };

    return items;
  }

  async search(query, options = {}) {
    const { page, pageSize, offset } = normalizePagination(options);
    const catalog = await this.loadCatalog();
    const parsedQuery = parseSearchQuery(query);
    const wantedVersion = String(options.serverVersion || '').trim();

    const filtered = catalog.filter((item) => {
      if (wantedVersion) {
        const versionTag = String(item?.metadata?.minecraftVersion || '').trim();
        if (versionTag && !versionLooksCompatible(versionTag, wantedVersion)) {
          return false;
        }
      }

      if (this.resourceType === 'mod') {
        const hintedType = String(item?.metadata?.serverType || '').trim().toLowerCase();
        const wantedType = String(options.serverType || '').trim().toLowerCase();
        if (hintedType && wantedType && hintedType !== wantedType) {
          return false;
        }
      }

      return matchesSearchQuery(item, parsedQuery);
    });

    return buildPaginatedResult(filtered.slice(offset, offset + pageSize), page, pageSize, filtered.length);
  }

  async getDownloadUrl(modId) {
    const catalog = await this.loadCatalog();
    const wantedId = String(modId || '').trim();
    const item = catalog.find((entry) => String(entry.id) === wantedId);

    if (!item) {
      throw new Error(`Plugin ${modId} not found in ${this.name} gist list.`);
    }

    if (!item.downloadUrl) {
      throw new Error(`Plugin ${item.name} does not include a direct download URL.`);
    }

    return item.downloadUrl;
  }
}

class ModProviderService {
  constructor() {
    this.baseProviders = new Map();
    this.registerBaseProvider(new CurseForgeProvider());
    this.registerBaseProvider(new ModrinthProvider());
    this.registerBaseProvider(new SmithedProvider());
    this.registerBaseProvider(new HangarProvider());
    this.registerBaseProvider(new SpigotProvider());
    this.registerBaseProvider(new GitHubGistProvider({
      name: 'Github Plugins',
      providerKey: 'github-plugins',
      resourceSection: 'plugins',
      resourceType: 'plugin'
    }));
    this.registerBaseProvider(new GitHubGistProvider({
      name: 'Github Datapacks',
      providerKey: 'github-datapacks',
      resourceSection: 'datapacks',
      resourceType: 'datapack'
    }));
    this.registerBaseProvider(new GitHubGistProvider({
      name: 'Github Mods',
      providerKey: 'github-mods',
      resourceSection: 'mods',
      resourceType: 'mod'
    }));
  }

  registerBaseProvider(provider) {
    this.baseProviders.set(provider.name.toLowerCase(), provider);
  }

  async buildRegistry() {
    const registry = new Map(this.baseProviders);
    const settingsService = (await import('./settingsService.js')).default;
    const settings = await settingsService.get();
    const communityProviders = Array.isArray(settings.modProviders?.communityProviders)
      ? settings.modProviders.communityProviders
      : (Array.isArray(settings.modProviders?.customProviders) ? settings.modProviders.customProviders : []);

    for (const custom of communityProviders) {
      if (!custom || typeof custom !== 'object') continue;
      if (custom.enabled === false) continue;
      const type = String(custom.type || 'github').trim().toLowerCase();
      if (type !== 'github') continue;

      const name = String(custom.name || '').trim();
      const gistUrl = String(custom.gistUrl || '').trim();
      if (!name || !gistUrl) continue;

      const key = name.toLowerCase();
      if (registry.has(key)) continue;

      registry.set(key, new GitHubGistProvider({
        name,
        providerKey: custom.id || name,
        gistUrl,
        isCustom: true
      }));
    }

    return registry;
  }

  async getProvider(name) {
    if (!name) return null;
    const providers = await this.buildRegistry();
    return providers.get(String(name).toLowerCase()) || null;
  }

  async getProviderNames(options = {}) {
    const resourceType = getResourceType(options.resourceType);
    const mode = getServerMode(options.serverType);
    const providers = await this.buildRegistry();
    const allNames = Array.from(providers.values()).map((provider) => provider.name);
    const builtInPluginNames = ['Hangar', 'Spigot', 'Github Plugins'];
    const builtInModdedNames = ['Modrinth', 'CurseForge', 'Github Mods'];
    const builtInDatapackNames = ['Modrinth', 'CurseForge', 'Smithed', 'Github Datapacks'];

    if (resourceType === 'datapack') {
      return allNames.filter((name) => builtInDatapackNames.includes(name));
    }

    if (mode === 'plugin') {
      if (String(options.serverType || '').trim().toLowerCase() === 'velocity') {
        return allNames.filter((name) => ['Hangar', 'Github Plugins'].includes(name));
      }
      // Community github gists are merged into the built-in Github provider catalog.
      // Keep provider list stable and avoid adding separate community entries.
      return allNames.filter((name) => builtInPluginNames.includes(name));
    }
    if (mode === 'modded') {
      return allNames.filter((name) => builtInModdedNames.includes(name));
    }
    return [];
  }

  async search(providerName, query, options = {}) {
    const provider = await this.getProvider(providerName);
    if (!provider) throw new Error(`Provider ${providerName} not found`);
    const allowed = await this.getProviderNames({ serverType: options.serverType, resourceType: options.resourceType });
    if (allowed.length > 0 && !allowed.includes(provider.name)) {
      return buildPaginatedResult([], toPositiveInt(options.page, 1), Math.min(toPositiveInt(options.pageSize, 20), 50), 0);
    }
    if (allowed.length === 0) {
      return buildPaginatedResult([], toPositiveInt(options.page, 1), Math.min(toPositiveInt(options.pageSize, 20), 50), 0);
    }
    return provider.search(query, options);
  }

  async getDownloadUrl(providerName, modId, fileId, options = {}) {
    const provider = await this.getProvider(providerName);
    if (!provider) throw new Error(`Provider ${providerName} not found`);
    const allowed = await this.getProviderNames({ serverType: options.serverType, resourceType: options.resourceType });
    if (!allowed.includes(provider.name)) {
      throw new Error(`Provider ${provider.name} is not available for server type ${options.serverType || 'unknown'}`);
    }
    return provider.getDownloadUrl(modId, fileId, options);
  }
}

export default new ModProviderService();
