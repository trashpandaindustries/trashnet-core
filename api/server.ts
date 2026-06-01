import express from 'express';
import expressWs from 'express-ws';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { authRouter, requireAuth } from './auth.js';
import { notesRouter } from './notes.js';
import { tagsRouter } from './tags.js';
import { searchRouter } from './search.js';
import { dashboardRouter } from './dashboard.js';
import { systemRouter, getSystemStats, getDockerServices } from './system.js';
import jwt from 'jsonwebtoken';

async function startServer() {
  const appBase = express();
  // expressWs mutates the app
  const { app } = expressWs(appBase);
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/system', systemRouter);

  // WebSocket endpoint
  app.ws('/api/system/live', (ws, req) => {
    // Quick auth check using query param or cookie could be done. 
    // Usually standard auth header isn't sent in WebSocket API browser. 
    // We can rely on token passing via query, e.g. ?token=...
    const token = req.query.token as string;
    if (!token) {
        ws.close(1008, "Auth missing");
        return;
    }
    try {
        jwt.verify(token, process.env.JWT_SECRET || 'fallback');
    } catch {
        ws.close(1008, "Auth invalid");
        return;
    }

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
            console.error('WS Error:', error);
        }
    };

    // Initial push
    pushData();

    // Push every 10 seconds
    interval = setInterval(pushData, 10000);

    ws.on('close', () => {
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
    const webPath = path.join(distPath, 'web'); // might rely on how build puts out index.html
    // To match typical setup: express.static(distPath)
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
