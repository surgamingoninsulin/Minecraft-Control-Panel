import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import serverService from '../services/serverService.js';
import minecraftConfigService from '../services/minecraftConfigService.js';
import settingsService from '../services/settingsService.js';

const router = express.Router();

// Get server status
router.get('/status', async (req, res) => {
  try {
    const status = serverService.getStatus();

    try {
      const config = await minecraftConfigService.get();
      const panelSettings = await settingsService.get();
      status.config = {
        motd: config.motd,
        maxPlayers: config.maxPlayers,
        worldName: config.levelName || 'world',
        serverName: panelSettings.serverName || 'Minecraft Server',
        version: 'Minecraft'
      };

      if (status.stats.players) {
        status.stats.players.max = config.maxPlayers;
      }
    } catch (err) {
      console.error('Failed to load config for status:', err.message);
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
router.post('/start', async (req, res) => {
  try {
    console.log('[API] Received Start Server Request');
    const result = await serverService.start();
    res.json(result);
  } catch (error) {
    console.error('[API] Start Server Failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Stop server
router.post('/stop', (req, res) => {
  try {
    const result = serverService.stop();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Restart server
router.post('/restart', async (req, res) => {
  try {
    const result = await serverService.restart();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Send command
router.post('/command', (req, res) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    const result = serverService.sendCommand(command);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reset server setup only (keeps user setup/users intact)
router.post('/reset-setup', async (req, res) => {
  try {
    const settings = await settingsService.get();
    const serverPath = (settings.serverPath || '').trim();

    try {
      if (serverService.getStatus().status === 'online') {
        serverService.stop();
      }
    } catch {
      // Continue reset even if stop fails.
    }

    if (serverPath) {
      try {
        const entries = await fs.readdir(serverPath, { withFileTypes: true });
        await Promise.all(entries.map((entry) => {
          const fullPath = path.join(serverPath, entry.name);
          return fs.rm(fullPath, { recursive: true, force: true });
        }));
        await settingsService.ensureRestartScriptInRoot(serverPath);
      } catch (err) {
        if (err?.code !== 'ENOENT') {
          throw err;
        }
        // Path doesn't exist anymore; continue with setup reset anyway.
      }
    }

    const updatedSettings = await settingsService.update({
      serverPath: '',
      serverName: 'Minecraft Server',
      serverType: 'vanilla',
      serverVersion: '',
      jarFile: 'server.jar',
      assetsFile: '',
      pluginInstallDir: 'plugins'
    }, { allowProtectedUpdates: true });

    res.json({
      success: true,
      message: 'Server reset completed. Server setup is required again.',
      settings: updatedSettings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
