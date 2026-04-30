import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, User, Lock, AlertCircle } from 'lucide-react';
import { PANEL_VERSION } from '../config';
import './LoginPage.css';

function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotUser, setForgotUser] = useState('');
    const [forgotSecret, setForgotSecret] = useState('');
    const [forgotResult, setForgotResult] = useState('');
    const [forgotError, setForgotError] = useState('');

    const [showChangeModal, setShowChangeModal] = useState(false);
    const [changeCurrent, setChangeCurrent] = useState('');
    const [changeNew, setChangeNew] = useState('');
    const [changeConfirm, setChangeConfirm] = useState('');
    const [changeError, setChangeError] = useState('');
    const [changeLoading, setChangeLoading] = useState(false);

    const { login, forgotPassword, changePassword } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(username, password);
        if (!result.success) {
            setError(result.error);
            setLoading(false);
            return;
        }

        setLoading(false);
        if (result.forcePasswordChange) {
            setShowChangeModal(true);
            setChangeCurrent('');
            setChangeNew('');
            setChangeConfirm('');
            return;
        }

        navigate('/');
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setForgotError('');
        setForgotResult('');

        const result = await forgotPassword(forgotUser, forgotSecret);
        if (!result.success) {
            setForgotError(result.error);
            return;
        }

        setForgotResult(result.data?.temporaryPassword || '');
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setChangeError('');

        if (!changeCurrent || !changeNew || !changeConfirm) {
            setChangeError('All fields are required');
            return;
        }
        if (changeNew.length < 8) {
            setChangeError('New password must be at least 8 characters');
            return;
        }
        if (changeNew !== changeConfirm) {
            setChangeError('New passwords do not match');
            return;
        }

        setChangeLoading(true);
        const result = await changePassword(changeCurrent, changeNew);
        setChangeLoading(false);

        if (!result.success) {
            setChangeError(result.error);
            return;
        }

        setShowChangeModal(false);
        navigate('/');
    };

    return (
        <div className="login-page">
            <div className="login-overlay"></div>
            <div className="login-container fade-in">
                <div className="login-card">
                    <div className="login-header">
                        <img src="/static/favicon.svg" alt="Minecraft Logo" className="login-logo" onError={(e) => { e.target.style.display = 'none'; }} />
                        <h1>Server Control Panel</h1>
                        <p>Log in to manage your server</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        {error && (
                            <div className="login-error">
                                <AlertCircle size={18} />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="form-group">
                            <label>Username</label>
                            <div className="input-with-icon">
                                <User className="input-icon" size={18} />
                                <input
                                    id="login-username"
                                    name="username"
                                    type="text"
                                    placeholder="Your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <div className="input-with-icon">
                                <Lock className="input-icon" size={18} />
                                <input
                                    id="login-password"
                                    name="password"
                                    type="password"
                                    placeholder="********"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            className="btn btn-link"
                            style={{ color: '#3b82f6', padding: 0, border: 'none', background: 'transparent', textAlign: 'left' }}
                            onClick={() => {
                                setForgotUser(username || '');
                                setForgotSecret('');
                                setForgotResult('');
                                setForgotError('');
                                setShowForgotModal(true);
                            }}
                        >
                            Forgot password?
                        </button>

                        <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                            <LogIn size={20} />
                            {loading ? 'Logging in...' : 'Enter Panel'}
                        </button>
                    </form>

                    <div className="login-footer">
                        <p>&copy; 2026 Minecraft Server Panel <span className="login-version">v{PANEL_VERSION}</span></p>
                    </div>
                </div>
            </div>

            {showForgotModal && (
                <div className="modal-overlay">
                    <div className="modal-content card">
                        <h2 className="card-title">Reset Password</h2>
                        <form onSubmit={handleForgotPassword} className="user-form">
                            {forgotError && <div className="login-error"><AlertCircle size={18} /> {forgotError}</div>}

                            <div className="form-group">
                                <label>Username</label>
                                <input type="text" value={forgotUser} onChange={(e) => setForgotUser(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Secret Key</label>
                                <input type="text" value={forgotSecret} onChange={(e) => setForgotSecret(e.target.value)} required />
                            </div>

                            {forgotResult && (
                                <div className="status-badge status-online" style={{ display: 'block', marginBottom: '12px' }}>
                                    Temporary password: <strong>{forgotResult}</strong>
                                </div>
                            )}

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForgotModal(false)}>
                                    Close
                                </button>
                                <button type="submit" className="btn btn-primary">Generate Temporary Password</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showChangeModal && (
                <div className="modal-overlay">
                    <div className="modal-content card">
                        <h2 className="card-title">Change Password Required</h2>
                        <form onSubmit={handleChangePassword} className="user-form">
                            {changeError && <div className="login-error"><AlertCircle size={18} /> {changeError}</div>}

                            <div className="form-group">
                                <label>Current Password (temporary)</label>
                                <input type="password" value={changeCurrent} onChange={(e) => setChangeCurrent(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>New Password</label>
                                <input type="password" value={changeNew} onChange={(e) => setChangeNew(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Confirm New Password</label>
                                <input type="password" value={changeConfirm} onChange={(e) => setChangeConfirm(e.target.value)} required />
                            </div>

                            <div className="modal-actions">
                                <button type="submit" className="btn btn-primary" disabled={changeLoading}>
                                    {changeLoading ? 'Saving...' : 'Save New Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LoginPage;

