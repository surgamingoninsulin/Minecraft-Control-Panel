import { useState, useEffect } from 'react';
import * as settingsApi from '../../services/settingsApi';

function ServerSettingsForm() {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const data = await settingsApi.getServerSettings();
            setConfig(data);
        } catch (err) {
            setError(err.message + '. Check if Server Path is correct in Panel Settings.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value);
        setConfig((prev) => ({ ...prev, [name]: val }));
    };

    const handleStrictNumberChange = (e) => {
        const { name, value } = e.target;
        const digits = String(value || '').replace(/\D+/g, '');
        setConfig((prev) => ({ ...prev, [name]: digits === '' ? '' : Number(digits) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        try {
            await settingsApi.saveServerSettings(config);
            setSuccess('Server properties saved. Restart server to apply all changes.');
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div>Loading server.properties...</div>;
    if (error && !config) return <div className="status-badge status-offline">{error}</div>;

    return (
        <div className="card">
            <h2 className="card-title">Minecraft Server Configuration (server.properties)</h2>

            {error && <div className="status-badge status-offline" style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
            {success && <div className="status-badge status-online" style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>MOTD</label>
                    <input type="text" name="motd" value={config.motd || ''} onChange={handleChange} className="input-field" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                        <label>Max Players</label>
                        <input type="text" inputMode="numeric" name="maxPlayers" value={config.maxPlayers ?? 20} onChange={handleStrictNumberChange} className="input-field" />
                    </div>
                    <div className="form-group">
                        <label>Server Port</label>
                        <input type="text" inputMode="numeric" name="serverPort" value={config.serverPort ?? 25565} onChange={handleStrictNumberChange} className="input-field" />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                        <label>View Distance</label>
                        <input type="text" inputMode="numeric" name="viewDistance" value={config.viewDistance ?? 10} onChange={handleStrictNumberChange} className="input-field" />
                    </div>
                    <div className="form-group">
                        <label>Simulation Distance</label>
                        <input type="text" inputMode="numeric" name="simulationDistance" value={config.simulationDistance ?? 10} onChange={handleStrictNumberChange} className="input-field" />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                        <label>Difficulty</label>
                        <select name="difficulty" value={config.difficulty || 'easy'} onChange={handleChange} className="input-field">
                            <option value="peaceful">Peaceful</option>
                            <option value="easy">Easy</option>
                            <option value="normal">Normal</option>
                            <option value="hard">Hard</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Default Gamemode</label>
                        <select name="gamemode" value={config.gamemode || 'survival'} onChange={handleChange} className="input-field">
                            <option value="survival">Survival</option>
                            <option value="creative">Creative</option>
                            <option value="adventure">Adventure</option>
                            <option value="spectator">Spectator</option>
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label>World Folder Name</label>
                    <input type="text" name="levelName" value={config.levelName || 'world'} onChange={handleChange} className="input-field" />
                </div>

                <div className="form-group">
                    <label>World Seed (optional)</label>
                    <input type="text" name="levelSeed" value={config.levelSeed || ''} onChange={handleChange} className="input-field" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 0 }}>
                        <input type="checkbox" name="onlineMode" checked={Boolean(config.onlineMode)} onChange={handleChange} />
                        <span>Online Mode</span>
                    </label>
                    <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 0 }}>
                        <input type="checkbox" name="whiteListEnabled" checked={Boolean(config.whiteListEnabled)} onChange={handleChange} />
                        <span>Whitelist Enabled</span>
                    </label>
                    <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 0 }}>
                        <input type="checkbox" name="pvp" checked={Boolean(config.pvp)} onChange={handleChange} />
                        <span>Enable PvP</span>
                    </label>
                    <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 0 }}>
                        <input type="checkbox" name="allowNether" checked={Boolean(config.allowNether)} onChange={handleChange} />
                        <span>Allow Nether</span>
                    </label>
                    <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 0 }}>
                        <input type="checkbox" name="enableCommandBlock" checked={Boolean(config.enableCommandBlock)} onChange={handleChange} />
                        <span>Enable Command Blocks</span>
                    </label>
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                    <label>Spawn Protection Radius</label>
                    <input type="text" inputMode="numeric" name="spawnProtection" value={config.spawnProtection ?? 16} onChange={handleStrictNumberChange} className="input-field" />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Server Settings</button>
            </form>
        </div>
    );
}

export default ServerSettingsForm;
