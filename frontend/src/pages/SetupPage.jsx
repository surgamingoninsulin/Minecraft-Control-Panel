import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import * as settingsAPI from '../services/settingsApi';
import {
    User, Lock, AlertCircle, ArrowRight, ArrowLeft,
    Settings, Server, Cpu, Globe, CheckCircle2, Loader2, Search, Tag,
    Download, Terminal, FolderOpen, RefreshCw
} from 'lucide-react';
import './LoginPage.css';
import './SetupPage.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const SERVER_TYPES = ['vanilla', 'spigot', 'paper', 'purpur', 'forge', 'neoforge', 'fabric', 'velocity'];

const suggestJarFile = (type, version) => {
    const safeType = (type || 'server').toLowerCase();
    const safeVersion = (version || '').trim();
    if (!safeVersion) return `${safeType}.jar`;
    return `${safeType}-${safeVersion}.jar`;
};

function SetupPage({ serverResetMode = false }) {
    const [step, setStep] = useState(serverResetMode ? 2 : 1);
    const [installMode, setInstallMode] = useState(null);
    const [formData, setFormData] = useState({
        user: '',
        password: '',
        confirmPassword: ''
    });
    const [settings, setSettings] = useState({
        os: 'windows',
        serverPath: '',
        serverName: 'Minecraft Server',
        serverType: 'vanilla',
        serverVersion: '',
        jarFile: 'server.jar',
        assetsFile: '',
        maxMemory: '2G',
        minMemory: '1G',
        port: 5520
    });
    const [detection, setDetection] = useState({
        loading: false,
        results: null
    });
    const [installStatus, setInstallStatus] = useState({
        state: 'idle',
        deviceCode: null,
        verificationUrl: null,
        progress: 0,
        error: null,
        logs: []
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [jarFiles, setJarFiles] = useState([]);
    const [jarLoading, setJarLoading] = useState(false);
    const [browseLoading, setBrowseLoading] = useState(false);
    const { setup } = useAuth();

    useEffect(() => {
        if (!serverResetMode) {
            return;
        }

        let mounted = true;
        const loadExistingSettings = async () => {
            try {
                const current = await settingsAPI.getPanelSettings();
                if (!mounted || !current) return;

                setSettings((prev) => ({
                    ...prev,
                    os: current.os || prev.os,
                    serverPath: current.serverPath || prev.serverPath,
                    serverName: current.serverName || prev.serverName,
                    serverType: current.serverType || prev.serverType,
                    serverVersion: current.serverVersion || prev.serverVersion,
                    jarFile: current.jarFile || prev.jarFile,
                    assetsFile: current.assetsFile || prev.assetsFile,
                    maxMemory: current.maxMemory || prev.maxMemory,
                    minMemory: current.minMemory || prev.minMemory,
                    port: current.port || prev.port
                }));
            } catch (err) {
                console.error('Failed to load existing server settings during reset setup');
            }
        };

        loadExistingSettings();
        return () => {
            mounted = false;
        };
    }, [serverResetMode]);

    useEffect(() => {
        let interval;
        const activeStates = ['starting', 'downloading_game'];

        if (activeStates.includes(installStatus.state)) {
            interval = setInterval(async () => {
                try {
                    const response = await axios.get(`${API_URL}/installer/status`);
                    setInstallStatus(response.data);

                    if (response.data.state === 'finished') {
                        clearInterval(interval);
                        // Installation is done, user can now click "Complete Setup" or we can auto-trigger it
                        // For safety, let's just stop polling and let the UI update (which it will via state)
                    }
                    if (response.data.state === 'error') {
                        clearInterval(interval);
                        setError(response.data.error);
                    }
                } catch (err) {
                    console.error('Failed to poll installer status');
                }
            }, 1000); // Faster polling for smooth progress
        }
        return () => clearInterval(interval);
    }, [installStatus.state]);

    const handleNext = () => {
        if (step === 1 && !serverResetMode) {
            if (!formData.user || !formData.password) {
                return setError('Please fill all fields');
            }
            if (formData.password.length < 6) {
                return setError('Password must be at least 6 characters long');
            }
            if (formData.password !== formData.confirmPassword) {
                return setError('Passwords do not match');
            }
        }
        if (step === 2) {
            setError('');
        }
        if (step === 4 && !settings.serverPath) {
            return setError('Please provide a server path');
        }
        setError('');
        setStep(step + 1);
    };

    const handleBack = () => {
        setError('');
        if (serverResetMode && step === 2) {
            window.location.href = '/';
            return;
        }
        if (step === 6 && installMode === 'manual') {
            setStep(4);
            return;
        }
        setStep(step - 1);
    };

    const detectSystem = async () => {
        setDetection({ ...detection, loading: true });
        try {
            const response = await axios.get(`${API_URL}/auth/detect-system`);
            const { os, detectedPath, defaultPath, javaVersion } = response.data;

            setSettings(prev => ({
                ...prev,
                os,
                serverPath: defaultPath || detectedPath || prev.serverPath
            }));
            setDetection({ loading: false, results: { javaVersion, detectedPath } });
        } catch (err) {
            setDetection({ loading: false, results: { error: 'Failed' } });
        }
    };

    const loadJarFiles = async (pathToScan = settings.serverPath) => {
        if (!pathToScan) {
            setJarFiles([]);
            return;
        }

        setJarLoading(true);
        try {
            const response = await axios.get(`${API_URL}/settings/jar-files`, {
                params: { serverPath: pathToScan }
            });
            const jars = response.data?.jars || [];
            setJarFiles(jars);
            if (jars.length > 0 && !jars.includes(settings.jarFile)) {
                setSettings((prev) => ({ ...prev, jarFile: jars[0] }));
            }
        } catch (err) {
            setJarFiles([]);
        } finally {
            setJarLoading(false);
        }
    };

    const browseForServerPath = async () => {
        setBrowseLoading(true);
        try {
            const response = await axios.get(`${API_URL}/auth/browse-folder`, {
                timeout: 30000
            });
            const pickedPath = response.data?.path || '';
            if (pickedPath) {
                setSettings((prev) => ({
                    ...prev,
                    serverPath: pickedPath
                }));
                loadJarFiles(pickedPath);
            }
        } catch (err) {
            if (err.code === 'ECONNABORTED') {
                setError('Folder picker timed out. Try again, or paste the path manually.');
            } else {
                setError(err.response?.data?.error || 'Failed to open folder picker');
            }
        } finally {
            setBrowseLoading(false);
        }
    };

    const [prerequisites, setPrerequisites] = useState({
        checking: false,
        available: false,
        error: null
    });

    const checkPrerequisites = async () => {
        setPrerequisites((prev) => ({ ...prev, checking: true }));
        try {
            const response = await axios.get(`${API_URL}/installer/prerequisites`);
            setPrerequisites({
                checking: false,
                available: Boolean(response.data.available),
                error: response.data.error || null
            });
        } catch (err) {
            setPrerequisites({ checking: false, available: false, error: 'Failed to check' });
        }
    };

    useEffect(() => {
        if (step === 4 && installMode === 'auto') {
            checkPrerequisites();
        }
    }, [step, installMode]);

    useEffect(() => {
        if (step === 4) {
            loadJarFiles(settings.serverPath);
        }
    }, [step, settings.serverPath]);

    const startAutoInstall = async () => {
        if (!settings.serverPath) {
            return setError('Please specify a destination path');
        }
        if (!prerequisites.available) {
            return setError(prerequisites.error || 'Python 3 is required to run automatic installation.');
        }
        setError('');
        try {
            await axios.post(`${API_URL}/installer/start`, {
                targetPath: settings.serverPath,
                serverType: settings.serverType,
                serverVersion: settings.serverVersion,
                jarFile: settings.jarFile,
                serverName: settings.serverName
            });
            setInstallStatus((prev) => ({ ...prev, state: 'starting', progress: 0, error: null }));
            setStep(5);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to start installation');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        if (serverResetMode) {
            try {
                await settingsAPI.saveSetupPanelSettings(settings);
                window.location.href = '/';
            } catch (err) {
                setError(err.response?.data?.error || err.message || 'Failed to save server setup');
                setLoading(false);
            }
            return;
        }

        const result = await setup({
            user: {
                user: formData.user,
                // Email removed as per requirement
                password: formData.password
            },
            settings: settings
        });

        if (!result.success) {
            setError(result.error);
            setLoading(false);
        } else {
            window.location.href = '/login';
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSettingsChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const steps = [
        ...(serverResetMode ? [] : [{ n: 1, label: 'Account' }]),
        { n: 2, label: 'Environment' },
        { n: 3, label: 'Method' },
        { n: 4, label: 'Location' },
        { n: 5, label: 'Summary' }
    ].filter(s => !s.skip);

    return (
        <div className="login-page">
            <div className="login-overlay"></div>
            <div className="login-container fade-in">
                <div className="login-card">
                    <div className="setup-progress">
                        {steps.map((s, idx) => (
                            <div key={s.n} className="setup-progress-item">
                                <div className={`progress-dot ${step === s.n ? 'active' : (step > s.n ? 'completed' : '')}`}>
                                    {step > s.n ? <CheckCircle2 size={16} /> : s.n}
                                </div>
                                {idx < steps.length - 1 && <div className={`progress-line ${step > s.n ? 'active' : ''}`}></div>}
                            </div>
                        ))}
                    </div>

                    <div className="login-header">
                        <img src="/static/favicon.svg" alt="Minecraft Logo" className="login-logo" />
                        {step === 1 && !serverResetMode && (
                            <>
                                <h1>Primary Admin</h1>
                                <p>Create your master account</p>
                            </>
                        )}
                        {step === 2 && (
                            <>
                                <h1>Environment Check</h1>
                                <p>Verifying server platform and Java status</p>
                            </>
                        )}
                        {step === 3 && (
                            <>
                                <h1>Installation Method</h1>
                                <p>How would you like to set up the server?</p>
                            </>
                        )}
                        {step === 4 && (
                            <>
                                <h1>Server Location</h1>
                                <p>{installMode === 'auto' ? 'Where should we install the server?' : 'Specify where your server is located'}</p>
                            </>
                        )}
                        {step === 5 && (
                            <>
                                <h1>Installing...</h1>
                                <p>Downloading your selected server files</p>
                            </>
                        )}
                        {step === 6 && (
                            <>
                                <h1>Ready to Launch!</h1>
                                <p>Verify your settings and complete setup</p>
                            </>
                        )}
                    </div>

                    {error && (
                        <div className="login-error">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 1 && !serverResetMode && (
                        <div className="login-form">
                            <div className="form-group">
                                <label>Username</label>
                                <div className="input-with-icon">
                                    <User className="input-icon" size={18} />
                                    <input type="text" name="user" placeholder="admin" value={formData.user} onChange={handleChange} required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <div className="input-with-icon">
                                    <Lock className="input-icon" size={18} />
                                    <input type="password" name="password" placeholder="********" value={formData.password} onChange={handleChange} required minLength={6} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Confirm Password</label>
                                <div className="input-with-icon">
                                    <Lock className="input-icon" size={18} />
                                    <input type="password" name="confirmPassword" placeholder="********" value={formData.confirmPassword} onChange={handleChange} required />
                                </div>
                            </div>
                            <button onClick={handleNext} className="btn btn-primary login-btn">
                                Next Step <ArrowRight size={20} />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="login-form">
                            <div className="form-group">
                                <label>Operating System</label>
                                <select name="os" value={settings.os} onChange={handleSettingsChange}>
                                    <option value="windows">Windows</option>
                                    <option value="linux">Linux</option>
                                    <option value="macos">macOS</option>
                                </select>
                            </div>

                            <div className="java-status-card">
                                <div className="card-header">
                                    <Cpu size={20} className="text-blue" />
                                    <h4>Java Runtime Status</h4>
                                </div>
                                <div className="card-body">
                                    {!detection.results ? (
                                        <button onClick={detectSystem} disabled={detection.loading} className="btn btn-secondary check-btn">
                                            {detection.loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                                            Check Java Installation
                                        </button>
                                    ) : (
                                        <div className="java-result-container">
                                            <div className={`status-pill ${detection.results.javaVersion === 'Not Found' ? 'error' : 'success'}`}>
                                                {detection.results.javaVersion === 'Not Found' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                                                <div>
                                                    <strong>{detection.results.javaVersion === 'Not Found' ? 'Java Not Found' : 'Java Detected'}</strong>
                                                    <p>{detection.results.javaVersion}</p>
                                                </div>
                                            </div>

                                            {detection.results.javaVersion === 'Not Found' && (
                                                <div className="java-instructions fade-in">
                                                    <h5><Terminal size={16} /> How to install <strong>Java 25</strong>:</h5>

                                                    {settings.os === 'windows' ? (
                                                        <div className="instruction-steps">
                                                            <p>1. Download the <strong>x64 Installer</strong> from <a href="https://www.oracle.com/java/technologies/downloads/#java25" target="_blank" rel="noopener">Oracle</a> or <a href="https://adoptium.net/temurin/releases/?version=25" target="_blank" rel="noopener">Adoptium</a>.</p>
                                                            <p>2. Run the <code>.exe</code> and follow the installation wizard.</p>
                                                            <p>3. Restart this panel (or the command prompt) so it detects the new <code>PATH</code>.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="instruction-steps">
                                                            <p>Run these commands in your terminal:</p>
                                                            <pre>
                                                                <code>
                                                                    {`# Download Java 25\nwget https://download.oracle.com/java/25/latest/jdk-25_linux-x64_bin.tar.gz\n\n# Extract and setup\nsudo mkdir -p /usr/lib/jvm\nsudo tar -xzf jdk-25_linux-x64_bin.tar.gz -C /usr/lib/jvm/\n\n# Update alternatives\nsudo update-alternatives --install "/usr/bin/java" "java" "/usr/lib/jvm/jdk-25/bin/java" 1`}
                                                                </code>
                                                            </pre>
                                                        </div>
                                                    )}
                                                    <button onClick={detectSystem} className="btn-text-action">
                                                        <Search size={14} /> Re-scan for Java
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="multi-step-buttons">
                                <button onClick={handleBack} className="btn btn-secondary">
                                    <ArrowLeft size={18} /> Back
                                </button>
                                <button onClick={handleNext} className="btn btn-primary" disabled={!detection.results || detection.results.javaVersion === 'Not Found'}>
                                    Next Step <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="install-mode-grid">
                            <button
                                className={`install-mode-card ${installMode === 'auto' ? 'selected' : ''}`}
                                onClick={() => { setInstallMode('auto'); handleNext(); }}
                            >
                                <div className="mode-icon"><Download size={32} /></div>
                                <h3>Automatic Download</h3>
                                <p>Use built-in Python downloader with your selected server profile</p>
                            </button>

                            <button
                                className={`install-mode-card ${installMode === 'manual' ? 'selected' : ''}`}
                                onClick={() => { setInstallMode('manual'); handleNext(); }}
                            >
                                <div className="mode-icon"><Server size={32} /></div>
                                <h3>Manual Mode</h3>
                                <p>Point us to your existing server files</p>
                            </button>

                            <div className="multi-step-buttons" style={{ gridColumn: 'span 2' }}>
                                <button onClick={handleBack} className="btn btn-secondary">
                                    <ArrowLeft size={18} /> Back
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="login-form">
                            <div className="form-group">
                                <label>Server Name</label>
                                <div className="input-with-icon">
                                    <Settings className="input-icon" size={18} />
                                    <input
                                        type="text"
                                        name="serverName"
                                        placeholder="My Server"
                                        value={settings.serverName}
                                        onChange={handleSettingsChange}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Server Type</label>
                                <select name="serverType" value={settings.serverType} onChange={handleSettingsChange}>
                                    {SERVER_TYPES.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Server Version</label>
                                <div className="input-with-icon">
                                    <Tag className="input-icon" size={18} />
                                    <input
                                        type="text"
                                        name="serverVersion"
                                        placeholder="1.21.1"
                                        value={settings.serverVersion}
                                        onChange={handleSettingsChange}
                                    />
                                </div>
                                <small>Type the exact version you want to run.</small>
                            </div>

                            <div className="form-group">
                                <label>Server Files Path</label>
                                <div className="input-with-action">
                                    <div className="input-with-icon">
                                        <Server className="input-icon" size={18} />
                                        <input type="text" name="serverPath" placeholder="C:\Minecraft\Server" value={settings.serverPath} onChange={handleSettingsChange} />
                                    </div>
                                    <button
                                        onClick={browseForServerPath}
                                        disabled={browseLoading}
                                        className="btn-icon-action"
                                        title="Browse for folder"
                                        type="button"
                                    >
                                        {browseLoading ? <Loader2 className="animate-spin" size={18} /> : <FolderOpen size={18} />}
                                    </button>
                                    {installMode === 'manual' && (
                                        <button onClick={detectSystem} disabled={detection.loading} className="btn-icon-action" title="Auto-detect existing" type="button">
                                            {detection.loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                                        </button>
                                    )}
                                    {installMode === 'manual' && detection.results?.detectedPath && (
                                        <div className="detection-tag tag-success" style={{ marginTop: '10px' }}>
                                            <CheckCircle2 size={14} /> Found existing server at location
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Server Jar</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <input
                                        type="text"
                                        name="jarFile"
                                        placeholder="server.jar"
                                        value={settings.jarFile}
                                        onChange={handleSettingsChange}
                                        style={{ flex: 1, minWidth: '230px' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setSettings((prev) => ({
                                            ...prev,
                                            jarFile: suggestJarFile(prev.serverType, prev.serverVersion)
                                        }))}
                                    >
                                        Suggest Jar
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => loadJarFiles(settings.serverPath)}
                                        disabled={jarLoading}
                                    >
                                        {jarLoading ? 'Scanning...' : 'Scan Jars'}
                                    </button>
                                </div>
                                {jarFiles.length > 0 && (
                                    <div style={{ marginTop: '8px' }}>
                                        <small style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                                            Detected jar files:
                                        </small>
                                        <select
                                            value={settings.jarFile}
                                            onChange={(e) => setSettings((prev) => ({ ...prev, jarFile: e.target.value }))}
                                        >
                                            {jarFiles.map((jar) => (
                                                <option key={jar} value={jar}>{jar}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {installMode === 'auto' && (
                                <div style={{ marginTop: '1rem' }}>
                                    {prerequisites.checking ? (
                                        <div className="status-pill"><Loader2 className="animate-spin" size={14} /> Checking system requirements...</div>
                                    ) : !prerequisites.available ? (
                                        <div className="java-status-card" style={{ border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)' }}>
                                            <div className="card-header" style={{ color: '#ef4444' }}>
                                                <AlertCircle size={20} />
                                                <h4>Python 3 Required</h4>
                                            </div>
                                            <div className="card-body">
                                                <p style={{ marginBottom: '10px' }}>
                                                    Automatic install now uses the bundled Python downloader script.
                                                    Install Python 3 and try the prerequisite check again.
                                                </p>
                                                {prerequisites.error && (
                                                    <p style={{ marginBottom: '10px', color: '#fca5a5' }}>{prerequisites.error}</p>
                                                )}

                                                <button onClick={checkPrerequisites} className="btn-text-action" style={{ marginTop: '10px' }}>
                                                    <Search size={14} /> Check Again
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="detection-tag tag-success">
                                            <CheckCircle2 size={14} /> Python downloader ready
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="multi-step-buttons">
                                <button onClick={handleBack} className="btn btn-secondary">
                                    <ArrowLeft size={18} /> Back
                                </button>
                                {installMode === 'auto' ? (
                                    <button onClick={startAutoInstall} className="btn btn-primary" disabled={!prerequisites.available || prerequisites.checking}>
                                        Start Installation <Download size={18} />
                                    </button>
                                ) : (
                                    <button onClick={() => setStep(5)} className="btn btn-primary">
                                        Next Step <ArrowRight size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="setup-summary">
                            <div className="summary-section">
                                <h3>Review Settings</h3>
                                <div className="summary-item">
                                    <div className="summary-label"><User size={14} /> Admin Account</div>
                                    <div className="summary-value">{serverResetMode ? 'Existing account retained' : formData.user}</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label"><Globe size={14} /> Environment</div>
                                    <div className="summary-value">{settings.os} - Port {settings.port}</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label"><Server size={14} /> Server Profile</div>
                                    <div className="summary-value">
                                        {settings.serverName} ({settings.serverType}{settings.serverVersion ? ` ${settings.serverVersion}` : ''})
                                    </div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label"><Server size={14} /> Server Path</div>
                                    <div className="summary-value">{settings.serverPath}</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label"><Terminal size={14} /> Jar File</div>
                                    <div className="summary-value">{settings.jarFile}</div>
                                </div>
                            </div>

                            {/* Installation Progress UI - shown when installing */}
                            {(installStatus.state !== 'idle' && installStatus.state !== 'finished' && installStatus.state !== 'error') && (
                                <div className="install-process-card" style={{ marginTop: '20px', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                                    {(installStatus.state === 'downloading_game' || installStatus.state === 'starting') && (
                                        <div className="download-step fade-in" style={{ padding: 0, marginTop: 0 }}>
                                            <div className="progress-container">
                                                <div className="progress-label">
                                                    <span>Downloading Minecraft Server...</span>
                                                    <span>{installStatus.progress}%</span>
                                                </div>
                                                <div className="progress-bar-bg">
                                                    <div className="progress-bar-fill" style={{ width: `${installStatus.progress}%` }}></div>
                                                </div>
                                                {installStatus.logs?.length > 0 && (
                                                    <div className="progress-note">{installStatus.logs[installStatus.logs.length - 1]}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="multi-step-buttons" style={{ marginTop: '30px' }}>
                                <button onClick={handleBack} className="btn btn-secondary" disabled={loading || (installStatus.state !== 'idle' && installStatus.state !== 'error')}>
                                    <ArrowLeft size={18} /> Back
                                </button>

                                {installMode === 'auto' && (installStatus.state === 'idle' || installStatus.state === 'error') ? (
                                    <button onClick={startAutoInstall} className="btn btn-primary">
                                        Start Install & Setup <Download size={18} />
                                    </button>
                                ) : (
                                    <button onClick={handleSubmit} className="btn btn-primary" disabled={loading || (installMode === 'auto' && installStatus.state !== 'finished')}>
                                        {loading ? 'Finalizing Setup...' : (installMode === 'manual' ? (serverResetMode ? 'Complete Server Setup' : 'Complete Setup') : (installStatus.state === 'finished' ? (serverResetMode ? 'Complete Server Setup' : 'Complete Setup') : 'Installing...'))}
                                        {installStatus.state === 'finished' || installMode === 'manual' ? <CheckCircle2 size={18} /> : (loading ? <Loader2 className="animate-spin" size={18} /> : null)}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SetupPage;









