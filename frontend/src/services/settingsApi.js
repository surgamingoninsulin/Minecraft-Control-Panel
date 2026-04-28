import api from './api';

export const getPanelSettings = async () => {
    const response = await api.get('/settings/panel');
    return response.data;
};

export const detectSystem = async () => {
    const response = await api.get('/settings/detect');
    return response.data;
};

export const savePanelSettings = async (settings) => {
    const response = await api.post('/settings/panel', settings);
    return response.data;
};

export const saveSetupPanelSettings = async (settings) => {
    try {
        const response = await api.post('/settings/panel/setup', settings);
        return response.data;
    } catch (error) {
        if (error?.response?.status !== 404) {
            throw error;
        }

        // Backward-compatible fallback for backends that don't expose /settings/panel/setup yet.
        const response = await api.post('/settings/panel', {
            ...(settings || {}),
            __allowProtectedUpdates: true
        });
        return response.data;
    }
};

export const listServerJars = async (serverPath = '') => {
    const response = await api.get('/settings/jar-files', {
        params: { serverPath }
    });
    return response.data?.jars || [];
};

export const getServerSettings = async () => {
    const response = await api.get('/settings/server');
    return response.data;
};

export const saveServerSettings = async (settings) => {
    const response = await api.post('/settings/server', settings);
    return response.data;
};

export const getFileSettings = async (filename) => {
    const response = await api.get(`/settings/files/${filename}`);
    return response.data;
};

export const saveFileSettings = async (filename, content) => {
    const response = await api.post(`/settings/files/${filename}`, content);
    return response.data;
};

export const getTextFileSettings = async (filename) => {
    const response = await api.get(`/settings/text-files/${filename}`);
    return response.data;
};

export const saveTextFileSettings = async (filename, content) => {
    const response = await api.post(`/settings/text-files/${filename}`, { content });
    return response.data;
};

export const getEditableFiles = async () => {
    const response = await api.get('/settings/files-list');
    return response.data;
};

export const submitGistSuggestion = async ({ category, content }) => {
    const response = await api.post('/settings/suggestions/gist', {
        category,
        content
    });
    return response.data;
};
