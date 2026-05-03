import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { packAPI } from '../../services/api';

function PackProviderSettingsForm() {
  const [providers, setProviders] = useState({ builtIn: [], community: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAddProviderModalOpen, setIsAddProviderModalOpen] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderUrl, setNewProviderUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const normalizeGithubGistUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'gist.github.com') return '';
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length !== 2) return '';
      return `https://gist.github.com/${parts[0]}/${parts[1]}`;
    } catch {
      return '';
    }
  };

  const loadProviders = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await packAPI.getProviders();
      setProviders(response.data || { builtIn: [], community: [] });
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load pack providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const closeAddProviderModal = () => {
    setIsAddProviderModalOpen(false);
    setNewProviderName('');
    setNewProviderUrl('');
  };

  const onAdd = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const name = String(newProviderName || '').trim();
      const url = normalizeGithubGistUrl(newProviderUrl);
      if (!name || !url) {
        throw new Error('Provider name and URL are required.');
      }
      await packAPI.addProvider(name, url);
      setMessage('Pack provider added.');
      closeAddProviderModal();
      await loadProviders();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to add provider');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (targetUrl) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await packAPI.removeProvider(targetUrl);
      setMessage('Pack provider removed.');
      await loadProviders();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to remove provider');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Pack Providers</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setIsAddProviderModalOpen(true)} disabled={saving || loading}>
            <Plus size={16} /> Add Provider
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
        Manage full server-pack provider sources. Built-in providers are read-only.
      </p>

      {error && <div className="status-badge status-offline" style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
      {message && <div className="status-badge status-online" style={{ marginBottom: '1rem', display: 'block' }}>{message}</div>}

      <div className="form-group card" style={{ margin: 0, marginBottom: '12px' }}>
        <label>Built-in Pack Gist URL</label>
        {(providers.builtIn || []).length === 0 ? (
          <small style={{ color: 'var(--text-secondary)' }}>No built-in providers configured.</small>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {providers.builtIn.map((p) => (
              <input key={`${p.name}-${p.url}`} type="text" value={p.url} readOnly disabled />
            ))}
          </div>
        )}
        <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
          Built-in pack source is managed by the panel.
        </small>
      </div>

      <div className="form-group card" style={{ margin: 0 }}>
        <label>Community Pack Providers</label>
        {(providers.community || []).length === 0 ? (
          <small style={{ color: 'var(--text-secondary)' }}>No community pack providers.</small>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {providers.community.map((p) => (
              <div key={p.url} className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '14px' }}>{p.name}</strong>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '6px 10px' }}
                    onClick={() => onRemove(p.url)}
                    title="Remove provider"
                    disabled={saving || loading}
                  >
                    <X size={14} />
                  </button>
                </div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Gist URL</label>
                <input type="text" value={p.url} readOnly disabled />
              </div>
            ))}
          </div>
        )}
      </div>

      {isAddProviderModalOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', margin: 0 }}>
            <h3 style={{ marginTop: 0 }}>Add Pack Provider</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
              Add a custom source backed by a public github gist JSON.
            </p>

            <div className="form-group">
              <label>Provider Name</label>
              <input
                type="text"
                value={newProviderName}
                onChange={(e) => setNewProviderName(e.target.value)}
                placeholder="Example: Community Pack Source"
              />
            </div>
            <div className="form-group">
              <label>Gist URL</label>
              <input
                type="text"
                value={newProviderUrl}
                onChange={(e) => setNewProviderUrl(e.target.value)}
                placeholder="https://gist.github.com/<user>/<gist-id>"
              />
              <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
                Must match: https://gist.github.com/&lt;username&gt;/&lt;gist_id&gt;
              </small>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={closeAddProviderModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onAdd} disabled={saving}>
                Add Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PackProviderSettingsForm;
