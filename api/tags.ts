import { Router, Request, Response } from 'express';
import { requireAuth } from './auth.js';
import { withUser } from './db.js';

export const tagsRouter = Router();

tagsRouter.use(requireAuth);

// GET /api/tags
tagsRouter.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  try {
    const tags = await withUser(userId, async (client) => {
      const { rows } = await client.query('SELECT * FROM tags WHERE user_id = $1 ORDER BY name ASC', [userId]);
      return rows;
    });
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tags
tagsRouter.post('/', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  
  try {
    const newTag = await withUser(userId, async (client) => {
      const { rows } = await client.query(`
        INSERT INTO tags (user_id, name, color)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [userId, name, color || '#718096']);
      return rows[0];
    });
    res.json(newTag);
  } catch (error) {
    console.error('Error creating tag:', error);
    // 23505 is unique violation
    if ((error as any).code === '23505') {
      return res.status(409).json({ error: 'Tag already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tags/:id
tagsRouter.put('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { id } = req.params;
  const { name, color } = req.body;
  
  try {
    const updated = await withUser(userId, async (client) => {
      const { rows } = await client.query(`
        UPDATE tags
        SET name = COALESCE($1, name), color = COALESCE($2, color)
        WHERE id = $3 AND user_id = $4
        RETURNING *
      `, [name, color, id, userId]);
      return rows[0];
    });
    if (!updated) return res.status(404).json({ error: 'Tag not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating tag:', error);
    if ((error as any).code === '23505') {
      return res.status(409).json({ error: 'Tag name already used' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tags/:id
tagsRouter.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { id } = req.params;
  
  try {
    const deleted = await withUser(userId, async (client) => {
      const { rowCount } = await client.query('DELETE FROM tags WHERE id = $1 AND user_id = $2', [id, userId]);
      return rowCount > 0;
    });
    if (!deleted) return res.status(404).json({ error: 'Tag not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
