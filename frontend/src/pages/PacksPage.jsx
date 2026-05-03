import { useEffect, useMemo, useState } from 'react';
import { packAPI, serverAPI } from '../services/api';
import { useDialog } from '../contexts/DialogContext';

function PacksPage() {
  const dialog = useDialog();
  const [packs, setPacks] = useState({ builtIn: [], community: [] });
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('offline');
  const [page, setPage] = useState(1);
  const [installModal, setInstallModal] = useState({ open: false, state: 'loading', message: '' });
  const PAGE_SIZE = 8;

  const loadAll = async () => {
    setLoading(true);
    try {
      const [packsResp, statusResp] = await Promise.all([
        packAPI.getPacks(),
        serverAPI.getStatus()
      ]);
      setPacks(packsResp.data || { builtIn: [], community: [] });
      setServerStatus(statusResp.data?.status || 'offline');
    } catch (error) {
      await dialog.showAlert(error.response?.data?.error || error.message || 'Failed to load packs data', 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const allCards = useMemo(() => {
    const flatten = (group, type) =>
      (group || []).flatMap((providerResult) =>
        (providerResult.packs || []).map((pack) => ({
          ...pack,
          _provider: providerResult.provider,
          _sourceType: type,
          _error: providerResult.error || null
        }))
      );
    return [...flatten(packs.builtIn, 'builtIn'), ...flatten(packs.community, 'community')];
  }, [packs]);
  const totalPages = Math.max(1, Math.ceil(allCards.length / PAGE_SIZE));
  const visibleCards = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return allCards.slice(start, start + PAGE_SIZE);
  }, [allCards, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const installPack = async (pack) => {
    try {
      if (serverStatus !== 'offline') {
        await dialog.showAlert('Stop the server before installing a pack.', 'Server Running');
        return;
      }
      const ok = await dialog.showConfirm(
        `Install pack "${pack.name}"?\n\nThis will DELETE all current files in your configured server folder before the new pack is installed.\n\nIf you do not have a backup, you will lose your current server files.`,
        'Confirm Destructive Pack Install'
      );
      if (!ok) return;

      setInstallModal({ open: true, state: 'loading', message: `Installing "${pack.name}"...` });
      const response = await packAPI.install(pack);
      setInstallModal({
        open: true,
        state: 'success',
        message: `Pack "${pack.name}" installed successfully.`
      });
    } catch (error) {
      setInstallModal({ open: false, state: 'loading', message: '' });
      const statusCode = error?.response?.status;
      const backendMessage = error?.response?.data?.error || '';
      const baseMessage = backendMessage || error?.message || 'Pack install failed';
      const hint = statusCode === 502
        ? '\n\nGateway 502: backend/proxy was interrupted while installing. Check backend logs and retry.'
        : '';
      await dialog.showAlert(`${baseMessage}${hint}`, 'Error');
    }
  };

  return (
    <div className="fade-in">
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Packs Manager</h1>
          <p className="page-subtitle">Built-in GitHub packs and community packs</p>
        </div>
        <button className="btn btn-secondary" onClick={loadAll} disabled={loading}>{loading ? 'Loading...' : 'Reload'}</button>
      </div>

      <div className="card">
        <h3 className="card-title">Available Packs</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
          Manage pack providers in Settings {'>'} API Providers.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {visibleCards.map((pack) => (
            <div key={`${pack._provider}-${pack.id}`} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 10, position: 'relative', minHeight: 168 }}>
              <div style={{ paddingRight: 112 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {pack.serverIconImage && (
                    <img
                      src={pack.serverIconImage}
                      alt={pack.name}
                      style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }}
                    />
                  )}
                  <strong style={{ minHeight: 64, display: 'flex', alignItems: 'center' }}>{pack.name}</strong>
                </div>
                <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: '10px 0 8px 0' }} />
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{pack.description || 'No description'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {pack.author ? `Author: ${pack.author}` : 'Author: Unknown'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {pack.version ? `Version: ${pack.version}` : 'Version: n/a'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Minecraft: {pack.minecraftVersion || 'n/a'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Server Type: {pack.serverType || 'n/a'}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => { void installPack(pack); }}
                disabled={serverStatus !== 'offline' || (installModal.open && installModal.state === 'loading')}
                style={{
                  minWidth: 92,
                  padding: '10px 14px',
                  fontWeight: 700,
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}
              >
                Install
              </button>
            </div>
          ))}
          {allCards.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No packs found from configured providers.</div>}
        </div>
        {allCards.length > PAGE_SIZE && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Page {page} / {totalPages}</span>
            <button className="btn btn-secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
          </div>
        )}
      </div>

      {installModal.open && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 2100,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ maxWidth: 560, width: '100%', padding: '22px' }}>
            {installModal.state === 'loading' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', minHeight: '140px' }}>
                <img
                  src="/static/images/loading-spinner.svg"
                  alt="Loading"
                  style={{ width: 34, height: 34 }}
                />
                <div>
                  <h3 style={{ margin: 0 }}>Installing Pack</h3>
                  <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)' }}>{installModal.message}</p>
                </div>
              </div>
            ) : (
              <>
                <h3 style={{ marginTop: 0, marginBottom: 8 }}>Install Complete</h3>
                <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>{installModal.message}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={() => setInstallModal({ open: false, state: 'loading', message: '' })}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PacksPage;
