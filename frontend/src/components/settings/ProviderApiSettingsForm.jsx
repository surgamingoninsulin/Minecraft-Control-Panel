import { useEffect, useState } from 'react';
import * as settingsApi from '../../services/settingsApi';
import '../../styles/global.css';

const DEFAULT_PROVIDER_SETTINGS = {
  curseforge: { apiKey: '' },
  modrinth: { apiToken: '' },
  hangar: { apiKey: '' }
};

function ProviderApiSettingsForm() {
  const [providerSettings, setProviderSettings] = useState(DEFAULT_PROVIDER_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await settingsApi.getPanelSettings();
        setProviderSettings({
          curseforge: {
            apiKey: settings?.modProviders?.curseforge?.apiKey || ''
          },
          modrinth: {
            apiToken: settings?.modProviders?.modrinth?.apiToken || ''
          },
          hangar: {
            apiKey: settings?.modProviders?.hangar?.apiKey || ''
          }
        });
      } catch (e) {
        setError(`Failed to load provider API settings: ${e.message}`);
      }
    };

    load();
  }, []);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const current = await settingsApi.getPanelSettings();
      const merged = {
        ...current,
        modProviders: {
          ...(current.modProviders || {}),
          curseforge: {
            ...(current.modProviders?.curseforge || {}),
            apiKey: providerSettings.curseforge.apiKey || ''
          },
          modrinth: {
            ...(current.modProviders?.modrinth || {}),
            apiToken: providerSettings.modrinth.apiToken || ''
          },
          hangar: {
            ...(current.modProviders?.hangar || {}),
            apiKey: providerSettings.hangar.apiKey || ''
          }
        }
      };

      await settingsApi.savePanelSettings(merged);
      setMessage('Provider API settings saved.');
    } catch (e) {
      setError(`Failed to save provider API settings: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">Provider APIs</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
        These credentials are shared by both Mods/Plugins and Worlds datapack search.
      </p>

      {error && (
        <div className="status-badge status-offline" style={{ marginBottom: '1rem', display: 'block' }}>
          {error}
        </div>
      )}
      {message && (
        <div className="status-badge status-online" style={{ marginBottom: '1rem', display: 'block' }}>
          {message}
        </div>
      )}

      <form onSubmit={onSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div className="form-group card" style={{ margin: 0 }}>
            <label>CurseForge API Key</label>
            <input
              type="password"
              value={providerSettings.curseforge.apiKey}
              onChange={(e) => setProviderSettings((prev) => ({
                ...prev,
                curseforge: { ...prev.curseforge, apiKey: e.target.value }
              }))}
              placeholder="Enter CurseForge API Key"
            />
            <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
              Recommended for reliable CurseForge requests.
            </small>
          </div>

          <div className="form-group card" style={{ margin: 0 }}>
            <label>Modrinth API Token</label>
            <input
              type="password"
              value={providerSettings.modrinth.apiToken}
              onChange={(e) => setProviderSettings((prev) => ({
                ...prev,
                modrinth: { ...prev.modrinth, apiToken: e.target.value }
              }))}
              placeholder="Optional Modrinth token"
            />
            <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
              Optional token for higher rate limits.
            </small>
          </div>

          <div className="form-group card" style={{ margin: 0 }}>
            <label>Hangar API Key</label>
            <input
              type="password"
              value={providerSettings.hangar.apiKey}
              onChange={(e) => setProviderSettings((prev) => ({
                ...prev,
                hangar: { ...prev.hangar, apiKey: e.target.value }
              }))}
              placeholder="Optional Hangar API Key"
            />
            <small style={{ color: 'var(--text-secondary)', display: 'block' }}>
              Used for Hangar plugin lookups.
            </small>
          </div>

        </div>

        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '16px' }}>
          {saving ? 'Saving...' : 'Save Provider API Settings'}
        </button>
      </form>
    </div>
  );
}

export default ProviderApiSettingsForm;
