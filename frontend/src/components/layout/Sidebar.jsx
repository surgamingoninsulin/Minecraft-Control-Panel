import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Terminal,
  FolderOpen,
  Package,
  Archive,
  ChevronDown,
  ChevronRight,
  Settings,
  Users,
  LogOut,
  Globe,
  Info,
  User as UserIcon,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDialog } from '../../contexts/DialogContext';
import { serverAPI } from '../../services/api';
import * as settingsAPI from '../../services/settingsApi';
import { PANEL_VERSION } from '../../config';
import './Sidebar.css';

function Sidebar() {
  const MANAGERS_DROPDOWN_STORAGE_KEY = 'sidebar_managers_dropdown_open';
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showConfirm, showAlert } = useDialog();
  const [serverType, setServerType] = useState('vanilla');
  const [managersOpen, setManagersOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(MANAGERS_DROPDOWN_STORAGE_KEY);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch {
      // ignore storage errors and use default
    }
    return false;
  });

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      try {
        const settings = await settingsAPI.getPanelSettings();
        if (mounted) {
          setServerType(String(settings?.serverType || 'vanilla').toLowerCase());
        }
      } catch {
        if (mounted) {
          setServerType('vanilla');
        }
      }
    };
    loadSettings();
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(MANAGERS_DROPDOWN_STORAGE_KEY, managersOpen ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
  }, [managersOpen]);

  const handleLogout = async () => {
    const confirmed = await showConfirm(
      'Are you sure you want to log out of the Minecraft Panel?',
      'Confirm Logout'
    );

    if (confirmed) {
      logout();
    }
  };

  const handleServerReset = async () => {
    const confirmed = await showConfirm(
      'This will clear all files inside your configured server folder, keep the folder itself, and restart server setup only. No = cancel, Yes = continue.',
      'Confirm Server Reset'
    );

    if (!confirmed) return;

    try {
      await serverAPI.resetSetup();
      await showAlert('Server folder cleared. Starting server setup flow.', 'Server Reset Complete');
      navigate('/server-setup');
    } catch (error) {
      showAlert(error.response?.data?.error || error.message || 'Server reset failed.', 'Error');
    }
  };

  const managerItems = [
    { path: '/packs', icon: Archive, label: 'Packs' },
    { path: '/worlds', icon: Globe, label: 'Datapacks' },
    { path: '/plugins', icon: Package, label: 'Plugins', disabled: serverType === 'vanilla' },
    { path: '/mods', icon: Package, label: 'Mods', disabled: !['forge', 'fabric', 'neoforge'].includes(serverType) },
  ];

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/console', icon: Terminal, label: 'Console' },
    { path: '/files', icon: FolderOpen, label: 'Files' },
    { path: '/players', icon: Users, label: 'Players' },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ path: '/users', icon: Users, label: 'Users' });
  }

  menuItems.push({ path: '/settings', icon: Settings, label: 'Settings' });

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/static/favicon.svg" alt="Minecraft Panel" className="sidebar-logo" />
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.disabled ? '#' : item.path}
              className={`nav-item ${isActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
              onClick={(e) => {
                if (!item.disabled) return;
                e.preventDefault();
              }}
              aria-disabled={item.disabled ? 'true' : 'false'}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className={`nav-item nav-item-button ${managerItems.some((entry) => location.pathname === entry.path) ? 'active' : ''}`}
          onClick={() => setManagersOpen((prev) => !prev)}
          aria-expanded={managersOpen ? 'true' : 'false'}
        >
          {managersOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <span>Managers</span>
        </button>

        {managersOpen && (
          <div className="nav-submenu">
            {managerItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.disabled ? '#' : item.path}
                  className={`nav-item nav-subitem ${isActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
                  onClick={(e) => {
                    if (!item.disabled) return;
                    e.preventDefault();
                  }}
                  aria-disabled={item.disabled ? 'true' : 'false'}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="nav-item nav-item-button"
          onClick={handleServerReset}
        >
          <RotateCcw size={20} />
          <span>Server Reset</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-profile-info">
            <div className="user-avatar-sm">
              <UserIcon size={14} />
            </div>
            <div className="user-details">
              <span className="username">{user?.user}</span>
              <span className="user-role">{user?.role === 'admin' ? 'Primary Admin' : 'Collaborator'}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Log Out">
            <LogOut size={18} />
          </button>
        </div>
        <div className="server-version">
          <span className="version-label">Version</span>
          <span className="version-number">{PANEL_VERSION}</span>
        </div>
      </div>

      <div className="sidebar-lower-section">
        <Link
          to="/about"
          className={`nav-item sidebar-lower-about-btn ${location.pathname === '/about' ? 'active' : ''}`}
        >
          <Info size={20} />
          <span>About</span>
        </Link>
      </div>
    </aside>
  );
}

export default Sidebar;

