import express from 'express';
import packProviderService from '../services/packProviderService.js';
import packInstallService from '../services/packInstallService.js';
import serverExportService from '../services/serverExportService.js';

const router = express.Router();

router.get('/providers', async (req, res) => {
  try {
    const providers = await packProviderService.getProviders();
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/providers', async (req, res) => {
  try {
    const providers = await packProviderService.addCommunityProvider(req.body || {});
    res.json(providers);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/providers', async (req, res) => {
  try {
    const providers = await packProviderService.removeCommunityProvider(req.body?.url);
    res.json(providers);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const packs = await packProviderService.getAllPacks();
    res.json(packs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/install', async (req, res) => {
  try {
    const result = await packInstallService.installPack(req.body?.pack || req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/export-zip', async (req, res) => {
  try {
    const includePaths = Array.isArray(req.body?.includePaths) ? req.body.includePaths : [];
    const { zip, fileName } = await serverExportService.buildZipArchive(includePaths);
    const buffer = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
