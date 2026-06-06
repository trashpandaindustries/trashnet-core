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
import { feedsRouter, pollSource, startPoller, feedEvents } from './feeds.js';
import { filesRouter } from './files.js';
import { preferencesRouter } from './preferences.js';
import { usersRouter } from './users.js';
import { settingsRouter } from './settings.js';
import { logsRouter } from './logs.js';
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

        // Run feed migration
        const feedSchema = `
        CREATE TABLE IF NOT EXISTS feed_sources (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name              VARCHAR(100) NOT NULL,
            endpoint_url      TEXT NOT NULL,
            feed_type         VARCHAR(10) NOT NULL CHECK (feed_type IN ('json', 'rss')),
            items_path        TEXT,
            poll_interval_s   INT NOT NULL DEFAULT 300,
            show_on_dashboard BOOLEAN NOT NULL DEFAULT false,
            failure_count     INT NOT NULL DEFAULT 0,
            last_fetched_at   TIMESTAMPTZ,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE feed_sources ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS feed_sources_user_isolation ON feed_sources;
        CREATE POLICY feed_sources_user_isolation ON feed_sources
            USING (user_id = current_setting('app.current_user_id')::UUID);

        CREATE TABLE IF NOT EXISTS feed_mappings (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source_id      UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
            display_field  VARCHAR(20) NOT NULL
                               CHECK (display_field IN
                                   ('title','date','url','author',
                                    'summary','image_url','badge','badge_color')),
            payload_path   TEXT NOT NULL,
            UNIQUE (source_id, display_field)
        );

        CREATE TABLE IF NOT EXISTS feed_items (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source_id   UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
            dedup_key   TEXT NOT NULL,
            normalised  JSONB NOT NULL,
            raw         JSONB NOT NULL,
            fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (source_id, dedup_key)
        );

        CREATE INDEX IF NOT EXISTS idx_feed_items_source ON feed_items(source_id, fetched_at DESC);
        CREATE INDEX IF NOT EXISTS idx_feed_sources_poll ON feed_sources(last_fetched_at)
            WHERE show_on_dashboard = true;
        `;
        await client.query(feedSchema).catch((e) => console.log('Feed schema migration issue', e));
        console.log("Feed schema migration verified.");
        // Run file browser migration
        const fileSchema = `
        CREATE TABLE IF NOT EXISTS file_audit_log (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
            action      VARCHAR(20) NOT NULL CHECK (action IN ('list', 'download', 'preview')),
            path        TEXT NOT NULL,
            ip_address  INET,
            user_agent  TEXT,
            accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_file_audit_time ON file_audit_log(accessed_at DESC);
        CREATE INDEX IF NOT EXISTS idx_file_audit_user ON file_audit_log(user_id);
        `;
        await client.query(fileSchema).catch((e) => console.log('File schema migration issue', e));
        console.log("File schema migration verified.");

        // Run user preferences migration
        const prefsSchema = `
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            preferences JSONB NOT NULL DEFAULT '{}',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        `;
        await client.query(prefsSchema).catch((e) => console.log('User preferences schema migration issue', e));
        console.log("User preferences schema migration verified.");

        // ALTER notes table to add filename
        await client.query(`ALTER TABLE notes ADD COLUMN IF NOT EXISTS filename VARCHAR(255);`).catch(() => {});

        // ALTER settings table
        await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS description TEXT;`).catch(() => {});
        // Update default descriptions if null
        await client.query(`
            UPDATE settings SET description = 'URL to the Portainer instance' WHERE key = 'portainer_url' AND description IS NULL;
            UPDATE settings SET description = 'API token for Portainer access' WHERE key = 'portainer_token' AND description IS NULL;
            UPDATE settings SET description = 'Label filter for monitoring Docker containers' WHERE key = 'docker_label_filter' AND description IS NULL;
            UPDATE settings SET description = 'Interval to refresh system stats (ms)' WHERE key = 'stats_refresh_interval_ms' AND description IS NULL;
            UPDATE settings SET description = 'Interval to refresh Docker status (ms)' WHERE key = 'docker_refresh_interval_ms' AND description IS NULL;
        `).catch(() => {});
    } finally {
        client.release();
    }
  } catch (e) {
    console.error("Could not run Kanban migration", e);
  }

  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;
  
  startPoller();

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
  app.use('/api/feeds', requireAuth, feedsRouter);
  app.use('/api/files', requireAuth, filesRouter);
  app.use('/api/preferences', requireAuth, preferencesRouter);
  app.use('/api/users', requireAuth, usersRouter);
  app.use('/api/settings', requireAuth, settingsRouter);
  app.use('/api/logs', requireAuth, logsRouter);

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

    const handleFeedUpdate = (data: any) => {
        if (isAlive) {
            ws.send(JSON.stringify({
                type: 'feed:update',
                sourceId: data.sourceId,
                newItems: data.newItems
            }));
        }
    };
    feedEvents.on('update', handleFeedUpdate);

    pushData();
    interval = setInterval(pushData, 10000);

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
        isAlive = false;
        clearInterval(interval);
        feedEvents.off('update', handleFeedUpdate);
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
