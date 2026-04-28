import express from 'express';
import installerService from '../services/installerService.js';

const router = express.Router();

router.get('/status', (req, res) => {
    res.json(installerService.getStatus());
});

router.get('/prerequisites', async (req, res) => {
    try {
        const result = await installerService.checkDownloaderAvailable();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/download-tool', (req, res) => {
    res.status(410).json({
        error: 'download-tool is no longer required. Python downloader is bundled with the backend.'
    });
});

router.post('/start', async (req, res) => {
    try {
        const {
            targetPath,
            serverType,
            serverVersion,
            jarFile,
            serverName
        } = req.body || {};

        if (!targetPath) {
            return res.status(400).json({ error: 'Target path is required' });
        }

        await installerService.startDownload({
            targetPath,
            serverType,
            serverVersion,
            jarFile,
            serverName
        });

        res.json({ message: 'Installation started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/cancel', async (req, res) => {
    try {
        await installerService.cancelDownload();
        res.json({ message: 'Installation cancelled' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
