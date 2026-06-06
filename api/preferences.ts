import { Router } from 'express';
import { withUser } from './db.js';
import { encrypt, decrypt } from './github.js';

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
            const prefs = rows[0].preferences || {};
            // Mask the token
            if (prefs.github_token) {
                prefs.github_token = '********';
            }
            return prefs;
        });
        res.json(result);
    } catch (e: any) {
        console.error('Failed to get preferences', e);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

preferencesRouter.put('/', async (req, res) => {
    const userId = (req as any).user.sub;
    let { preferences } = req.body;
    try {
        const result = await withUser(userId, async (client) => {
            // Retrieve old prefs to get the actual token if masked
            const { rows: oldRows } = await client.query('SELECT preferences FROM user_preferences WHERE user_id = $1', [userId]);
            const oldPrefs = oldRows.length > 0 ? oldRows[0].preferences : {};

            if (preferences.github_token === '********') {
                preferences.github_token = oldPrefs.github_token;
            } else if (preferences.github_token) {
                // New token provided, encrypt it
                preferences.github_token = encrypt(preferences.github_token);
            }

            const { rows } = await client.query(`
                INSERT INTO user_preferences (user_id, preferences, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id) DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = NOW()
                RETURNING preferences
            `, [userId, JSON.stringify(preferences)]);
            
            const prefs = rows[0].preferences;
            if (prefs.github_token) prefs.github_token = '********';
            return prefs;
        });
        res.json(result);
    } catch (e: any) {
        console.error('Failed to update preferences', e);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});
