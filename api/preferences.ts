import { Router } from 'express';
import { withUser } from './db.js';

export const preferencesRouter = Router();

preferencesRouter.get('/', async (req, res) => {
    const userId = (req as any).user.sub;
    try {
        const result = await withUser(userId, async (client) => {
            const { rows } = await client.query('SELECT preferences FROM user_preferences WHERE user_id = $1', [userId]);
            if (rows.length === 0) {
                // Return default preferences
                return { theme: 'dark', dashboard_columns: 12 };
            }
            return rows[0].preferences;
        });
        res.json(result);
    } catch (e: any) {
        console.error('Failed to get preferences', e);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

preferencesRouter.put('/', async (req, res) => {
    const userId = (req as any).user.sub;
    const { preferences } = req.body;
    try {
        const result = await withUser(userId, async (client) => {
            const { rows } = await client.query(`
                INSERT INTO user_preferences (user_id, preferences, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id) DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = NOW()
                RETURNING preferences
            `, [userId, JSON.stringify(preferences)]);
            return rows[0].preferences;
        });
        res.json(result);
    } catch (e: any) {
        console.error('Failed to update preferences', e);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});
