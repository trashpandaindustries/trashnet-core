import { Router, Request, Response } from 'express';
import { requireAuth } from './auth.js';
import { withUser } from './db.js';

export const searchRouter = Router();

searchRouter.use(requireAuth);

searchRouter.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const q = req.query.q as string || '';
  // basic tagging filter implementation for notes
  // tag:urgent -> we can parse q or use tags query param
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
      
      let noteQuery = `
        SELECT DISTINCT n.id, n.title, n.content, n.updated_at, 'note' as type
        FROM notes n
        LEFT JOIN note_tags nt ON n.id = nt.note_id
        LEFT JOIN tags t ON t.id = nt.tag_id
        WHERE n.is_scratchpad = false AND n.is_archived = true
      `;
      const noteParams: any[] = [];
      let paramCount = 1;

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
      
      noteQuery += ` ORDER BY n.updated_at DESC LIMIT 20`;

      const { rows } = await client.query(noteQuery, noteParams);
      return rows;
    });

    res.json(results);
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
