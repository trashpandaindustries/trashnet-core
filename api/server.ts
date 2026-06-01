import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { authRouter } from './auth.js';
import { notesRouter } from './notes.js';
import { tagsRouter } from './tags.js';
import { searchRouter } from './search.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/search', searchRouter);

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
