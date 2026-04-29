import express from 'express';
import multer from 'multer';
import worldService from '../services/worldService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

router.post('/:name/datapacks/upload', upload.fields([{ name: 'datapack', maxCount: 20 }, { name: 'datapacks', maxCount: 50 }]), async (req, res) => {
    try {
        const singleFiles = req.files?.datapack || [];
        const multiFiles = req.files?.datapacks || [];
        const allFiles = [...singleFiles, ...multiFiles];
        if (!allFiles.length) return res.status(400).json({ error: 'Datapack file is required' });
        const metadataRaw = req.body?.metadata;
        let metadata = {};
        if (metadataRaw) {
            try {
                metadata = typeof metadataRaw === 'string' ? JSON.parse(metadataRaw) : metadataRaw;
            } catch {
                metadata = {};
            }
        }
        const uploaded = [];
        for (const file of allFiles) {
            const perFileMetadata = {
                ...metadata,
                name: file.originalname.replace(/\.zip$/i, '')
            };
            const result = await worldService.uploadDatapack(req.params.name, file.originalname, file.buffer, perFileMetadata);
            uploaded.push(result.filename || file.originalname);
        }
        res.json({ success: true, uploaded });
    } catch (error) {
        console.error('[WorldRoutes] Datapack upload failed:', error?.stack || error?.message || error);
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
