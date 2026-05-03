import { useState, useEffect, useCallback, useRef } from 'react';
import { pluginAPI } from '../services/api';
import * as settingsAPI from '../services/settingsApi';
import { useDialog } from '../contexts/DialogContext';
import {
    Package, Trash2, Upload, Search, Download, Layers,
    ExternalLink
} from 'lucide-react';
import '../styles/global.css';

const PLUGIN_SERVER_TYPES = new Set([
    'spigot',
    'paper',
    'purpur',
    // 'velocity', // TEMP DISABLED: proxy plugin install flow disabled for now.
]);
const MODDED_SERVER_TYPES = new Set(['forge', 'neoforge', 'fabric']);
const GRID_CARD_HEIGHT_PX = 320;
const DEFAULT_GITHUB_GIST_URL = 'https://gist.github.com/surgamingoninsulin/2b4d90991a5a5a025f69cce2282f67b7';
const DEFAULT_PROVIDER_SETTINGS = {
    curseforge: { apiKey: '' },
    modrinth: { enabled: true, apiToken: '' },
    hangar: { apiKey: '' },
    github: { enabled: true, gistUrl: DEFAULT_GITHUB_GIST_URL },
    communityProviders: []
};
const LOADING_SPINNER_SRC = '/static/images/loading-spinner.svg';

function interpolateTemplate(value, variables = {}) {
    let out = String(value || '');
    if (!out) return '';
    out = out.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (m, k) => {
        const v = variables[k];
        return v === undefined || v === null || v === '' ? m : String(v);
    });
    out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, k) => {
        const v = variables[k];
        return v === undefined || v === null || v === '' ? m : String(v);
    });
    out = out.replace(/%\{([a-zA-Z0-9_]+)\}/g, (m, k) => {
        const v = variables[k];
        return v === undefined || v === null || v === '' ? m : String(v);
    });
    return out;
}

function getProviderPlaceholder(mod) {
    const provider = String(mod?.provider || '').trim().toLowerCase();
    const providerName = String(mod?.providerName || '').trim().toLowerCase();
    const serverType = String(mod?.metadata?.serverType || mod?.serverType || '').trim().toLowerCase();

    if (provider.includes('github') || providerName.includes('github')) return '/static/images/github.svg';
    if (provider === 'spigot' || provider === 'spiget' || provider === 'spigotmc' || providerName.includes('spigot')) return '/static/images/spigot.svg';
    if (provider === 'hangar' || providerName === 'hangar') return '/static/images/hangar.svg';
    if (provider === 'smithed' || providerName === 'smithed') return '/static/images/smithed.svg';
    if (provider === 'fabric' || serverType === 'fabric') return '/static/images/fabric.svg';
    if (provider === 'forge' || serverType === 'forge') return '/static/images/forge.svg';
    if (provider === 'neoforge' || serverType === 'neoforge') return '/static/images/neoforge.svg';
    return '';
}

