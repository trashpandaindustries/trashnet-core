import { Router, Request, Response } from 'express';
import { withUser, pool } from './db.js';
import crypto from 'crypto';
import Parser from 'rss-parser';
import { EventEmitter } from 'events';

export const feedsRouter = Router();
export const feedEvents = new EventEmitter();
const rssParser = new Parser();

// Helper: Resolve dot-path (e.g. "author.name")
export function resolvePath(obj: any, path: string) {
  if (!path) return null;
  return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? null;
}

// Helper: Apply mapping
export function applyMapping(payloadItem: any, mappings: any[]) {
  const result: any = {};
  for (const { display_field, payload_path } of mappings) {
    const value = resolvePath(payloadItem, payload_path);
    if (value !== null && value !== undefined) {
      result[display_field] = String(value);
    }
  }
  return result;
}

// Fetch helper (can be used for preview and poll)
async function fetchFeed(url: string, type: string) {
  if (type === 'rss') {
    const feed = await rssParser.parseURL(url);
    return feed.items;
  } else {
    // JSON
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }
}

function extractItems(payload: any, itemsPath?: string | null) {
  if (!itemsPath) return Array.isArray(payload) ? payload : [payload];
  const arr = resolvePath(payload, itemsPath);
  return Array.isArray(arr) ? arr : [arr].filter(Boolean);
}

// Routes
feedsRouter.get('/sources', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  try {
    const results = await withUser(userId, async (client) => {
      const { rows } = await client.query('SELECT * FROM feed_sources ORDER BY created_at DESC');
      return rows;
    });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list sources' });
  }
});

