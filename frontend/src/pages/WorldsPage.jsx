import { useEffect, useState } from 'react';
import { RefreshCw, Search, Download, ExternalLink, Package, Trash2 } from 'lucide-react';
import { pluginAPI, worldAPI } from '../services/api';
import * as settingsAPI from '../services/settingsApi';
import { useDialog } from '../contexts/DialogContext';
import './WorldsPage.css';

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

function getDatapackPlaceholder(item) {
  const provider = String(item?.provider || '').trim().toLowerCase();
  const providerName = String(item?.providerName || '').trim().toLowerCase();
  if (provider.includes('github') || providerName.includes('github')) return '/static/images/github.svg';
  if (provider === 'smithed' || providerName === 'smithed') return '/static/images/smithed.svg';
  return '/static/images/github.svg';
}

function WorldsPage() {
  const dialog = useDialog();
  const [worldMeta, setWorldMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('installed'); // installed | browse

  const [detail, setDetail] = useState(null);

  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState('CurseForge');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [installingId, setInstallingId] = useState(null);
  const [uninstallingName, setUninstallingName] = useState('');
  const [serverVersion, setServerVersion] = useState('');
  const searchPageSize = 12;
  const [dependencyModal, setDependencyModal] = useState({
    open: false,
    title: '',
    rows: [],
    running: false,
    done: false,
    targetItem: null
  });

  const fetchWorld = async () => {
    setLoading(true);
    try {
      const response = await worldAPI.list();
      const worlds = Array.isArray(response.data) ? response.data : [];
      const mainWorld = worlds[0] || null;
      setWorldMeta(mainWorld);
      setError('');
    } catch (err) {
      console.error('Failed to fetch world:', err);
      setWorldMeta(null);
      setError('Could not load world. Ensure the server path is correct.');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorldDetail = async (worldName) => {
    if (!worldName) return;
    try {
      const response = await worldAPI.get(worldName);
      const payload = response.data;
      setDetail(payload);
    } catch (err) {
      console.error('Failed to load world details:', err);
      setDetail(null);
      dialog.showAlert(`Failed to load world details: ${err.message}`);
    }
  };

  const loadDatapackProviders = async () => {
    try {
      const response = await pluginAPI.providers({ resourceType: 'datapack' });
      const names = Array.isArray(response.data?.providers) ? response.data.providers : [];
      setProviders(names);
      setProvider((prev) => (prev && names.includes(prev) ? prev : (names[0] || '')));
    } catch (err) {
      setProviders([]);
      setProvider('');
      console.error('Failed to load datapack providers', err);
    }
  };

  useEffect(() => {
    fetchWorld();
    loadDatapackProviders();
    settingsAPI.getPanelSettings().then((s) => setServerVersion(String(s.serverVersion || ''))).catch(() => { });
  }, []);

  useEffect(() => {
    if (worldMeta?.name) {
      fetchWorldDetail(worldMeta.name);
    }
  }, [worldMeta?.name]);

  const onSearchDatapacks = async (e, targetQuery = searchQuery, targetPage = 1) => {
    e?.preventDefault();
    if (!provider) return;
    setSearchLoading(true);
    try {
      const response = await pluginAPI.search(provider, targetQuery, {
        resourceType: 'datapack',
        serverVersion,
        page: targetPage,
        pageSize: searchPageSize
      });
      const payload = response.data || {};
      setResults(Array.isArray(payload.items) ? payload.items : []);
      setSearchPage(targetPage);
      setSearchHasMore(Boolean(payload.hasMore));
    } catch (err) {
      dialog.showAlert(`Datapack search failed: ${err.message}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const onInstallDatapack = async (item) => {
    const targetWorldName = worldMeta?.name || 'world';
    setInstallingId(item.id);
    const deps = Array.isArray(item.dependencies) ? item.dependencies.filter((d) => String(d?.id || '').trim()) : [];
    if (deps.length > 0) {
      setDependencyModal({
        open: true,
        title: `Installing dependencies for ${item.name}`,
        rows: deps.map((dep) => ({ id: String(dep.id), status: 'pending', message: 'Ready' })),
        running: false,
        done: false,
        targetItem: item
      });
      return;
    }
    try {
      let downloadUrl = item.downloadUrl;
      if (!downloadUrl) {
        const link = await pluginAPI.getDownloadUrl(provider, item.id, item.latestFileId, {
          resourceType: 'datapack',
          serverVersion
        });
        downloadUrl = link.data?.url;
      }

      if (!downloadUrl) throw new Error('No download URL available for this datapack.');

      const rawName = (item.latestFileName || `${item.name}.zip`).replace(/[^a-z0-9._-]/gi, '_');
      const filename = /\.zip$/i.test(rawName)
        ? rawName
        : (/\.jar$/i.test(rawName) ? rawName.replace(/\.jar$/i, '.zip') : `${rawName}.zip`);
      await worldAPI.installDatapack(targetWorldName, downloadUrl, filename, {
        modId: item.id,
        name: item.name,
        author: item.author || null,
        logo: item.logo || null,
        summary: item.summary || null,
        websiteUrl: item.websiteUrl || null,
        provider: (item.provider || provider || 'manual').toLowerCase(),
        providerName: item.providerName || provider || 'Datapack',
        serverVersion,
        resourceType: 'datapack',
        dependencies: Array.isArray(item.dependencies) ? item.dependencies : []
      });

      await fetchWorldDetail(targetWorldName);
      setActiveTab('installed');
      dialog.showAlert(`Installed datapack "${item.name}" in ${targetWorldName}.`, 'Success');
    } catch (err) {
      const backendError = err?.response?.data?.error;
      dialog.showAlert(`Failed to install datapack: ${backendError || err.message}`);
    } finally {
      setInstallingId(null);
    }
  };

  const runDatapackDependencyInstallFlow = async () => {
    const targetItem = dependencyModal.targetItem;
    if (!targetItem) return;
    const deps = Array.isArray(targetItem.dependencies) ? targetItem.dependencies.filter((d) => String(d?.id || '').trim()) : [];
    const rows = dependencyModal.rows.map((r) => ({ ...r }));
    const targetWorldName = worldMeta?.name || 'world';
    setDependencyModal((prev) => ({ ...prev, running: true }));

    try {
      for (let i = 0; i < deps.length; i += 1) {
        rows[i] = { ...rows[i], status: 'installing', message: 'Installing...' };
        setDependencyModal((prev) => ({ ...prev, rows: [...rows] }));

        let depCard = null;
        try {
          const directUrl = String(deps[i]?.directDownloadUrl || deps[i]?.downloadUrl || deps[i]?.url || '').trim();
          if (directUrl) {
            const resolvedUrl = interpolateTemplate(directUrl, {
              id: String(deps[i].id || ''),
              name: String(deps[i].name || deps[i].id || ''),
              version: String(deps[i].version || ''),
              minecraftVersion: String(deps[i].minecraftVersion || deps[i].minecraftversion || '')
            });
            depCard = {
              id: String(deps[i].id),
              name: deps[i].name || deps[i].id,
              downloadUrl: resolvedUrl,
              latestFileName: deps[i].latestFileName || `${deps[i].name || deps[i].id}.zip`,
              provider: String(deps[i].provider || deps[i].providerName || provider || 'manual').toLowerCase(),
              providerName: deps[i].providerName || deps[i].provider || provider || 'Datapack'
            };
          } else {
            const providerName = String(deps[i].provider || deps[i].providerName || provider || '').trim();
            const resp = await pluginAPI.search(providerName, deps[i].id, {
              resourceType: 'datapack',
              serverVersion,
              page: 1,
              pageSize: 25
            });
            const items = Array.isArray(resp.data?.items) ? resp.data.items : (Array.isArray(resp.data) ? resp.data : []);
            depCard = items.find((x) => String(x?.id || '') === String(deps[i].id))
              || items.find((x) => String(x?.id || '').toLowerCase().includes(String(deps[i].id || '').toLowerCase()))
              || null;
          }
        } catch {
          depCard = null;
        }

        if (!depCard) {
          rows[i] = { ...rows[i], status: 'failed', message: 'Not found (continuing)' };
          setDependencyModal((prev) => ({ ...prev, rows: [...rows] }));
          continue;
        }

        try {
          let depUrl = depCard.downloadUrl;
          if (!depUrl) {
            const link = await pluginAPI.getDownloadUrl(provider, depCard.id, depCard.latestFileId, {
              resourceType: 'datapack',
              serverVersion
            });
            depUrl = link.data?.url;
          }
          if (!depUrl) throw new Error('Missing dependency URL');
          const rawDepName = (depCard.latestFileName || `${depCard.name}.zip`).replace(/[^a-z0-9._-]/gi, '_');
          const depFilename = /\.zip$/i.test(rawDepName)
            ? rawDepName
            : (/\.jar$/i.test(rawDepName) ? rawDepName.replace(/\.jar$/i, '.zip') : `${rawDepName}.zip`);
          await worldAPI.installDatapack(targetWorldName, depUrl, depFilename, {
            modId: depCard.id,
            name: depCard.name,
            provider: (depCard.provider || provider || 'manual').toLowerCase(),
            providerName: depCard.providerName || provider || 'Datapack',
            serverVersion,
            resourceType: 'datapack',
            dependencies: []
          });
          rows[i] = { ...rows[i], status: 'installed', message: 'Installed' };
        } catch {
          rows[i] = { ...rows[i], status: 'failed', message: 'Install failed (continuing)' };
        }
        setDependencyModal((prev) => ({ ...prev, rows: [...rows] }));
      }

      await onInstallDatapack({ ...targetItem, dependencies: [] });
      setDependencyModal((prev) => ({ ...prev, running: false, done: true }));
      window.setTimeout(() => {
        setDependencyModal({ open: false, title: '', rows: [], running: false, done: false, targetItem: null });
      }, 500);
    } catch (err) {
      setDependencyModal((prev) => ({ ...prev, running: false }));
      dialog.showAlert(`Failed to install datapack: ${err?.message || 'Unknown error'}`);
    } finally {
      setInstallingId(null);
    }
  };

  const isDatapackInstalled = (item) => {
    const targetId = String(item?.id || '').trim();
    const targetName = String(item?.name || '').trim().toLowerCase();
    return (detail?.datapacks || []).some((dp) => {
      const installedModId = String(dp?.modId || dp?.id || '').trim();
      const installedDisplayName = String(dp?.displayName || '').trim().toLowerCase();
      if (targetId && installedModId && installedModId === targetId) return true;
      if (targetName && installedDisplayName && installedDisplayName === targetName) return true;
      return false;
    });
  };

  const onUninstallDatapack = async (item) => {
    const targetWorldName = worldMeta?.name || 'world';
    const datapackName = String(item?.name || '').trim();
    if (!datapackName) return;

    const confirmed = await dialog.showConfirm(
      `Uninstall datapack "${item.displayName || datapackName}"?`,
      'Uninstall Datapack'
    );
    if (!confirmed) return;

    setUninstallingName(datapackName);
    try {
      await worldAPI.deleteDatapack(targetWorldName, datapackName);
      await fetchWorldDetail(targetWorldName);
      dialog.showAlert(`Uninstalled datapack "${item.displayName || datapackName}".`, 'Success');
    } catch (err) {
      const backendError = err?.response?.data?.error;
      dialog.showAlert(`Failed to uninstall datapack: ${backendError || err.message}`);
    } finally {
      setUninstallingName('');
    }
  };

  const getLogo = (item) => item?.logo || getDatapackPlaceholder(item) || '';

  const renderDatapackCard = (item, isInstalledCard = false) => {
    const logo = getLogo(item);
    const providerLabel = item.providerName || item.provider || provider || 'Datapack';
    const installedInWorld = !isInstalledCard && isDatapackInstalled(item);
    return (
      <div key={item.id || item.name} className="card datapack-card">
        <div className="datapack-card-top">
          {logo ? (
            <img
              className="datapack-logo"
              src={logo}
              alt={item.name}
              onError={(e) => {
                if (e.currentTarget.dataset.fallbackApplied === '1') return;
                e.currentTarget.dataset.fallbackApplied = '1';
                const fallback = getDatapackPlaceholder(item);
                if (fallback && fallback !== logo) {
                  e.currentTarget.src = fallback;
                  return;
                }
                e.currentTarget.src = '/static/images/github.svg';
              }}
            />
          ) : (
            <div className="datapack-logo-fallback"><Package size={18} /></div>
          )}
          <div style={{ minWidth: 0 }}>
            <h4 className="datapack-title">{item.displayName || item.name}</h4>
            <div className="datapack-meta-row">
              <small>{item.author || 'Unknown'}</small>
              <span className="datapack-provider-badge">{providerLabel}</span>
            </div>
          </div>
        </div>

        <p className="datapack-summary">{item.summary || 'No description provided.'}</p>
        {Array.isArray(item.dependencies) && item.dependencies.length > 0 && (
          <p className="datapack-summary" style={{ minHeight: 'auto' }}>
            Dependencies: {item.dependencies.map((d) => d.id).join(', ')}
          </p>
        )}

        <div className="datapack-actions">
          {isInstalledCard ? (
            <button
              className="btn btn-danger"
              style={{ flex: 1 }}
              onClick={() => onUninstallDatapack(item)}
              disabled={uninstallingName === item.name}
            >
              <Trash2 size={14} /> {uninstallingName === item.name ? 'Uninstalling...' : 'Uninstall'}
            </button>
          ) : (
            <button
              className={`btn ${installedInWorld ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => {
                if (!installedInWorld) onInstallDatapack(item);
              }}
              disabled={installingId === item.id || installedInWorld}
              style={{ flex: 1 }}
            >
              {installingId === item.id ? (
                <><img src={LOADING_SPINNER_SRC} alt="Installing" className="loading-spinner-icon" /> Installing...</>
              ) : installedInWorld ? (
                <><Package size={14} /> Installed</>
              ) : (
                <><Download size={14} /> Install</>
              )}
            </button>
          )}
          {item.websiteUrl && (
            <button
              className="btn btn-secondary"
              onClick={() => window.open(item.websiteUrl, '_blank')}
              style={{ flex: 1 }}
            >
              <ExternalLink size={14} /> Open
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="worlds-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">World</h1>
          <p className="page-subtitle">Datapack manager</p>
        </div>
        <button className="btn btn-secondary fetch-btn" onClick={fetchWorld} disabled={loading}>
          {loading ? <img src={LOADING_SPINNER_SRC} alt="Loading" className="loading-spinner-icon" /> : <RefreshCw size={16} />} Refresh
        </button>
      </div>

      {error && <div className="error-message-card"><p>{error}</p></div>}

      <div className="worlds-layout">
        <div className="world-main">
          <div className="card world-overview-card">
            <h3 style={{ marginTop: 0 }}>World Overview</h3>
            {worldMeta ? (
              <div className="world-overview-grid">
                <div><strong>Name:</strong> {worldMeta.displayName}</div>
                <div><strong>Type:</strong> {worldMeta.worldType || 'Unknown'}</div>
                <div><strong>Folder:</strong> {detail?.worldPath || 'Loading...'}</div>
                <div><strong>Datapacks:</strong> {detail?.datapacks?.length ?? 0}</div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>World not available yet.</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
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
              Browse
            </button>
          </div>

          {activeTab === 'installed' && (
            <div className="datapack-grid">
              {(detail?.datapacks || []).map((dp) => renderDatapackCard(dp, true))}
              {detail && (detail.datapacks || []).length === 0 && (
                <div className="card" style={{ color: 'var(--text-secondary)' }}>No datapacks installed yet.</div>
              )}
            </div>
          )}

          {activeTab === 'browse' && (
            <>
              <form className="datapack-search-row" onSubmit={onSearchDatapacks}>
                <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                  {providers.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search datapacks (name, author, author:someone)"
                />
                <button className="btn btn-primary" type="submit" disabled={searchLoading || !provider}>
                  {searchLoading ? <img src={LOADING_SPINNER_SRC} alt="Searching" className="loading-spinner-icon" /> : <Search size={14} />} {searchLoading ? 'Searching...' : 'Search'}
                </button>
              </form>

              <div className="datapack-grid">
                {(results || []).map((item) => renderDatapackCard(item, false))}
                {!searchLoading && results.length === 0 && (
                  <div className="card" style={{ color: 'var(--text-secondary)' }}>No datapacks found.</div>
                )}
              </div>

              {(results.length > 0 || searchPage > 1) && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => onSearchDatapacks(null, searchQuery, Math.max(1, searchPage - 1))}
                    disabled={searchLoading || searchPage <= 1}
                  >
                    Previous
                  </button>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Page {searchPage}
                  </span>
                  <button
                    className="btn btn-secondary"
                    onClick={() => onSearchDatapacks(null, searchQuery, searchPage + 1)}
                    disabled={searchLoading || !searchHasMore}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    {dependencyModal.open && (
      <div style={{
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
            This window stays locked until dependencies are handled.
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
                <span style={{ color: row.status === 'installed' ? '#86efac' : (row.status === 'failed' ? '#fca5a5' : 'var(--text-secondary)') }}>
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
              onClick={runDatapackDependencyInstallFlow}
            >
              {dependencyModal.running ? 'Installing...' : (dependencyModal.done ? 'Installed' : 'Install')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default WorldsPage;

