import express from 'express';
import userService from '../services/userService.js';
import { validateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All user routes require authentication
router.use(validateToken);

router.get('/', isAdmin, async (req, res) => {
    try {
        const users = await userService.getAll();
        if (!Array.isArray(users)) {
            console.error('[UserRoutes] userService.getAll() did not return an array:', users);
            return res.json([]);
        }
        const primaryAdmin = userService.getPrimaryAdmin(users);
        const primaryAdminId = primaryAdmin?.id || null;
        const safeUsers = users
            .map((entry) => userService.sanitize(entry, primaryAdminId))
            .filter(Boolean);
        res.json(safeUsers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', isAdmin, async (req, res) => {
    try {
        const user = await userService.create(req.body);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/:id', isAdmin, async (req, res) => {
    try {
        const user = await userService.update(req.params.id, req.body);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', isAdmin, async (req, res) => {
    try {
        await userService.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/:id/toggle-active', isAdmin, async (req, res) => {
    try {
        const users = await userService.getAll();
        const user = users.find(u => u.id === req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const updated = await userService.update(user.id, { active: !user.active });
        res.json(updated);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/:id/generate-reset-secret', isAdmin, async (req, res) => {
    try {
        const result = await userService.generateResetSecret(req.params.id, req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(403).json({ error: error.message });
    }
});

export default router;
