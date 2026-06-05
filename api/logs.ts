import { Router } from 'express';
import { pool } from './db.js';

export const logsRouter = Router();

const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }
    next();
};
logsRouter.use(requireAdmin);

logsRouter.get('/file-access', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT fal.id, fal.user_id, u.username, fal.action, fal.path, fal.ip_address, fal.user_agent, fal.accessed_at
            FROM file_audit_log fal
            LEFT JOIN users u ON fal.user_id = u.id
            ORDER BY fal.accessed_at DESC
            LIMIT 500
        `);
        res.json(rows);
    } catch (e: any) {
        console.error('Failed to get file audit logs', e);
        res.status(500).json({ error: 'Failed to get file audit logs' });
    }
});
