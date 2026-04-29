import express from 'express';
import multer from 'multer';
import pluginService from '../services/pluginService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const TEMP_VELOCITY_DISABLED_MESSAGE = 'Velocity plugin install/browse is temporarily disabled.';

function isClientCompatibilityError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('not available for server type')
    || message.includes('no compatible velocity')
    || message.includes('supports plugin/proxy server types only')
    || message.includes('paid spigot plugins are not supported');
}

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
    if (String(serverType || '').trim().toLowerCase() === 'velocity') {
      // TEMP DISABLED: keep backend code-path for future re-enable.
      return res.status(400).json({ error: TEMP_VELOCITY_DISABLED_MESSAGE });
    }
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
    if (String(serverType || '').trim().toLowerCase() === 'velocity') {
      // TEMP DISABLED: keep backend code-path for future re-enable.
      return res.json({ providers: [] });
    }
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
    if (String(serverType || '').trim().toLowerCase() === 'velocity') {
      // TEMP DISABLED: keep backend code-path for future re-enable.
      return res.status(400).json({ error: TEMP_VELOCITY_DISABLED_MESSAGE });
    }

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
    if (isClientCompatibilityError(error)) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Install from URL
router.post('/install-remote', async (req, res) => {
  try {
    const { url, filename, metadata } = req.body;
    if (!url || !filename) return res.status(400).json({ error: 'URL and filename required' });

    const serverType = String(metadata?.serverType || '').trim().toLowerCase();
    if (serverType === 'velocity') {
      // TEMP DISABLED: keep backend code-path for future re-enable.
      return res.status(400).json({ error: TEMP_VELOCITY_DISABLED_MESSAGE });
    }
    const providerKey = String(metadata?.provider || '').trim().toLowerCase();
    const providerName = String(metadata?.providerName || '').trim().toLowerCase();
    if (serverType === 'velocity') {
      const looksSpigotFamily = providerKey.includes('spigot')
        || providerName.includes('spigot')
        || providerKey === 'paper'
        || providerKey === 'purpur'
        || providerName === 'paper'
        || providerName === 'purpur';
      if (looksSpigotFamily) {
        return res.status(400).json({ error: 'Velocity servers only support Velocity-compatible plugins. Spigot/Paper/Purpur plugins are not compatible.' });
      }
    }

    await pluginService.installFromUrl(url, filename, metadata);
    res.json({ success: true });
  } catch (error) {
    if (isClientCompatibilityError(error)) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
