import express from 'express';
import multer from 'multer';
import pluginService from '../services/pluginService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// List all plugins
router.get('/list', async (req, res) => {
  try {
    const plugins = await pluginService.listPlugins();
    res.json(plugins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload plugin
router.post('/upload', upload.single('plugin'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Plugin file is required' });
    }

    const result = await pluginService.uploadPlugin(
      req.file.originalname,
      req.file.buffer
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete plugin
router.delete('/delete', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Plugin name is required' });
    }

    const result = await pluginService.deletePlugin(name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search Mods (Provider)
router.get('/search', async (req, res) => {
  try {
    const { provider, query, page, pageSize, serverType, serverVersion, resourceType } = req.query;
    if (!provider) return res.status(400).json({ error: 'Provider is required' });
    const safeQuery = String(query || '').trim();

    const modProviderService = (await import('../services/modProviderService.js')).default;
    const results = await modProviderService.search(provider, safeQuery, {
      page,
      pageSize,
      serverType,
      serverVersion,
      resourceType
    });
    res.json(results);
  } catch (error) {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      return res.status(400).json({ error: 'Provider authentication failed. Check the API key/token in Providers settings.' });
    }
    if (status === 404) {
      return res.status(404).json({ error: 'No results found for this provider query.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// List available providers
router.get('/providers', async (req, res) => {
  try {
    const { serverType, resourceType } = req.query;
    const modProviderService = (await import('../services/modProviderService.js')).default;
    res.json({
      providers: await modProviderService.getProviderNames({ serverType, resourceType })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Get Download URL (Provider)
router.get('/download-url', async (req, res) => {
  try {
    const { provider, modId, fileId, serverType, serverVersion, resourceType } = req.query;
    if (!provider || !modId) return res.status(400).json({ error: 'Provider and modId are required' });

    const modProviderService = (await import('../services/modProviderService.js')).default;
    const url = await modProviderService.getDownloadUrl(provider, modId, fileId, {
      serverType,
      serverVersion,
      resourceType
    });
    res.json({ url });
  } catch (error) {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      return res.status(400).json({ error: 'Provider authentication failed. Check the API key/token in Providers settings.' });
    }
    if (status === 404) {
      return res.status(404).json({ error: 'Provider resource was not found.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Install from URL
router.post('/install-remote', async (req, res) => {
  try {
    const { url, filename, metadata } = req.body;
    if (!url || !filename) return res.status(400).json({ error: 'URL and filename required' });

    await pluginService.installFromUrl(url, filename, metadata);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
