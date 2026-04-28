import express from 'express';
import worldService from '../services/worldService.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const worlds = await worldService.listWorlds();
        res.json(worlds);
    } catch (error) {
        console.error('[WorldRoutes] Error listing worlds:', error);
        res.json([]);
    }
});

router.get('/:name', async (req, res) => {
    try {
        const detail = await worldService.getWorld(req.params.name);
        if (!detail) {
            return res.status(404).json({ error: 'World not found' });
        }
        res.json(detail);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:name/config', async (req, res) => {
    try {
        await worldService.updateWorldConfig(req.params.name, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:name/datapacks/install', async (req, res) => {
    try {
        const { url, filename, metadata } = req.body;
        const result = await worldService.installDatapackFromUrl(req.params.name, url, filename, metadata);
        res.json(result);
    } catch (error) {
        console.error('[WorldRoutes] Datapack install failed:', error?.stack || error?.message || error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:name/datapacks/delete', async (req, res) => {
    try {
        const { datapackName } = req.body;
        const result = await worldService.uninstallDatapack(req.params.name, datapackName);
        res.json(result);
    } catch (error) {
        console.error('[WorldRoutes] Datapack uninstall failed:', error?.stack || error?.message || error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
