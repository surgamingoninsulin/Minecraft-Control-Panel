import express from 'express';
import playerService from '../services/playerService.js';
import { validateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(validateToken);

router.get('/list', async (req, res) => {
    try {
        const players = await playerService.listPlayers();
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:uuid', async (req, res) => {
    try {
        const player = await playerService.getPlayer(req.params.uuid);
        res.json(player);
    } catch (error) {
        res.status(404).json({ error: 'Player not found' });
    }
});

router.put('/:uuid', isAdmin, async (req, res) => {
    try {
        const updated = await playerService.updatePlayer(req.params.uuid, req.body);
        res.json(updated);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/add', isAdmin, async (req, res) => {
    try {
        const { name } = req.body || {};
        const added = await playerService.addPlayerByName(name);
        res.json(added);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/:uuid/op', isAdmin, async (req, res) => {
    try {
        const { isOp, name } = req.body || {};
        await playerService.setOp(req.params.uuid, Boolean(isOp), name || null);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/:uuid/whitelist', isAdmin, async (req, res) => {
    try {
        const { isWhitelisted, name } = req.body || {};
        await playerService.setWhitelist(req.params.uuid, Boolean(isWhitelisted), name || null);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/remove', isAdmin, async (req, res) => {
    try {
        const { uuid } = req.body || {};
        const result = await playerService.removePlayer(uuid);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/:uuid', isAdmin, async (req, res) => {
    try {
        const result = await playerService.removePlayer(req.params.uuid);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