feedsRouter.post('/sources', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { name, endpoint_url, feed_type, items_path, poll_interval_s, show_on_dashboard } = req.body;
  try {
    const result = await withUser(userId, async (client) => {
      const { rows } = await client.query(`
        INSERT INTO feed_sources (name, endpoint_url, feed_type, items_path, poll_interval_s, show_on_dashboard)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [name, endpoint_url, feed_type, items_path || null, poll_interval_s || 300, show_on_dashboard || false]);
      return rows[0];
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create source' });
  }
});

feedsRouter.get('/sources/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const sourceId = req.params.id;
  try {
    const result = await withUser(userId, async (client) => {
      const { rows } = await client.query('SELECT * FROM feed_sources WHERE id = $1', [sourceId]);
      if (rows.length === 0) return null;
      
      const mappingsRes = await client.query('SELECT display_field, payload_path FROM feed_mappings WHERE source_id = $1', [sourceId]);
      return { ...rows[0], mappings: mappingsRes.rows };
    });
    if (!result) return res.status(404).json({ error: 'Source not found' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch source' });
  }
});

feedsRouter.put('/sources/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const sourceId = req.params.id;
  const { name, endpoint_url, feed_type, items_path, poll_interval_s, show_on_dashboard } = req.body;
  try {
    const result = await withUser(userId, async (client) => {
      const { rows } = await client.query(`
        UPDATE feed_sources 
        SET name = $1, endpoint_url = $2, feed_type = $3, items_path = $4, poll_interval_s = $5, show_on_dashboard = $6
        WHERE id = $7 RETURNING *
      `, [name, endpoint_url, feed_type, items_path || null, poll_interval_s, show_on_dashboard, sourceId]);
      
      if (rows.length > 0) {
        // Toggle dashboard module if needed
        if (show_on_dashboard) {
          await client.query(`
            INSERT INTO dashboard_modules (module_type, ref_id, pos_x, pos_y, width, height)
            SELECT 'feed_source', $1, 0, 0, 3, 2
            WHERE NOT EXISTS (SELECT 1 FROM dashboard_modules WHERE module_type = 'feed_source' AND ref_id = $1)
          `, [sourceId]);
        } else {
          await client.query(`DELETE FROM dashboard_modules WHERE module_type = 'feed_source' AND ref_id = $1`, [sourceId]);
        }
      }
      return rows[0];
    });
    if (!result) return res.status(404).json({ error: 'Source not found' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update source' });
  }
});

feedsRouter.delete('/sources/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  try {
    await withUser(userId, async (client) => {
      await client.query('DELETE FROM feed_sources WHERE id = $1', [req.params.id]);
      await client.query('DELETE FROM dashboard_modules WHERE module_type = $1 AND ref_id = $2', ['feed_source', req.params.id]);
    });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete source' });
  }
});

feedsRouter.post('/sources/preview', async (req: Request, res: Response) => {
  const { endpoint_url, feed_type } = req.body;
  try {
    const payload = await fetchFeed(endpoint_url, feed_type);
    res.json(payload);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

feedsRouter.get('/sources/:id/mappings', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const sourceId = req.params.id;
  try {
    const results = await withUser(userId, async (client) => {
      // Must verify source exists and belongs to user
      const source = await client.query('SELECT id FROM feed_sources WHERE id = $1', [sourceId]);
      if (source.rows.length === 0) return null;
      
      const { rows } = await client.query('SELECT * FROM feed_mappings WHERE source_id = $1', [sourceId]);
      return rows;
    });
    if (!results) return res.status(404).json({ error: 'Source not found' });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

feedsRouter.put('/sources/:id/mappings', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const sourceId = req.params.id;
  const mappings: { display_field: string, payload_path: string }[] = req.body;
  try {
    await withUser(userId, async (client) => {
      const source = await client.query('SELECT id FROM feed_sources WHERE id = $1', [sourceId]);
      if (source.rows.length === 0) throw new Error('Not found');

      await client.query('DELETE FROM feed_mappings WHERE source_id = $1', [sourceId]);
      for (const m of mappings) {
        await client.query('INSERT INTO feed_mappings (source_id, display_field, payload_path) VALUES ($1, $2, $3)', [sourceId, m.display_field, m.payload_path]);
      }
    });
    res.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Not found') return res.status(404).json({ error: 'Source not found' });
    res.status(500).json({ error: 'Failed to update mappings' });
  }
});

feedsRouter.get('/sources/:id/items', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const sourceId = req.params.id;
  try {
    const results = await withUser(userId, async (client) => {
      // Verify source exists under this user
      const source = await client.query('SELECT id FROM feed_sources WHERE id = $1', [sourceId]);
      if (source.rows.length === 0) return null;
      const { rows } = await client.query('SELECT * FROM feed_items WHERE source_id = $1 ORDER BY fetched_at DESC LIMIT 20', [sourceId]);
      return rows;
    });
    if (!results) return res.status(404).json({ error: 'Source not found' });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// To be called internally or manually to poll
export async function pollSource(sourceId: string, globalClient?: any) {
  const client = globalClient || await pool.connect();
  const shouldRelease = !globalClient;
  
  try {
    const { rows: sourceRows } = await client.query('SELECT * FROM feed_sources WHERE id = $1', [sourceId]);
    if (sourceRows.length === 0) return;
    const source = sourceRows[0];
    
    // We don't apply user_id check here since it's an internal background job
    const { rows: mappingRows } = await client.query('SELECT display_field, payload_path FROM feed_mappings WHERE source_id = $1', [sourceId]);
    
    try {
      const payload = await fetchFeed(source.endpoint_url, source.feed_type);
      const items = extractItems(payload, source.items_path);
      
      let hasNewItems = false;
      const newItems = [];
      for (const item of items.slice(0, 50)) { // limit to last 50 items
        const rawJsonStr = JSON.stringify(item);
        
        const mapped = applyMapping(item, mappingRows);
        
        let urlValue = mapped.url;
        let idValue = resolvePath(item, 'guid') || resolvePath(item, 'id');
        let hashValue = crypto.createHash('sha1').update(rawJsonStr).digest('hex');
        
        const dedupKey = String(urlValue || idValue || hashValue);
        
        const { rowCount } = await client.query(`
          INSERT INTO feed_items (source_id, dedup_key, normalised, raw, fetched_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (source_id, dedup_key) 
          DO UPDATE SET normalised = $3, raw = $4, fetched_at = NOW()
          WHERE feed_items.raw != $4
        `, [source.id, dedupKey, JSON.stringify(mapped), rawJsonStr]);
        
        if (rowCount && rowCount > 0) {
            hasNewItems = true;
            newItems.push(mapped);
        }
      }
      
      await client.query(`UPDATE feed_sources SET last_fetched_at = NOW(), failure_count = 0 WHERE id = $1`, [source.id]);
      if (hasNewItems) {
         feedEvents.emit('update', { sourceId: source.id, newItems });
      }
    } catch (e: any) {
      console.error(`Failed to poll ${source.name}:`, e);
      await client.query(`UPDATE feed_sources SET failure_count = failure_count + 1 WHERE id = $1`, [source.id]);
    }
  } finally {
    if (shouldRelease) client.release();
  }
}

feedsRouter.post('/sources/:id/poll', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const sourceId = req.params.id;
  try {
    let valid = false;
    await withUser(userId, async (client) => {
       const source = await client.query('SELECT id FROM feed_sources WHERE id = $1', [sourceId]);
       valid = source.rows.length > 0;
    });
    if (!valid) return res.status(404).json({ error: 'Source not found' });
    
    await pollSource(sourceId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger poll' });
  }
});

let _pollerRunning = false;
export async function startPoller() {
  if (_pollerRunning) return;
  _pollerRunning = true;
  
  console.log('Starting Feed Poller');
  
  const tick = async () => {
     try {
       const client = await pool.connect();
       try {
         // get sources that need polling
         // exponential backoff: failure_count=0 -> wait poll_interval_s
         // failure_count>0 -> wait poll_interval_s * (2^failure_count), cap at 3600 (1 hour)
         
         const { rows: sources } = await client.query(`
           SELECT id, poll_interval_s, failure_count, last_fetched_at
           FROM feed_sources
           WHERE show_on_dashboard = true
         `);
         
         const now = new Date().getTime();
         for (const s of sources) {
           const backoff = Math.min(s.poll_interval_s * Math.pow(2, s.failure_count), 3600);
           const nextPoll = s.last_fetched_at ? new Date(s.last_fetched_at).getTime() + (backoff * 1000) : 0;
           if (now >= nextPoll) {
             await pollSource(s.id, client);
           }
         }
       } finally {
         client.release();
       }
     } catch (e) {
       console.error("Poller tick failed", e);
     }
     
     if (_pollerRunning) setTimeout(tick, 30000); // 30s check loop
  };
  
  tick();
}
