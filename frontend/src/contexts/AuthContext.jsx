import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [needsSetup, setNeedsSetup] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            try {
                // Critical: Check setup first, await it fully
                await checkSetup();

                const storedUser = localStorage.getItem('user');
                const token = localStorage.getItem('token');

                if (storedUser && token) {
                    setUser(JSON.parse(storedUser));
                    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                }
            } catch (err) {
                console.error('Auth initialization error:', err);
            } finally {
                // Only stop loading after everything is done
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    const checkSetup = async () => {
        try {
            const response = await axios.get(`${API_URL}/auth/setup-needed`, {
                timeout: 8000
            });
            setNeedsSetup(response.data.needed);
        } catch (error) {
            console.error('Failed to check setup status:', error);
            // Keep setup mode on transient startup failures so first-run does not bounce to /login.
            setNeedsSetup(true);
        }
    };

    const login = async (username, password) => {
        try {
            const response = await axios.post(`${API_URL}/auth/login`, { user: username, password });
            const { token, user: userData, forcePasswordChange } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            setUser(userData);
            return { success: true, forcePasswordChange: Boolean(forcePasswordChange) };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Error logging in'
            };
        }
    };

    const forgotPassword = async (username, secretKey) => {
        try {
            const response = await axios.post(`${API_URL}/auth/forgot-password`, {
                user: username,
                secretKey
            });
            return { success: true, data: response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Error resetting password'
            };
        }
    };

    const changePassword = async (currentPassword, newPassword) => {
        try {
            await axios.post(`${API_URL}/auth/change-password`, {
                currentPassword,
                newPassword
            });

            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                const parsed = JSON.parse(storedUser);
                const updated = { ...parsed, forcePasswordChange: false };
                localStorage.setItem('user', JSON.stringify(updated));
                setUser(updated);
            }
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Error changing password'
            };
        }
    };

    const setup = async (setupData) => {
        try {
            await axios.post(`${API_URL}/auth/setup`, setupData);
            setNeedsSetup(false);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Error during setup'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    const value = {
        user,
        loading,
        needsSetup,
        login,
        forgotPassword,
        changePassword,
        setup,
        logout,
        checkSetup
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
