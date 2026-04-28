import { useState, useEffect } from 'react';
import * as settingsApi from '../../services/settingsApi';
import '../../styles/global.css';

const FIXED_DIRECTORIES = {
    datapacksDir: 'world/datapacks',
    modsDir: 'mods',
    pluginsDir: 'plugins'
};

function PanelSettingsForm() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detecting, setDetecting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await settingsApi.getPanelSettings();
            setSettings(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoDetect = async () => {
        setDetecting(true);
        setError(null);
        setSuccess(null);
        try {
            const info = await settingsApi.detectSystem();
            setSettings((prev) => ({
                ...prev,
                os: info.os,
                javaPath: info.javaPath || prev.javaPath
            }));
            setSuccess('System detected! Java and OS fields were refreshed.');
        } catch (err) {
            setError('Detection failed: ' + err.message);
        } finally {
            setDetecting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let val = type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value);
        if (name === 'minMemory' || name === 'maxMemory') {
            val = String(value || '').replace(/\D+/g, '');
        }

        setSettings((prev) => ({ ...prev, [name]: val }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        try {
            const payload = {
                ...settings,
                pluginInstallDir: FIXED_DIRECTORIES.pluginsDir,
                aotEnabled: false,
                aotCacheFile: null
            };

            await settingsApi.savePanelSettings(payload);
            setSettings(payload);
            setSuccess('Panel settings saved successfully! Restart server to apply.');
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (error && !settings) return (
        <div className="card">
            <h2 className="card-title">Panel Configuration</h2>
            <div className="status-badge status-offline" style={{ display: 'block', marginBottom: '1rem' }}>
                Error: {error}
            </div>
            <button onClick={loadSettings} className="btn btn-secondary">Retry</button>
        </div>
    );
    if (!settings) return <div>No settings available</div>;

    const javaCmdDisplay = (settings.javaPath && settings.javaPath.trim()) ? settings.javaPath.trim() : 'java';
    const minMemoryGb = String(settings.minMemory || '').replace(/\D+/g, '') || '1';
    const maxMemoryGb = String(settings.maxMemory || '').replace(/\D+/g, '') || '2';

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>Panel Configuration</h2>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAutoDetect}
                    disabled={detecting}
                >
                    {detecting ? 'Detecting...' : 'Auto Detect System'}
                </button>
            </div>

            {error && <div className="status-badge status-offline" style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
            {success && <div className="status-badge status-online" style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Operating System</label>
                    <input
                        type="text"
                        name="os"
                        value={settings.os}
                        readOnly
                        className="input-field"
                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                    <small>Auto-detected from the backend environment.</small>
                </div>

                <div className="form-group">
                    <label>Java Executable Path</label>
                    <input
                        type="text"
                        name="javaPath"
                        value={settings.javaPath || ''}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="/usr/bin/java or java"
                    />
                    <small>Absolute path to the Java executable. Required if 'java' is not in PATH.</small>
                </div>

                <div className="form-group">
                    <label>Server Name</label>
                    <input
                        type="text"
                        name="serverName"
                        value={settings.serverName || ''}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="Minecraft Server"
                    />
                </div>

                <div className="form-group">
                    <label>Server Type</label>
                    <input
                        type="text"
                        value={settings.serverType || 'vanilla'}
                        readOnly
                        className="input-field"
                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                    <small>Server type is managed by setup and cannot be changed here.</small>
                </div>

                <div className="form-group">
                    <label>Server Version</label>
                    <input
                        type="text"
                        name="serverVersion"
                        value={settings.serverVersion || ''}
                        readOnly
                        className="input-field"
                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                    <small>Server version is managed by setup and cannot be changed here.</small>
                </div>

                <div className="form-group">
                    <label>Server Path</label>
                    <input
                        type="text"
                        name="serverPath"
                        value={settings.serverPath || ''}
                        readOnly
                        className="input-field"
                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                    <small>Server path is fixed at runtime and cannot be changed here.</small>
                </div>

                <div className="form-group">
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label>Min Memory (GB)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                name="minMemory"
                                value={String(settings.minMemory || '').replace(/\D+/g, '')}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="1"
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>Max Memory (GB)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                name="maxMemory"
                                value={String(settings.maxMemory || '').replace(/\D+/g, '')}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="2"
                            />
                        </div>
                    </div>
                    <small>Memory values are in GB (not MB).</small>
                </div>

                <div className="form-group">
                    <label>Server Jar</label>
                    <input
                        type="text"
                        name="jarFile"
                        value={settings.jarFile || 'server.jar'}
                        readOnly
                        className="input-field"
                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                    <small>Server jar cannot be changed while the panel is running.</small>
                </div>

                <div className="form-group">
                    <label>Server Directories</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div>
                            <small style={{ marginBottom: '4px', display: 'block' }}>Datapacks</small>
                            <input type="text" className="input-field" readOnly value={FIXED_DIRECTORIES.datapacksDir} style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                        </div>
                        <div>
                            <small style={{ marginBottom: '4px', display: 'block' }}>Mods</small>
                            <input type="text" className="input-field" readOnly value={FIXED_DIRECTORIES.modsDir} style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                        </div>
                        <div>
                            <small style={{ marginBottom: '4px', display: 'block' }}>Plugins</small>
                            <input type="text" className="input-field" readOnly value={FIXED_DIRECTORIES.pluginsDir} style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                        </div>
                    </div>
                    <small>Directory targets are fixed to Minecraft-safe defaults.</small>
                </div>

                <div className="form-group">
                    <label>Plugin Install Directory</label>
                    <input
                        type="text"
                        name="pluginInstallDir"
                        value={FIXED_DIRECTORIES.pluginsDir}
                        readOnly
                        className="input-field"
                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                    <small>Plugin install directory is locked.</small>
                </div>

                <div className="form-group">
                    <label>Command Preview</label>
                    <div style={{
                        padding: '12px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        color: 'var(--text-secondary)',
                        fontSize: '13px',
                        wordBreak: 'break-all'
                    }}>
                        {javaCmdDisplay} -Xms{minMemoryGb}G -Xmx{maxMemoryGb}G -jar {settings.jarFile} nogui
                    </div>
                    <small>This command is generated automatically from your settings.</small>
                </div>

                <div className="form-group">
                    <label>Server Port (Panel internal)</label>
                    <input
                        type="number"
                        name="port"
                        value={settings.port}
                        onChange={handleChange}
                        className="input-field"
                        readOnly
                        style={{ opacity: 0.7 }}
                    />
                    <small>Port configuration is managed by environment variables.</small>
                </div>

                <button type="submit" className="btn btn-primary">Save Panel Settings</button>
            </form>
        </div>
    );
}

export default PanelSettingsForm;
