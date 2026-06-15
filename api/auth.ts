import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_to_a_secure_random_string';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await query('SELECT id, password_hash, role FROM users WHERE username = $1 AND is_active = true', [username]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });

    // Ensure session uses httpOnly cookie
    res.cookie('token', token, { 
       httpOnly: true, 
       secure: process.env.NODE_ENV === 'production', 
       sameSite: 'lax',
       path: '/',
       maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    res.json({ token, user: { id: user.id, username, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
authRouter.post('/refresh', (req, res) => {
  // Skeleton implementation for Phase 1
  res.status(501).json({ error: 'Not implemented in Phase 1 skeleton' });
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.status(200).json({ success: true });
});

import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.token;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
       token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.sub;
    const result = await query('SELECT id, username, email, role FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
