import express from 'express';
import { withUser } from './db.js';
import * as cheerio from 'cheerio';

export const bookmarksRouter = express.Router();

let queue: any = null;
async function getQueue() {
    if (!queue) {
        const { default: PQueue } = await import('p-queue');
        queue = new PQueue({ concurrency: 2 });
    }
    return queue;
}

async function scrapeMetadata(url: string) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const html = await res.text();
        const $ = cheerio.load(html);
        
        const title = $('title').text() || $('meta[property="og:title"]').attr('content') || null;
        const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || null;
        const ogImage = $('meta[property="og:image"]').attr('content') || null;
        
        let favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || null;
        if (favicon && !favicon.startsWith('http')) {
            const urlObj = new URL(url);
            favicon = new URL(favicon, urlObj.origin).toString();
        }

        return { title, description, ogImage, favicon };
    } catch (e) {
        console.error('Scrape failed for', url, e);
        return null;
    }
}

// GET /api/bookmarks
bookmarksRouter.get('/', async (req: any, res) => {
    try {
        const { q, tag } = req.query;
        let queryStr = `
            SELECT b.*, 
                   COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color)) FILTER (WHERE t.id IS NOT NULL), '[]') as tags
            FROM bookmarks b
            LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
            LEFT JOIN tags t ON bt.tag_id = t.id
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramCount = 1;

        if (tag) {
            queryStr += ` AND EXISTS (SELECT 1 FROM bookmark_tags bt2 JOIN tags t2 ON bt2.tag_id = t2.id WHERE bt2.bookmark_id = b.id AND t2.name = $${paramCount++})`;
            params.push(tag);
        }

        if (q) {
            queryStr += ` AND (b.title ILIKE $${paramCount} OR b.url ILIKE $${paramCount} OR b.description ILIKE $${paramCount})`;
            params.push(`%${q}%`);
            paramCount++;
        }

        queryStr += ` GROUP BY b.id ORDER BY b.created_at DESC`;

        const result = await withUser(req.user.sub, async (client) => {
            return client.query(queryStr, params);
        });
        
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/bookmarks/:id
bookmarksRouter.get('/:id', async (req: any, res) => {
    try {
        const result = await withUser(req.user.sub, async (client) => {
            return client.query(`
                SELECT b.*, 
                   COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color)) FILTER (WHERE t.id IS NOT NULL), '[]') as tags
                FROM bookmarks b
                LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
                LEFT JOIN tags t ON bt.tag_id = t.id
                WHERE b.id = $1
                GROUP BY b.id
            `, [req.params.id]);
        });
        
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/bookmarks
bookmarksRouter.post('/', async (req: any, res) => {
    try {
        const { url, show_on_dashboard } = req.body;
        if (!url) return res.status(400).json({ error: 'URL required' });

        const result = await withUser(req.user.sub, async (client) => {
            const r = await client.query(`
                INSERT INTO bookmarks (url, show_on_dashboard, scrape_status)
                VALUES ($1, $2, 'pending')
                RETURNING *
            `, [url, show_on_dashboard || false]);
            
            if (show_on_dashboard) {
                await client.query(`
                    INSERT INTO dashboard_modules (module_type, ref_id)
                    VALUES ('bookmark', $1)
                `, [r.rows[0].id]);
            }
            return r;
        });

        const bookmark = result.rows[0];
        const userId = req.user.sub;
        
        res.status(202).json(bookmark);

        // Async scraping
        const q = await getQueue();
        q.add(async () => {
            const meta = await scrapeMetadata(url);
            
            await withUser(userId, async (client) => {
                if (meta) {
                    await client.query(`
                        UPDATE bookmarks 
                        SET title = $1, description = $2, og_image_url = $3, favicon_url = $4, scrape_status = 'done'
                        WHERE id = $5
                    `, [meta.title || null, meta.description || null, meta.ogImage || null, meta.favicon || null, bookmark.id]);
                } else {
                    await client.query(`
                        UPDATE bookmarks SET scrape_status = 'failed' WHERE id = $1
                    `, [bookmark.id]);
                }
            });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/bookmarks/:id
bookmarksRouter.put('/:id', async (req: any, res) => {
    try {
        const { title, description, show_on_dashboard } = req.body;
        const id = req.params.id;
        
        const result = await withUser(req.user.sub, async (client) => {
            // Get old state to handle toggle show_on_dashboard
            const old = await client.query('SELECT show_on_dashboard FROM bookmarks WHERE id = $1', [id]);
            if (old.rows.length === 0) return null;
            
            const r = await client.query(`
                UPDATE bookmarks 
                SET title = COALESCE($1, title), 
                    description = COALESCE($2, description),
                    show_on_dashboard = COALESCE($3, show_on_dashboard)
                WHERE id = $4
                RETURNING *
            `, [title, description, show_on_dashboard, id]);

            if (show_on_dashboard !== undefined && old.rows[0].show_on_dashboard !== show_on_dashboard) {
                if (show_on_dashboard) {
                    await client.query(`INSERT INTO dashboard_modules (module_type, ref_id) VALUES ('bookmark', $1)`, [id]);
                } else {
                    await client.query(`DELETE FROM dashboard_modules WHERE module_type = 'bookmark' AND ref_id = $1`, [id]);
                }
            }
            return r;
        });

        if (!result) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/bookmarks/:id
bookmarksRouter.delete('/:id', async (req: any, res) => {
    try {
        const deleted = await withUser(req.user.sub, async (client) => {
            const r = await client.query(`DELETE FROM bookmarks WHERE id = $1 RETURNING id`, [req.params.id]);
            if (r.rows.length > 0) {
                // Remove module if it's there
                await client.query(`DELETE FROM dashboard_modules WHERE module_type = 'bookmark' AND ref_id = $1`, [req.params.id]);
            }
            return r.rowCount > 0;
        });
        
        if (!deleted) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/bookmarks/:id/tags/:tagId
bookmarksRouter.post('/:id/tags/:tagId', async (req: any, res) => {
    try {
        await withUser(req.user.sub, async (client) => {
            await client.query(`
                INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
            `, [req.params.id, req.params.tagId]);
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/bookmarks/:id/tags/:tagId
bookmarksRouter.delete('/:id/tags/:tagId', async (req: any, res) => {
    try {
        await withUser(req.user.sub, async (client) => {
            await client.query(`
                DELETE FROM bookmark_tags WHERE bookmark_id = $1 AND tag_id = $2
            `, [req.params.id, req.params.tagId]);
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
