import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timed out. Backend may be busy or unreachable.';
    }
    if (error.response?.status === 401) {
      // Token is invalid, clear storage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Server API
export const serverAPI = {
  getStatus: () => api.get('/server/status'),
  start: () => api.post('/server/start'),
  stop: () => api.post('/server/stop'),
  restart: () => api.post('/server/restart'),
  sendCommand: (command) => api.post('/server/command', { command }),
  resetSetup: () => api.post('/server/reset-setup')
};

// File API
export const fileAPI = {
  list: (directory = '') => api.get('/files/list', { params: { directory } }),
  read: (path) => api.get('/files/read', { params: { path } }),
  write: (path, content) => api.post('/files/write', { path, content }),
  delete: (path) => api.delete('/files/delete', { data: { path } }),
  createDirectory: (path) => api.post('/files/mkdir', { path }),
  upload: (path, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// Plugin API
export const pluginAPI = {
  list: () => api.get('/plugins/list'),
  upload: (file) => {
    const formData = new FormData();
    formData.append('plugin', file);
    return api.post('/plugins/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  delete: (name) => api.delete('/plugins/delete', { data: { name } }),
  providers: (options = {}) => api.get('/plugins/providers', {
    params: {
      serverType: options.serverType,
      resourceType: options.resourceType
    }
  }),
  search: (provider, query, options = {}) => api.get('/plugins/search', {
    params: {
      provider,
      query,
      page: options.page,
      pageSize: options.pageSize,
      serverType: options.serverType,
      serverVersion: options.serverVersion,
      resourceType: options.resourceType
    }
  }),
  getDownloadUrl: (provider, modId, fileId, options = {}) => api.get('/plugins/download-url', {
    params: {
      provider,
      modId,
      fileId,
      serverType: options.serverType,
      serverVersion: options.serverVersion,
      resourceType: options.resourceType
    }
  }),
  installRemote: (url, filename, metadata) => api.post('/plugins/install-remote', { url, filename, metadata })
};

// Playit API
export const playitAPI = {
  getStatus: () => api.get('/playit/status'),
  start: () => api.post('/playit/start'),
  stop: () => api.post('/playit/stop'),
  getUrl: () => api.get('/playit/url')
};

// World API
export const worldAPI = {
  list: () => api.get('/worlds'),
  get: (name) => api.get(`/worlds/${encodeURIComponent(name)}`),
  saveConfig: (name, config) => api.post(`/worlds/${encodeURIComponent(name)}/config`, config),
  installDatapack: (name, url, filename, metadata) => api.post(`/worlds/${encodeURIComponent(name)}/datapacks/install`, { url, filename, metadata }),
  uploadDatapack: (name, file, metadata = {}) => {
    const formData = new FormData();
    formData.append('datapack', file);
    formData.append('metadata', JSON.stringify(metadata));
    return api.post(`/worlds/${encodeURIComponent(name)}/datapacks/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadDatapacks: (name, files, metadata = {}) => {
    const formData = new FormData();
    Array.from(files || []).forEach((file) => {
      formData.append('datapacks', file);
    });
    formData.append('metadata', JSON.stringify(metadata));
    return api.post(`/worlds/${encodeURIComponent(name)}/datapacks/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteDatapack: (name, datapackName) => api.delete(`/worlds/${encodeURIComponent(name)}/datapacks/delete`, { data: { datapackName } })
};

// User API
export const userAPI = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  toggleActive: (id) => api.post(`/users/${id}/toggle-active`),
  generateResetSecret: (id) => api.post(`/users/${id}/generate-reset-secret`)
};

// Player API
export const playerAPI = {
  list: () => api.get('/players/list'),
  add: (name) => api.post('/players/add', { name }),
  get: (uuid) => api.get(`/players/${uuid}`),
  update: (uuid, data) => api.put(`/players/${uuid}`, data),
  setOp: (uuid, isOp, name) => api.post(`/players/${uuid}/op`, { isOp, name }),
  setWhitelist: (uuid, isWhitelisted, name) => api.post(`/players/${uuid}/whitelist`, { isWhitelisted, name }),
  remove: (uuid) => api.post('/players/remove', { uuid }),
  delete: (uuid) => api.delete(`/players/${uuid}`)
};

export default api;

