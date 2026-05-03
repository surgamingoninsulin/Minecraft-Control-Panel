import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import ConsolePage from './pages/ConsolePage';
import SettingsPage from './pages/SettingsPage';
import FilesPage from './pages/FilesPage';
import PluginsPage from './pages/PluginsPage';
import ModsPage from './pages/ModsPage';
import UsersPage from './pages/UsersPage';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import NotFoundPage from './pages/NotFoundPage';
import WorldsPage from './pages/WorldsPage';
import AboutPage from './pages/AboutPage';
import PlayersPage from './pages/PlayersPage';
import PacksPage from './pages/PacksPage';
import ScrollToTop from './components/common/ScrollToTop';
import { DialogProvider } from './contexts/DialogContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './styles/global.css';

function AppRoutes() {
  const { user, needsSetup, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white' }}>
        Loading...
      </div>
    );
  }

  if (needsSetup) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      {/* Fallback if priority 1 fails for some reason, though it shouldn't */}
      <Route path="/setup" element={needsSetup ? <SetupPage /> : <Navigate to="/" replace />} />
      <Route path="/server-setup" element={user ? <SetupPage serverResetMode /> : <Navigate to="/login" replace />} />

      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="console" element={<ConsolePage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="plugins" element={<PluginsPage />} />
        <Route path="mods" element={<ModsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="worlds" element={<WorldsPage />} />
        <Route path="packs" element={<PacksPage />} />
        <Route path="about" element={<AboutPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    let isLocked = false;
    let lockScrollY = 0;
    const original = {
      overflow: '',
      position: '',
      top: '',
      left: '',
      right: '',
      width: ''
    };

    const lockBodyScroll = () => {
      if (isLocked) return;
      const body = document.body;
      const html = document.documentElement;
      lockScrollY = window.scrollY || window.pageYOffset || 0;

      original.overflow = body.style.overflow;
      original.position = body.style.position;
      original.top = body.style.top;
      original.left = body.style.left;
      original.right = body.style.right;
      original.width = body.style.width;

      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${lockScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.classList.add('modal-open');
      html.classList.add('modal-open');
      isLocked = true;
    };

    const unlockBodyScroll = () => {
      if (!isLocked) return;
      const body = document.body;
      const html = document.documentElement;
      body.style.overflow = original.overflow;
      body.style.position = original.position;
      body.style.top = original.top;
      body.style.left = original.left;
      body.style.right = original.right;
      body.style.width = original.width;
      body.classList.remove('modal-open');
      html.classList.remove('modal-open');
      window.scrollTo(0, lockScrollY);
      isLocked = false;
    };

    const updateScrollLock = () => {
      const hasOpenOverlay =
        !!document.querySelector('.modal-overlay') ||
        !!document.querySelector('.dialog-overlay');

      if (hasOpenOverlay) {
        lockBodyScroll();
      } else {
        unlockBodyScroll();
      }
    };

    const observer = new MutationObserver(updateScrollLock);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    updateScrollLock();

    return () => {
      observer.disconnect();
      unlockBodyScroll();
    };
  }, []);

  return (
    <AuthProvider>
      <DialogProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <AppRoutes />
        </BrowserRouter>
      </DialogProvider>
    </AuthProvider>
  );
}

export default App;

