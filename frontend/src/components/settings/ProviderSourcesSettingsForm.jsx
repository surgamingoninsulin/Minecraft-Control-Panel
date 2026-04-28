import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import * as settingsApi from '../../services/settingsApi';
import '../../styles/global.css';

const DEFAULT_GITHUB_GIST_URL = 'https://gist.github.com/surgamingoninsulin/2b4d90991a5a5a025f69cce2282f67b7';

function normalizeCustomProviderId(input, fallbackIndex = 0) {
  const base = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `custom-provider-${fallbackIndex + 1}`;
}

function normalizeGithubGistUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'gist.github.com') {
      return '';
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length !== 2) return '';

    const username = parts[0].trim();
    const gistId = parts[1].trim();
    if (!username || !/^[A-Za-z0-9-]+$/.test(username)) return '';
    if (!/^[A-Fa-f0-9]{8,}$/.test(gistId)) return '';

    return `https://gist.github.com/${username}/${gistId}`;
  } catch {
    return '';
  }
}

function normalizeProviderSettings(modProviders) {
  const source = modProviders || {};
  const communityRaw = Array.isArray(source.communityProviders)
    ? source.communityProviders
    : (Array.isArray(source.customProviders) ? source.customProviders : []);

  const communityProviders = communityRaw
    .map((provider, index) => {
      const name = String(provider?.name || '').trim();
      const gistUrl = normalizeGithubGistUrl(provider?.gistUrl);
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
    ...source,
    github: {
      ...(source.github || {}),
      // Built-in Github provider URL is intentionally immutable in the UI.
      gistUrl: DEFAULT_GITHUB_GIST_URL
    },
    communityProviders,
    customProviders: communityProviders
  };
}

function ProviderSourcesSettingsForm() {
  const [providerSettings, setProviderSettings] = useState(normalizeProviderSettings({}));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isAddProviderModalOpen, setIsAddProviderModalOpen] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderGistUrl, setNewProviderGistUrl] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await settingsApi.getPanelSettings();
        setProviderSettings(normalizeProviderSettings(settings.modProviders));
      } catch (e) {
        setError(`Failed to load provider source settings: ${e.message}`);
      }
    };

    load();
  }, []);

  const persistProviderSources = async (normalizedSettings) => {
    const current = await settingsApi.getPanelSettings();
    await settingsApi.savePanelSettings({
      ...current,
      modProviders: normalizedSettings
    });
  };

  const closeAddProviderModal = () => {
    setIsAddProviderModalOpen(false);
    setNewProviderName('');
    setNewProviderGistUrl('');
  };

  const addCustomProvider = async () => {
    const name = String(newProviderName || '').trim();
    const gistUrl = normalizeGithubGistUrl(newProviderGistUrl);
    if (!name || !gistUrl) {
      setError('Please use a valid URL: https://gist.github.com/<username>/<gist_id>');
      return;
    }

    const existing = providerSettings.communityProviders
      .some((entry) => String(entry.name || '').toLowerCase() === name.toLowerCase());
    if (existing) {
      setError(`Provider '${name}' already exists.`);
      return;
    }

    setSaving(true);
    try {
      const normalizedCurrent = normalizeProviderSettings(providerSettings);
      const nextNormalized = normalizeProviderSettings({
        ...normalizedCurrent,
        communityProviders: [
          ...normalizedCurrent.communityProviders,
          {
            id: normalizeCustomProviderId(name, normalizedCurrent.communityProviders.length),
            name,
            type: 'github',
            gistUrl,
            enabled: true
          }
        ]
      });

      await persistProviderSources(nextNormalized);
      setProviderSettings(nextNormalized);
      setMessage('Community provider added and saved.');
      setError('');
      closeAddProviderModal();
    } catch (e) {
      setError(`Failed to add provider: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateCustomProvider = (id, field, value) => {
    setProviderSettings((prev) => {
      const normalized = normalizeProviderSettings(prev);
      return {
        ...normalized,
        communityProviders: normalized.communityProviders.map((entry) => {
          if (entry.id !== id) return entry;
          return { ...entry, [field]: value };
        })
      };
    });
  };

  const saveCustomProviderName = async (id) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const normalizedCurrent = normalizeProviderSettings(providerSettings);
      const target = normalizedCurrent.communityProviders.find((entry) => entry.id === id);
      const nextName = String(target?.name || '').trim();
      if (!nextName) {
        throw new Error('Provider name cannot be empty.');
      }
      const duplicate = normalizedCurrent.communityProviders.some(
        (entry) => entry.id !== id && String(entry.name || '').toLowerCase() === nextName.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`Provider '${nextName}' already exists.`);
      }

      const nextNormalized = normalizeProviderSettings({
        ...normalizedCurrent,
        communityProviders: normalizedCurrent.communityProviders.map((entry) => (
          entry.id === id ? { ...entry, name: nextName } : entry
        ))
      });

      await persistProviderSources(nextNormalized);
      setProviderSettings(nextNormalized);
      setMessage('Provider name updated and saved.');
    } catch (e) {
      setError(`Failed to update provider name: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const removeCustomProvider = async (id) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const normalizedCurrent = normalizeProviderSettings(providerSettings);
      const nextNormalized = normalizeProviderSettings({
        ...normalizedCurrent,
        communityProviders: normalizedCurrent.communityProviders.filter((entry) => entry.id !== id)
      });
      await persistProviderSources(nextNormalized);
      setProviderSettings(nextNormalized);
      setMessage('Community provider removed and saved.');
    } catch (e) {
      setError(`Failed to remove provider: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Provider Sources</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setIsAddProviderModalOpen(true)} disabled={saving}>
            <Plus size={16} /> Add Provider
          </button>
        </div>
      </div>

      {error && <div className="status-badge status-offline" style={{ display: 'block', marginBottom: '10px' }}>{error}</div>}
      {message && <div className="status-badge status-online" style={{ display: 'block', marginBottom: '10px' }}>{message}</div>}

      <div className="form-group card" style={{ margin: 0 }}>
        <label>github Built-in Gist URL</label>
        <input
          type="text"
          value={providerSettings.github?.gistUrl || ''}
          readOnly
          disabled
        />
        <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
          This built-in source is hardcoded and cannot be changed.
        </small>
      </div>

      <div style={{ marginTop: '16px' }}>
        <h3 style={{ marginTop: 0 }}>Community Providers</h3>
        {providerSettings.communityProviders.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            No community providers added yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {providerSettings.communityProviders.map((entry) => (
              <div key={entry.id} className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '14px' }}>{entry.name}</strong>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '6px 10px' }}
                    onClick={() => removeCustomProvider(entry.id)}
                    title="Remove provider"
                  >
                    <X size={14} />
                  </button>
                </div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Provider Name</label>
                <input
                  type="text"
                  value={entry.name}
                  onChange={(e) => updateCustomProvider(entry.id, 'name', e.target.value)}
                  onBlur={() => saveCustomProviderName(entry.id)}
                  placeholder="My Plugins"
                  disabled={saving}
                />
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Gist URL</label>
                <input
                  type="text"
                  value={entry.gistUrl}
                  readOnly
                  disabled
                  title="Gist URL cannot be changed after provider creation"
                  style={{ opacity: 0.75, cursor: 'not-allowed' }}
                />
                <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
                  Gist URL is locked after add. Remove and re-add provider to change it.
                </small>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAddProviderModalOpen && (
        <div style={{
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
            <h3 style={{ marginTop: 0 }}>Add Provider</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
              Add a custom source backed by a public github gist JSON.
            </p>

            <div className="form-group">
              <label>Provider Name</label>
              <input
                type="text"
                value={newProviderName}
                onChange={(e) => setNewProviderName(e.target.value)}
                placeholder="Example: My Team Plugins"
              />
            </div>
            <div className="form-group">
              <label>Gist URL</label>
              <input
                type="text"
                value={newProviderGistUrl}
                onChange={(e) => setNewProviderGistUrl(e.target.value)}
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
              <button className="btn btn-primary" onClick={addCustomProvider}>
                Add Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProviderSourcesSettingsForm;
