import { Router, Request, Response } from 'express';
import { requireAuth } from './auth.js';
import { withUser } from './db.js';

export const notesRouter = Router();

notesRouter.use(requireAuth);

// GET /api/notes/scratchpad
notesRouter.get('/scratchpad', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  try {
    const result = await withUser(userId, async (client) => {
      // Find the scratchpad for this user
      let { rows } = await client.query(`
        SELECT id, title, content, updated_at 
        FROM notes 
        WHERE is_scratchpad = true AND user_id = $1
        LIMIT 1
      `, [userId]);
      if (rows.length === 0) {
        // Technically shouldn't happen if seeded, but create if missing
        const insertRes = await client.query(`
          INSERT INTO notes (user_id, title, is_scratchpad) 
          VALUES ($1, 'Scratchpad', true) 
          RETURNING id, title, content, updated_at
        `, [userId]);
        rows = insertRes.rows;
      }
      return rows[0];
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching scratchpad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notes/scratchpad
notesRouter.put('/scratchpad', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { content } = req.body;
  try {
    const result = await withUser(userId, async (client) => {
      const { rows } = await client.query(`
        UPDATE notes 
        SET content = $1, updated_at = NOW() 
        WHERE is_scratchpad = true AND user_id = $2
        RETURNING id, title, content, updated_at
      `, [content, userId]);
      return rows[0];
    });
    res.json(result);
  } catch (error) {
    console.error('Error auto-saving scratchpad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notes/scratchpad/archive
notesRouter.post('/scratchpad/archive', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  
  try {
    const result = await withUser(userId, async (client) => {
      // Get current scratchpad content
      const { rows: scRows } = await client.query(`
        SELECT content FROM notes WHERE is_scratchpad = true AND user_id = $1
      `, [userId]);
      const content = scRows[0]?.content || '';

      // Title extraction (first line)
      let title = 'Untitled';
      const firstLineMatch = content.trim().split('\\n')[0];
      if (firstLineMatch) {
         title = firstLineMatch.replace(/^#+\\s*/, '').substring(0, 50).trim() || 'Untitled';
      }

      // Insert new archived note
      const { rows: newNotes } = await client.query(`
        INSERT INTO notes (user_id, title, content, is_archived)
        VALUES ($1, $2, $3, true)
        RETURNING *
      `, [userId, title, content]);

      // Clear scratchpad
      await client.query(`
        UPDATE notes 
        SET content = NULL, updated_at = NOW() 
        WHERE is_scratchpad = true AND user_id = $1
      `, [userId]);

      return newNotes[0];
    });
    res.json(result);
  } catch (error) {
    console.error('Error archiving scratchpad:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notes
notesRouter.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  try {
    const notes = await withUser(userId, async (client) => {
      const { rows } = await client.query(`
        SELECT n.id, n.title, n.content, n.updated_at,
          COALESCE(
            json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
            FILTER (WHERE t.id IS NOT NULL), '[]'
          ) as tags
        FROM notes n
        LEFT JOIN note_tags nt ON n.id = nt.note_id
        LEFT JOIN tags t ON t.id = nt.tag_id
        WHERE n.is_scratchpad = false AND n.is_archived = true AND n.user_id = $1
        GROUP BY n.id
        ORDER BY n.updated_at DESC
      `, [userId]);
      return rows;
    });
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notes/:id
notesRouter.get('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { id } = req.params;
  try {
    const note = await withUser(userId, async (client) => {
      const { rows } = await client.query(`
        SELECT n.*,
          COALESCE(
            json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
            FILTER (WHERE t.id IS NOT NULL), '[]'
          ) as tags
        FROM notes n
        LEFT JOIN note_tags nt ON n.id = nt.note_id
        LEFT JOIN tags t ON t.id = nt.tag_id
        WHERE n.id = $1 AND n.user_id = $2
        GROUP BY n.id
      `, [id, userId]);
      return rows[0];
    });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notes/:id
notesRouter.put('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { id } = req.params;
  const { title, content } = req.body;
  try {
    const updated = await withUser(userId, async (client) => {
      const { rows } = await client.query(`
        UPDATE notes
        SET title = COALESCE($1, title), content = COALESCE($2, content), updated_at = NOW()
        WHERE id = $3 AND user_id = $4
        RETURNING *
      `, [title, content, id, userId]);
      return rows[0];
    });
    if (!updated) return res.status(404).json({ error: 'Note not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/notes/:id
notesRouter.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { id } = req.params;
  try {
    const deleted = await withUser(userId, async (client) => {
      const { rowCount } = await client.query('DELETE FROM notes WHERE id = $1 AND user_id = $2 AND is_scratchpad = false', [id, userId]);
      return rowCount > 0;
    });
    if (!deleted) return res.status(404).json({ error: 'Note not found or cannot delete scratchpad' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notes/:id/tags/:tagId
notesRouter.post('/:id/tags/:tagId', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { id, tagId } = req.params;
  try {
    await withUser(userId, async (client) => {
      await client.query(`
        INSERT INTO note_tags (note_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [id, tagId]);
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding tag to note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notes/:id/convert-to-kanban
notesRouter.post('/:id/convert-to-kanban', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { id } = req.params;
  const { status } = req.body;
  try {
    const item = await withUser(userId, async (client) => {
      // Get the note
      const noteRes = await client.query('SELECT title, content FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
      if (noteRes.rows.length === 0) return null;
      const note = noteRes.rows[0];

      // Use provided status or default to 'To Do'
      const targetStatus = status || 'To Do';

      // Create kanban item
      const itemRes = await client.query(`
        INSERT INTO kanban_items (user_id, status, title, description, priority)
        VALUES ($1, $2, $3, $4, 'medium')
        RETURNING *
      `, [userId, targetStatus, note.title, note.content]);
      
      const newItem = itemRes.rows[0];
      
      // Copy tags from note to kanban item
      await client.query(`
        INSERT INTO kanban_item_tags (item_id, tag_id)
        SELECT $1, tag_id FROM note_tags WHERE note_id = $2
      `, [newItem.id, id]);
        
      return newItem;
    });

    if (!item) return res.status(404).json({ error: 'Note not found' });
    res.status(201).json(item);
  } catch (error) {
    console.error('Error converting note to kanban:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/notes/:id/tags/:tagId
notesRouter.delete('/:id/tags/:tagId', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { id, tagId } = req.params;
  try {
    await withUser(userId, async (client) => {
      await client.query('DELETE FROM note_tags WHERE note_id = $1 AND tag_id = $2', [id, tagId]);
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing tag from note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