function normalizeCustomProviderId(input, fallbackIndex = 0) {
    const base = String(input || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return base || `custom-provider-${fallbackIndex + 1}`;
}

function normalizeProviderSettings(modProviders) {
    const source = modProviders || {};
    const communityRaw = Array.isArray(source.communityProviders)
        ? source.communityProviders
        : (Array.isArray(source.customProviders) ? source.customProviders : []);
    const communityProviders = communityRaw
        .map((provider, index) => {
            const name = String(provider?.name || '').trim();
            const gistUrl = String(provider?.gistUrl || '').trim();
            if (!name || !gistUrl) return null;
            return {
                id: normalizeCustomProviderId(provider.id || name, index),
                name,
                type: 'github',
                gistUrl,
                enabled: provider?.enabled !== false
            };
        })
        .filter(Boolean);

    return {
        ...DEFAULT_PROVIDER_SETTINGS,
        ...source,
        curseforge: {
            ...DEFAULT_PROVIDER_SETTINGS.curseforge,
            ...(source.curseforge || {})
        },
        modrinth: {
            ...DEFAULT_PROVIDER_SETTINGS.modrinth,
            ...(source.modrinth || {})
        },
        hangar: {
            ...DEFAULT_PROVIDER_SETTINGS.hangar,
            ...(source.hangar || {})
        },
        github: {
            ...DEFAULT_PROVIDER_SETTINGS.github,
            ...(source.github || {})
        },
        communityProviders,
        customProviders: communityProviders
    };
}

function getProviderBadgeLabel(mod) {
    const providerName = String(mod?.providerName || '').trim();
    if (providerName) return providerName;
    const key = String(mod?.provider || '').toLowerCase();
    if (key === 'curseforge') return 'CurseForge';
    if (key === 'modrinth') return 'Modrinth';
    if (key === 'hangar') return 'Hangar';
    if (key === 'github') return 'Github';
    if (!key) return 'Manual';
    return key.charAt(0).toUpperCase() + key.slice(1);
}

function getServerMode(serverType) {
    const normalized = String(serverType || '').toLowerCase();
    if (PLUGIN_SERVER_TYPES.has(normalized)) return 'plugin';
    if (MODDED_SERVER_TYPES.has(normalized)) return 'modded';
    return 'vanilla';
}

function getLogoWithFallback(mod) {
    return mod?.logo || getProviderPlaceholder(mod) || '';
}

function applyProviderFallbackOnError(event, mod) {
    const providerFallback = getProviderPlaceholder(mod);
    const img = event.currentTarget;
    const currentSrc = String(img.getAttribute('src') || '');
    if (img.dataset.fallbackApplied === '1') return;
    img.dataset.fallbackApplied = '1';
    if (providerFallback && currentSrc !== providerFallback) {
        img.src = providerFallback;
        return;
    }
    img.src = '/static/images/github.svg';
}

function padToLength(items, targetLength) {
    if (items.length >= targetLength) return items;
    return [...items, ...Array(targetLength - items.length).fill(null)];
}


function EmptySlotCard({ label }) {
    return (
        <div className="card" aria-hidden="true" style={{
                margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                alignItems: 'center', height: `${GRID_CARD_HEIGHT_PX}px`,
                border: '1px dashed var(--border-color)', background: 'var(--bg-secondary)',
                color: 'var(--text-muted)', textAlign: 'center', gap: '8px'
            }}>
            <Package size={22} />
            <small>{label}</small>
        </div>
    );
}

function PluginsPage({ resourceType = 'plugin' }) {
    const normalizedResourceType = String(resourceType || 'plugin').toLowerCase() === 'mod' ? 'mod' : 'plugin';
    const isModsPage = normalizedResourceType === 'mod';
    const resourceLabel = isModsPage ? 'mods' : 'plugins';
    const resourceLabelTitle = isModsPage ? 'Mods' : 'Plugins';
    const browseLabel = isModsPage ? 'Browse Mods' : 'Browse Plugins';
    const disabledForVanillaMessage = isModsPage ? 'Mods Disabled for Vanilla' : 'Plugins Disabled for Vanilla';
    const disabledForVanillaBody = isModsPage
        ? 'Vanilla servers do not support mods in this panel mode. Change server type to a modded type in Settings.'
        : 'Vanilla servers do not support plugins in this panel mode. Change server type to a plugin server type in Settings.';

    const dialog = useDialog();
    const [activeTab, setActiveTab] = useState('installed'); // installed | browse

    // Installed State
    const [localPlugins, setLocalPlugins] = useState([]);
    const [loadingLocal, setLoadingLocal] = useState(false);

    // Browse State
    const [provider, setProvider] = useState('CurseForge');
    const [providers, setProviders] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [installingModId, setInstallingModId] = useState(null); // Track installing state
    const [searchPage, setSearchPage] = useState(1);
    const [searchHasMore, setSearchHasMore] = useState(false);
    const searchPageSize = 12;
    const [searchFilters, setSearchFilters] = useState({
        serverType: '',
        serverVersion: ''
    });

    // Installed list pagination
    const [installedPage, setInstalledPage] = useState(1);
    const installedPageSize = 12;

    // Providers Config State
    const [providerSettings, setProviderSettings] = useState(DEFAULT_PROVIDER_SETTINGS);

    // Upload State
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const latestSearchRequestRef = useRef(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dependencyModal, setDependencyModal] = useState({
        open: false,
        title: '',
        rows: [],
        running: false,
        done: false,
        targetMod: null
    });

    // --- Init ---
    useEffect(() => {
        loadSettings();
    }, []);

    const loadProviders = useCallback(async (serverType) => {
        try {
            const response = await pluginAPI.providers({ serverType, resourceType: normalizedResourceType });
            const names = Array.isArray(response.data?.providers) ? response.data.providers : [];
            setProviders(names);
            setProvider((current) => {
                if (names.length === 0) return '';
                if (current && names.includes(current)) return current;
                return names[0];
            });
        } catch (err) {
            console.error('Failed to load providers', err);
            setProviders([]);
            setProvider('');
        }
    }, []);

    const loadSettings = async () => {
        try {
            const settings = await settingsAPI.getPanelSettings();
            const normalizedType = String(settings.serverType || '').toLowerCase();
            setProviderSettings(normalizeProviderSettings(settings.modProviders));
            setSearchFilters({
                serverType: normalizedType,
                serverVersion: settings.serverVersion || ''
            });
            await loadProviders(normalizedType);
        } catch (err) {
            console.error("Failed to load settings", err);
        }
    };

    useEffect(() => {
        loadProviders(searchFilters.serverType);
    }, [searchFilters.serverType, loadProviders]);

    // --- Local Mods Logic ---
    const loadLocalPlugins = useCallback(async () => {
        setLoadingLocal(true);
        try {
            const response = await pluginAPI.list(normalizedResourceType);
            setLocalPlugins(response.data);
            setInstalledPage(1);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingLocal(false);
        }
    }, [normalizedResourceType]);

    useEffect(() => {
        if (activeTab === 'installed') {
            loadLocalPlugins();
        }
    }, [activeTab, loadLocalPlugins]);

    const handleDelete = async (name) => {
        const confirmed = await dialog.showConfirm(`Delete ${isModsPage ? 'mod' : 'plugin'} '${name}'?`, `Delete ${isModsPage ? 'Mod' : 'Plugin'}`);
        if (!confirmed) return;
        try {
            await pluginAPI.delete(name, normalizedResourceType);
            loadLocalPlugins();
        } catch (err) {
            dialog.showAlert("Failed to delete: " + err.message);
        }
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        await processUploads(files);
        e.target.value = null;
    };

    const processUploads = async (files) => {
        setUploading(true);
        for (const file of files) {
            if (!file.name.toLowerCase().endsWith('.jar')) {
                dialog.showAlert(`Skipped ${file.name}: Only .jar files are allowed.`);
                continue;
            }
            try {
                await pluginAPI.upload(file, normalizedResourceType);
            } catch (err) {
                console.error(err);
                dialog.showAlert(`Failed to upload ${file.name}`);
            }
        }
        setUploading(false);
        loadLocalPlugins();
    };

    // Drag & Drop Handlers
    const onDragOver = (e) => {
        e.preventDefault();
        if (activeTab === 'installed') setIsDragging(true);
    };

    const onDragLeave = (e) => {
        e.preventDefault();
        if (activeTab === 'installed') setIsDragging(false);
    };

    const onDrop = async (e) => {
        e.preventDefault();
        if (activeTab !== 'installed') return;
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length === 0) return;

        await processUploads(droppedFiles);
    };


    // --- Search Logic ---
    const handleSearch = async (e, targetPage = 1) => {
        e?.preventDefault();
        if (!provider) {
            setSearchResults([]);
            setSearchHasMore(false);
            return;
        }
        const safeTargetPage = Math.max(1, Number.parseInt(targetPage, 10) || 1);
        const requestId = latestSearchRequestRef.current + 1;
        latestSearchRequestRef.current = requestId;
        setLoadingSearch(true);
        try {
            const response = await pluginAPI.search(provider, searchQuery, {
                page: safeTargetPage,
                pageSize: searchPageSize,
                serverType: searchFilters.serverType,
                serverVersion: searchFilters.serverVersion,
                resourceType: normalizedResourceType
            });

            if (latestSearchRequestRef.current !== requestId) {
                return;
            }

            const payload = response.data || {};
            setSearchResults(payload.items || payload || []);
            setSearchHasMore(Boolean(payload.hasMore));
            setSearchPage(Number(payload.page || safeTargetPage));
        } catch (err) {
            dialog.showAlert("Search failed: " + err.message);
        } finally {
            if (latestSearchRequestRef.current === requestId) {
                setLoadingSearch(false);
            }
        }
    };

    const buildInstallPayload = async (mod, depList = []) => {
        let downloadUrl = mod.downloadUrl;

        if (!downloadUrl) {
            const res = await pluginAPI.getDownloadUrl(provider, mod.id, mod.latestFileId, {
                serverType: searchFilters.serverType,
                serverVersion: searchFilters.serverVersion,
                resourceType: normalizedResourceType
            });
            if (res.data.url) downloadUrl = res.data.url;
        }

        if (!downloadUrl) {
            throw new Error("Could not retrieve download URL.");
        }

        const safeName = String(mod.latestFileName || `${mod.name}.jar`).trim();
        const metadata = {
            modId: mod.id,
            name: mod.name,
            version: mod?.metadata?.version || mod?.version || '',
            logo: mod.logo,
            summary: mod.summary,
            websiteUrl: mod.websiteUrl,
            provider: (mod.provider || provider || 'manual').toLowerCase(),
            providerName: mod.providerName || provider || '',
            serverType: searchFilters.serverType,
            serverVersion: searchFilters.serverVersion,
            resourceType: normalizedResourceType,
            dependencies: depList
        };

        return { downloadUrl, safeName, metadata };
    };

    const resolveDependencyCard = async (dep) => {
        const depId = String(dep?.id || '').trim();
        if (!depId) return null;
        const directUrl = String(dep?.directDownloadUrl || dep?.downloadUrl || dep?.url || '').trim();
        if (directUrl) {
            const resolvedUrl = interpolateTemplate(directUrl, {
                id: depId,
                name: dep?.name || depId,
                version: dep?.version || '',
                minecraftVersion: dep?.minecraftVersion || dep?.minecraftversion || ''
            });
            return {
                id: depId,
                name: dep?.name || depId,
                author: dep?.author || null,
                logo: dep?.image || dep?.logo || null,
                summary: dep?.description || dep?.summary || null,
                websiteUrl: dep?.websiteUrl || null,
                downloadUrl: resolvedUrl,
                latestFileName: dep?.latestFileName || `${dep?.name || depId}.jar`,
                provider: String(dep?.provider || dep?.providerName || provider || 'manual').toLowerCase(),
                providerName: dep?.providerName || dep?.provider || provider || ''
            };
        }
        const depProvider = String(dep?.provider || dep?.providerName || provider || '').trim();
        const response = await pluginAPI.search(depProvider, depId, {
            page: 1,
            pageSize: 25,
            serverType: searchFilters.serverType,
            serverVersion: searchFilters.serverVersion,
            resourceType: normalizedResourceType
        });
        const rows = Array.isArray(response.data?.items) ? response.data.items : (Array.isArray(response.data) ? response.data : []);
        return rows.find((row) => String(row?.id || '') === depId)
            || rows.find((row) => String(row?.id || '').toLowerCase().includes(depId.toLowerCase()))
            || null;
    };

    const installSingle = async (mod, depList = []) => {
        const payload = await buildInstallPayload(mod, depList);
        await pluginAPI.installRemote(payload.downloadUrl, payload.safeName, payload.metadata);
        return payload;
    };

    const verifyDependencyInstalled = async (depCard, depId, attempts = 2) => {
        const wantedId = String(depId || depCard?.id || '').trim().toLowerCase();
        const wantedName = String(depCard?.name || '').trim().toLowerCase();
        const wantedFile = String(depCard?.latestFileName || '').trim().toLowerCase();

        for (let i = 0; i < attempts; i += 1) {
            try {
                const response = await pluginAPI.list(normalizedResourceType);
                const installed = Array.isArray(response.data) ? response.data : [];
                const found = installed.some((item) => {
                    const itemId = String(item?.modId || '').trim().toLowerCase();
                    const itemDisplay = String(item?.displayName || '').trim().toLowerCase();
                    const itemFile = String(item?.name || '').trim().toLowerCase();
                    return (wantedId && itemId === wantedId)
                        || (wantedName && itemDisplay === wantedName)
                        || (wantedName && itemFile.replace(/\.jar$/i, '') === wantedName.replace(/\.jar$/i, ''))
                        || (wantedFile && itemFile === wantedFile);
                });
                if (found) return true;
            } catch {
                // keep retrying best-effort
            }
            if (i < attempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, 450));
            }
        }
        return false;
    };

    const runDependencyInstallFlow = async () => {
        const targetMod = dependencyModal.targetMod;
        if (!targetMod) return;
        const dependencies = Array.isArray(targetMod.dependencies) ? targetMod.dependencies.filter((d) => String(d?.id || '').trim()) : [];
        const nextRows = dependencyModal.rows.map((row) => ({ ...row }));

        setDependencyModal((prev) => ({ ...prev, running: true }));
        try {
            for (let i = 0; i < nextRows.length; i += 1) {
                nextRows[i] = { ...nextRows[i], status: 'installing', message: '' };
                setDependencyModal((prev) => ({ ...prev, rows: [...nextRows] }));
                const depRef = dependencies[i];
                const depCard = await resolveDependencyCard(depRef);
                if (!depCard) {
                    nextRows[i] = { ...nextRows[i], status: 'failed', message: '' };
                    setDependencyModal((prev) => ({ ...prev, rows: [...nextRows] }));
                    continue;
                }

                const alreadyInstalled = await verifyDependencyInstalled(depCard, depRef?.id || nextRows[i]?.id, 1);
                if (alreadyInstalled) {
                    nextRows[i] = { ...nextRows[i], status: 'installed', message: 'Already installed' };
                    setDependencyModal((prev) => ({ ...prev, rows: [...nextRows] }));
                    continue;
                }

                try {
                    await installSingle(depCard, []);
                    nextRows[i] = { ...nextRows[i], status: 'installed', message: 'Installed' };
                } catch {
                    const verifiedInstalled = await verifyDependencyInstalled(depCard, depRef?.id || nextRows[i]?.id, 3);
                    nextRows[i] = verifiedInstalled
                        ? { ...nextRows[i], status: 'installed', message: 'Installed (already present)' }
                        : { ...nextRows[i], status: 'failed', message: '' };
                }
                setDependencyModal((prev) => ({ ...prev, rows: [...nextRows] }));
            }

            await installSingle(targetMod, dependencies);
            setDependencyModal((prev) => ({ ...prev, running: false, done: true }));
            loadLocalPlugins();
            window.setTimeout(() => {
                setDependencyModal({ open: false, title: '', rows: [], running: false, done: false, targetMod: null });
            }, 500);
        } catch (err) {
            setDependencyModal((prev) => ({ ...prev, running: false }));
            dialog.showAlert("Installation failed: " + err.message);
        } finally {
            setInstallingModId(null);
        }
    };

    const handleInstall = async (mod) => {
        setInstallingModId(mod.id);
        const dependencies = Array.isArray(mod.dependencies) ? mod.dependencies.filter((d) => String(d?.id || '').trim()) : [];
        if (dependencies.length === 0) {
            try {
                await installSingle(mod, []);
                loadLocalPlugins();
            } catch (err) {
                dialog.showAlert("Installation failed: " + err.message);
            } finally {
                setInstallingModId(null);
            }
            return;
        }

        const rows = dependencies.map((dep) => ({
            id: String(dep.id),
            provider: String(dep.provider || dep.providerName || provider || ''),
            status: 'pending',
            message: 'Ready'
        }));
        setDependencyModal({
            open: true,
            title: `Installing dependencies for ${mod.name}`,
            rows,
            running: false,
            done: false,
            targetMod: mod
        });
    };

    // Helper to check if a mod is installed
    const isInstalled = (modId) => {
        return localPlugins.some(p => p.modId === modId);
    };

    const installedTotalPages = Math.max(1, Math.ceil(localPlugins.length / installedPageSize));
    const installedStart = (installedPage - 1) * installedPageSize;
    const pagedLocalPlugins = localPlugins.slice(installedStart, installedStart + installedPageSize);
    const serverMode = getServerMode(searchFilters.serverType);
    const installedCards = pagedLocalPlugins;
    const searchCards = searchResults.length > 0 ? padToLength(searchResults, searchPageSize) : [];

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div className="dashboard-header" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'
            }}>
                <div>
                    <h1 className="page-title">{resourceLabelTitle} Manager</h1>
                    <p className="page-subtitle">Manage your server's {resourceLabel}</p>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex', gap: '8px', background: 'var(--bg-secondary)',
                    padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)'
                }}>
                    <button
                        className={`btn ${activeTab === 'installed' ? 'btn-primary' : 'btn-ghost'}`}
                        style={activeTab !== 'installed' ? { background: 'transparent', border: 'none', color: 'var(--text-secondary)' } : {}}
                        onClick={() => setActiveTab('installed')}
                    >
                        Installed
                    </button>
                    <button
                        className={`btn ${activeTab === 'browse' ? 'btn-primary' : 'btn-ghost'}`}
                        style={activeTab !== 'browse' ? { background: 'transparent', border: 'none', color: 'var(--text-secondary)' } : {}}
                        onClick={() => setActiveTab('browse')}
                    >
                        {browseLabel}
                    </button>
                </div>
            </div>

            {/* Content Area with Drag & Drop */}
            <div
                style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                {/* Drop Overlay */}
                {isDragging && activeTab === 'installed' && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 10,
                        background: 'rgba(0,0,0,0.8)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        color: 'white', pointerEvents: 'none'
                    }}>
                        <Upload size={64} style={{ marginBottom: '1rem' }} />
                        <h2>Drop Jar files to install</h2>
                    </div>
                )}

                {/* INSTALLED TAB */}
                {activeTab === 'installed' && (
                    <>
                        <div className="card" style={{ padding: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--text-secondary)' }}>
                                <Package size={24} />
                                <span>
                                    <strong>{localPlugins.length}</strong> {resourceLabel} installed
                                </span>
                            </div>
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".jar"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                />
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                >
                                    {uploading ? 'Uploading...' : <><Upload size={18} /> Upload Jar</>}
                                </button>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gap: '20px'
                        }}>
                            {installedCards.map((mod) => mod ? (
                                <div key={mod.name} className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', height: `${GRID_CARD_HEIGHT_PX}px`, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {getLogoWithFallback(mod) ? (
                                            <img src={getLogoWithFallback(mod)} alt={mod.displayName} onError={(e) => applyProviderFallbackOnError(e, mod)} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{
                                                width: '40px', height: '40px', background: 'var(--bg-primary)',
                                                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'var(--accent-gold)'
                                            }}>
                                                <Package size={20} />
                                            </div>
                                        )}
                                        <div style={{ overflow: 'hidden' }}>
                                            <h4 style={{ margin: 0, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {mod.websiteUrl ? (
                                                    <a
                                                        href={mod.websiteUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ color: 'inherit', textDecoration: 'none' }}
                                                        onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                                        onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                                                        title="Open Website"
                                                    >
                                                        {mod.displayName || mod.name} <ExternalLink size={10} style={{ marginLeft: '4px', opacity: 0.7 }} />
                                                    </a>
                                                ) : (
                                                    mod.displayName || mod.name
                                                )}
                                            </h4>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <small title={mod.name} style={{ cursor: 'help' }}>{(mod.size / 1024 / 1024).toFixed(2)} MB</small>
                                                {mod.websiteUrl && (
                                                    <a href={mod.websiteUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-gold)', display: 'flex', alignItems: 'center' }} title="View on CurseForge">
                                                        <ExternalLink size={12} />
                                                    </a>
                                                )}
                                                <span style={{
                                                    fontSize: '11px',
                                                    background: 'rgba(255, 255, 255, 0.1)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-muted)'
                                                }}>
                                                    {getProviderBadgeLabel(mod)}
                                                </span>
                                            </div>
                                            {mod.description && (
                                                <p style={{
                                                    fontSize: '12px', color: 'var(--text-secondary)',
                                                    margin: '4px 0 0 0',
                                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                                                }}>
                                                    {mod.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(mod.name)}
                                        className="btn btn-danger"
                                        style={{ marginTop: 'auto', width: '100%', padding: '8px' }}
                                    >
                                        <Trash2 size={16} /> Uninstall
                                    </button>
                                </div>
                            ) : null)}
                        </div>
                        {localPlugins.length === 0 && !loadingLocal && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                No {resourceLabel} installed. Upload one or browse providers.
                            </div>
                        )}
                        {localPlugins.length > installedPageSize && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
                                <button
                                    className="btn btn-secondary"
                                    disabled={installedPage <= 1}
                                    onClick={() => setInstalledPage((p) => Math.max(1, p - 1))}
                                >
                                    Previous
                                </button>
                                <span style={{ color: 'var(--text-secondary)' }}>Page {installedPage} / {installedTotalPages}</span>
                                <button
                                    className="btn btn-secondary"
                                    disabled={installedPage >= installedTotalPages}
                                    onClick={() => setInstalledPage((p) => Math.min(installedTotalPages, p + 1))}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* BROWSE TAB */}
                {activeTab === 'browse' && (
                    <>
                        {serverMode === 'vanilla' ? (
                            <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                                <h3 style={{ marginBottom: '8px' }}>{disabledForVanillaMessage}</h3>
                                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                    {disabledForVanillaBody}
                                </p>
                            </div>
                        ) : (
                        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
                            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
                                <select
                                    id="provider-select"
                                    name="provider"
                                    value={provider}
                                    onChange={(e) => {
                                        setProvider(e.target.value);
                                        setSearchPage(1);
                                    }}
                                    style={{ width: 'auto', minWidth: '150px' }}
                                    disabled={providers.length === 0}
                                >
                                    {providers.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                                <input
                                    id="provider-search-query"
                                    name="query"
                                    type="text"
                                    placeholder={`Search ${resourceLabel}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <input
                                    id="provider-server-version"
                                    name="serverVersion"
                                    type="text"
                                    placeholder="Version (e.g. 1.21.1)"
                                    value={searchFilters.serverVersion}
                                    onChange={(e) => setSearchFilters((prev) => ({ ...prev, serverVersion: e.target.value }))}
                                    style={{ maxWidth: '180px' }}
                                />
                                <div style={{ alignSelf: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                    Type: <strong>{searchFilters.serverType || 'vanilla'}</strong>
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={loadingSearch}>
                                    {loadingSearch ? (
                                        <><img src={LOADING_SPINNER_SRC} alt="Loading" style={{ width: '16px', height: '16px' }} /> Searching...</>
                                    ) : (
                                        <><Search size={18} /> Search</>
                                    )}
                                </button>
                            </form>
                            {provider === 'CurseForge' && !providerSettings.curseforge?.apiKey && (
                                <div className="alert alert-warning" style={{ marginTop: '10px', fontSize: '14px' }}>
                                    <strong>Demo Mode:</strong> CurseForge API key is missing. Configure it in Settings &gt; Provider APIs.
                                    <br />
                                    <a href="/settings" style={{ color: 'var(--accent-gold)' }}>Open Settings</a>
                                </div>
                            )}
                        </div>
                        )}

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gap: '20px'
                        }}>
                            {searchCards.map((mod, index) => {
                                if (!mod) {
                                    return <EmptySlotCard key={`search-placeholder-${index}`} label="No more results" />;
                                }
                                const installed = isInstalled(mod.id);
                                return (
                                    <div key={mod.id} className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', height: `${GRID_CARD_HEIGHT_PX}px`, overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <div style={{ width: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                {getLogoWithFallback(mod) ? (
                                                    <img src={getLogoWithFallback(mod)} alt={mod.name} onError={(e) => applyProviderFallbackOnError(e, mod)} style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '64px', height: '64px', background: 'var(--bg-primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Layers size={32} color="var(--text-muted)" />
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <h3 style={{
                                                    margin: '0 0 4px 0',
                                                    fontSize: '16px',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {mod.websiteUrl ? (
                                                        <a
                                                            href={mod.websiteUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{ color: 'inherit', textDecoration: 'none' }}
                                                            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                                            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                                                            title="View on provider site"
                                                        >
                                                            {mod.name} <ExternalLink size={12} style={{ marginLeft: '4px', opacity: 0.7 }} />
                                                        </a>
                                                    ) : (
                                                        mod.name
                                                    )}
                                                </h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <small style={{ color: 'var(--text-muted)' }}>by {mod.author}</small>
                                                {mod?.metadata?.minecraftVersion && (
                                                        <small style={{
                                                            fontSize: '11px',
                                                            background: 'rgba(255,255,255,0.08)',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            color: 'var(--text-secondary)'
                                                        }}>
                                                            MC {mod.metadata.minecraftVersion}
                                                        </small>
                                                    )}
                                                    {mod?.metadata?.version && (
                                                        <small style={{
                                                            fontSize: '11px',
                                                            background: 'rgba(255,255,255,0.08)',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            color: 'var(--text-secondary)'
                                                        }}>
                                                            v{mod.metadata.version}
                                                        </small>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <p style={{
                                            fontSize: '13px', color: 'var(--text-secondary)',
                                            display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden', textOverflow: 'ellipsis', flex: 1
                                        }}>
                                            {mod.summary}
                                        </p>
                                        {Array.isArray(mod.dependencies) && mod.dependencies.length > 0 && (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                Dependencies: {mod.dependencies.map((d) => d.id).join(', ')}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                                            <button
                                                onClick={() => {
                                                    if (!installed) handleInstall(mod);
                                                }}
                                                className={`btn ${installed ? 'btn-secondary' : 'btn-primary'}`}
                                                style={{ flex: 1 }}
                                                disabled={installingModId === mod.id || installed}
                                            >
                                                {installingModId === mod.id ? (
                                                    <><img src={LOADING_SPINNER_SRC} alt="Installing" style={{ width: '16px', height: '16px' }} /> Installing...</>
                                                ) : installed ? (
                                                    <><Package size={16} /> Installed</>
                                                ) : (
                                                    <><Download size={16} /> Install</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {serverMode !== 'vanilla' && (searchPage > 1 || searchHasMore) && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
                                <button
                                    className="btn btn-secondary"
                                    disabled={searchPage <= 1 || loadingSearch}
                                    onClick={() => handleSearch(null, Math.max(1, searchPage - 1))}
                                >
                                    Previous
                                </button>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    Page {searchPage}
                                </span>
                                <button
                                    className="btn btn-secondary"
                                    disabled={!searchHasMore || loadingSearch}
                                    onClick={() => handleSearch(null, searchPage + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}

            </div>

            {dependencyModal.open && (
                <div className="modal-overlay" style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1100,
                    background: 'rgba(0,0,0,0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '560px' }}>
                        <h3 style={{ marginTop: 0 }}>{dependencyModal.title}</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            This window stays locked until all dependencies are installed.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                            {dependencyModal.rows.map((row) => (
                                <div key={row.id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '8px 10px'
                                }}>
                                    <span>{row.id}</span>
                                    <span style={{ color: row.status === 'installed' ? '#86efac' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        {(row.status !== 'installed' && row.status !== 'pending') && (
                                            <img src={LOADING_SPINNER_SRC} alt="Loading" style={{ width: '14px', height: '14px' }} />
                                        )}
                                        {row.message}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                            <button
                                className="btn btn-primary"
                                style={{ background: '#2f9e44', borderColor: '#2f9e44' }}
                                disabled={dependencyModal.running}
                                onClick={runDependencyInstallFlow}
                            >
                                {dependencyModal.running ? 'Installing...' : (dependencyModal.done ? 'Installed' : 'Install')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PluginsPage;
