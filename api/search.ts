import { Router, Request, Response } from 'express';
import { requireAuth } from './auth.js';
import { pool, withUser } from './db.js';

export const searchRouter = Router();

searchRouter.use(requireAuth);

searchRouter.get('/web', async (req: Request, res: Response) => {
  const q = req.query.q as string || '';
  if (!q) {
      return res.status(400).json({ error: 'Missing query' });
  }

  try {
      const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', ['searxng_url']);
      let searxngUrl = 'http://searxng:8080';
      if (rows.length > 0) {
          // The pg driver parses JSONB automatically. For a JSON string, it returns a JS string.
          searxngUrl = typeof rows[0].value === 'string' ? rows[0].value : String(rows[0].value);
      }
      
      const searchUrl = `${searxngUrl}/search?q=${encodeURIComponent(q)}&format=json`;
      console.log('Fetching SearXNG:', searchUrl);
      
      const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
              'Accept': 'application/json'
          }
      });
      
      if (!response.ok) {
          throw new Error(`SearXNG returned ${response.status}`);
      }
      
      const data = await response.json();
      res.json(data);
  } catch (error: any) {
      console.error('Error fetching web search:', error);
      res.status(500).json({ error: error.message || 'Web search failed' });
  }
});

searchRouter.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const q = req.query.q as string || '';
  const rawTags = (req.query.tags as string) || '';
  const tagList = rawTags ? rawTags.split(',').map(t => t.trim()).filter(Boolean) : [];
  
  // parse 'tag:xxx' from query to extract more tags
  const tokens = q.split(' ');
  const textTokens = [];
  for (const token of tokens) {
    if (token.startsWith('tag:')) {
      tagList.push(token.substring(4));
    } else {
      textTokens.push(token);
    }
  }
  
  const searchText = textTokens.join(' ').trim();

  try {
    const results = await withUser(userId, async (client) => {
      // Notes
      let noteQuery = `
        SELECT DISTINCT n.id, n.title, n.content, n.updated_at, 'note' as type
        FROM notes n
      `;
      if (tagList.length > 0) {
        noteQuery += ` JOIN note_tags nt ON n.id = nt.note_id JOIN tags t ON t.id = nt.tag_id `;
      }
      noteQuery += ` WHERE n.user_id = $1 AND n.is_scratchpad = false AND n.is_archived = true `;
      
      let noteParams: any[] = [userId];
      let paramCount = 2;

      if (searchText) {
        noteQuery += ` AND to_tsvector('english', n.title || ' ' || COALESCE(n.content, '')) @@ plainto_tsquery('english', $${paramCount})`;
        noteParams.push(searchText);
        paramCount++;
      }

      if (tagList.length > 0) {
        noteQuery += ` AND t.name = ANY($${paramCount})`;
        noteParams.push(tagList);
        paramCount++;
      }
      noteQuery += ` ORDER BY n.updated_at DESC LIMIT 10`;

      // Bookmarks
      let bmQuery = `
        SELECT DISTINCT b.id, b.title, b.url, b.description, b.created_at as updated_at, 'bookmark' as type
        FROM bookmarks b
      `;
      if (tagList.length > 0) {
        bmQuery += ` JOIN bookmark_tags bt ON b.id = bt.bookmark_id JOIN tags t ON t.id = bt.tag_id `;
      }
      bmQuery += ` WHERE b.user_id = $1 `;
      let bmParams: any[] = [userId];
      paramCount = 2;

      if (searchText) {
        bmQuery += ` AND to_tsvector('english', COALESCE(b.title, '') || ' ' || b.url || ' ' || COALESCE(b.description, '')) @@ plainto_tsquery('english', $${paramCount})`;
        bmParams.push(searchText);
        paramCount++;
      }

      if (tagList.length > 0) {
        bmQuery += ` AND t.name = ANY($${paramCount})`;
        bmParams.push(tagList);
        paramCount++;
      }
      bmQuery += ` ORDER BY b.created_at DESC LIMIT 10`;

      // Kanban
      let kbQuery = `
        SELECT DISTINCT k.id, k.title, k.description, k.updated_at, 'kanban' as type
        FROM kanban_items k
      `;
      if (tagList.length > 0) {
        kbQuery += ` JOIN kanban_item_tags kt ON k.id = kt.item_id JOIN tags t ON t.id = kt.tag_id `;
      }
      kbQuery += ` WHERE k.user_id = $1 `;
      let kbParams: any[] = [userId];
      paramCount = 2;

      if (searchText) {
        kbQuery += ` AND to_tsvector('english', k.title || ' ' || COALESCE(k.description, '')) @@ plainto_tsquery('english', $${paramCount})`;
        kbParams.push(searchText);
        paramCount++;
      }

      if (tagList.length > 0) {
        kbQuery += ` AND t.name = ANY($${paramCount})`;
        kbParams.push(tagList);
        paramCount++;
      }
      kbQuery += ` ORDER BY k.updated_at DESC LIMIT 10`;

      const [notesRes, bmRes, kbRes] = await Promise.all([
        client.query(noteQuery, noteParams),
        client.query(bmQuery, bmParams),
        client.query(kbQuery, kbParams),
      ]);

      return {
        notes: notesRes.rows,
        bookmarks: bmRes.rows,
        kanban: kbRes.rows
      };
    });

    res.json(results);
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
