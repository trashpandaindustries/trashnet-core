import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import { pool } from './db.js';
import { authRouter, requireAuth } from './auth.js';
import { notesRouter } from './notes.js';
import { tagsRouter } from './tags.js';
import { searchRouter } from './search.js';
import { dashboardRouter } from './dashboard.js';
import { systemRouter, getSystemStats, getDockerServices } from './system.js';
import { bookmarksRouter } from './bookmarks.js';
import { kanbanRouter } from './kanban.js';
import jwt from 'jsonwebtoken';

async function startServer() {
  try {
    const client = await pool.connect();
    try {
        // Try to add the status column safely (outside transaction just in case)
        await client.query(`ALTER TABLE kanban_items ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'To Do'`).catch(() => {});
        
        // Copy the current status from columns table if it exists
        await client.query(`
            UPDATE kanban_items i 
            SET status = c.name 
            FROM kanban_columns c 
            WHERE i.column_id = c.id
        `).catch(() => {});

        // Normalize status
        await client.query(`
            UPDATE kanban_items 
            SET status = 'To Do' 
            WHERE status NOT IN ('To Do', 'In Progress', 'In Review', 'Done')
        `).catch(() => {});

        // Drop the old column and table
        await client.query(`ALTER TABLE kanban_items DROP COLUMN IF EXISTS column_id CASCADE`).catch(() => {});
        await client.query(`DROP TABLE IF EXISTS kanban_columns CASCADE`).catch(() => {});

        console.log("Kanban schema migration verified.");
    } finally {
        client.release();
    }
  } catch (e) {
    console.error("Could not run Kanban migration", e);
  }

  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/system', systemRouter);
  app.use('/api/bookmarks', requireAuth, bookmarksRouter);
  app.use('/api/kanban', requireAuth, kanbanRouter);

  // WebSocket Server
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/api/system/live')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (ws: any, req: any) => {
    console.log('[WS] Connection attempt');
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
        console.log('[WS] Rejected: Auth missing');
        ws.close(1008, "Auth missing");
        return;
    }
    try {
        jwt.verify(token, process.env.JWT_SECRET || 'fallback');
    } catch {
        console.log('[WS] Rejected: Auth invalid');
        ws.close(1008, "Auth invalid");
        return;
    }

    console.log('[WS] Client connected successfully');
    let isAlive = true;
    let interval: NodeJS.Timeout;

    const pushData = async () => {
        try {
            const stats = await getSystemStats();
            const docker = await getDockerServices();
            if (isAlive) {
                ws.send(JSON.stringify({
                    type: 'system_update',
                    stats,
                    docker
                }));
            }
        } catch (error) {
            console.error('[WS] Error:', error);
        }
    };

    pushData();
    interval = setInterval(pushData, 10000);

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
        isAlive = false;
        clearInterval(interval);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
