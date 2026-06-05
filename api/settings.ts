import { Router } from 'express';
import { pool } from './db.js';

export const settingsRouter = Router();

// Require admin for all settings endpoints
const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }
    next();
};
settingsRouter.use(requireAdmin);

settingsRouter.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT key, value, description, updated_at FROM settings ORDER BY key ASC');
        res.json(rows);
    } catch (e: any) {
        console.error('Failed to get settings', e);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

settingsRouter.put('/:key', async (req, res) => {
    const { value, description } = req.body;
    try {
        // We only allow updating value and description
        const { rows } = await pool.query(`
            UPDATE settings 
            SET value = $1, description = COALESCE($2, description), updated_at = NOW() 
            WHERE key = $3 
            RETURNING key, value, description, updated_at
        `, [JSON.stringify(value), description, req.params.key]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }
        res.json(rows[0]);
    } catch (e: any) {
        console.error('Failed to update setting', e);
        res.status(500).json({ error: 'Failed to update setting' });
    }
});
