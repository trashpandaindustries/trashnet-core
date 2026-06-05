import { Router } from 'express';
import { pool, withUser } from './db.js';
import bcrypt from 'bcrypt';

export const usersRouter = Router();

const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }
    next();
};

usersRouter.use(requireAdmin);

usersRouter.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, username, email, role, is_active, created_at, last_login_at FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (e: any) {
        console.error('Failed to get users', e);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

usersRouter.post('/', async (req, res) => {
    const { username, email, password, role } = req.body;
    try {
        const password_hash = await bcrypt.hash(password, 12);
        const { rows } = await pool.query(`
            INSERT INTO users (username, email, password_hash, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, email, role, is_active, created_at
        `, [username, email, password_hash, role || 'user']);
        
        const newUser = rows[0];

        // Seed scratchpad
        await withUser(newUser.id, async (client) => {
            await client.query(`
                INSERT INTO notes (user_id, title, is_scratchpad) 
                VALUES ($1, 'Scratchpad', true)
            `, [newUser.id]);
        });
        
        res.status(201).json(newUser);
    } catch (e: any) {
        console.error('Failed to create user', e);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

usersRouter.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, username, email, role, is_active, created_at, last_login_at FROM users WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
    } catch (e: any) {
        console.error('Failed to get user', e);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

usersRouter.put('/:id', async (req, res) => {
    const { username, email, role, is_active } = req.body;
    try {
        const { rows } = await pool.query(`
            UPDATE users SET username = $1, email = $2, role = $3, is_active = $4
            WHERE id = $5
            RETURNING id, username, email, role, is_active, created_at, last_login_at
        `, [username, email, role, is_active, req.params.id]);
        
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
    } catch (e: any) {
        console.error('Failed to update user', e);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

usersRouter.delete('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true });
    } catch (e: any) {
        console.error('Failed to delete user', e);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

usersRouter.post('/:id/reset-password', async (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }
    
    try {
        const password_hash = await bcrypt.hash(password, 12);
        const { rows } = await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id', [password_hash, req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        // Optionally invalidate active sessions here
        await pool.query('DELETE FROM sessions WHERE user_id = $1', [req.params.id]);
        
        res.json({ success: true, message: 'Password reset and sessions cleared' });
    } catch (e: any) {
        console.error('Failed to reset password', e);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});
