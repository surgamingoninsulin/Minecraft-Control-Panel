import express from 'express';
import settingsService from '../services/settingsService.js';
import minecraftConfigService from '../services/minecraftConfigService.js';
import suggestionService from '../services/suggestionService.js';

const router = express.Router();

// --- Panel Settings ---

router.get('/panel', async (req, res) => {
    try {
        const settings = await settingsService.get();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/panel', async (req, res) => {
    try {
        const allowProtectedUpdates = req.body?.__allowProtectedUpdates === true;
        const updates = { ...(req.body || {}) };
        delete updates.__allowProtectedUpdates;
        const settings = await settingsService.update(updates, { allowProtectedUpdates });
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Setup/reset flow: allow protected fields like serverPath/serverType/jarFile to be updated.
router.post('/panel/setup', async (req, res) => {
    try {
        const settings = await settingsService.update(req.body, { allowProtectedUpdates: true });
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/detect', async (req, res) => {
    try {
        const info = await settingsService.detectSystem();
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/jar-files', async (req, res) => {
    try {
        const { serverPath } = req.query;
        const jars = await settingsService.listServerJars(serverPath || null);
        res.json({ jars });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Server Settings (server.properties) ---

router.get('/server', async (req, res) => {
    try {
        const config = await minecraftConfigService.get();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/server', async (req, res) => {
    try {
        const config = await minecraftConfigService.update(req.body);
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Generic File Settings (bans, permissions, whitelist) ---

router.get('/files/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const content = await minecraftConfigService.getFile(filename);
        res.json(content);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/files/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const content = await minecraftConfigService.saveFile(filename, req.body);
        res.json(content);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/text-files/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const content = await minecraftConfigService.getTextFile(filename);
        res.json(content);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/text-files/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const content = await minecraftConfigService.saveTextFile(filename, req.body?.content);
        res.json(content);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/files-list', async (req, res) => {
    try {
        res.json(minecraftConfigService.getAllowedFiles());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/suggestions/gist', async (req, res) => {
    try {
        const { category, content } = req.body || {};
        const requestedBy = String(req.user?.username || req.user?.id || 'unknown');
        const result = await suggestionService.createGistSuggestionIssue({
            rawText: String(content || ''),
            category: String(category || ''),
            requestedBy
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
export default router;


