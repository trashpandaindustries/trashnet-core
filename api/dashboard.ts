import { Router, Request, Response } from 'express';
import { requireAuth } from './auth.js';
import { withUser } from './db.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/modules', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  try {
    const modules = await withUser(userId, async (client) => {
      const { rows } = await client.query('SELECT * FROM dashboard_modules ORDER BY updated_at ASC');
      return rows;
    });
    res.json(modules);
  } catch (error) {
    console.error('Error fetching dashboard modules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

dashboardRouter.post('/modules', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { module_type, ref_id, pos_x, pos_y, width, height } = req.body;
  try {
    const newModule = await withUser(userId, async (client) => {
      const { rows } = await client.query(`
        INSERT INTO dashboard_modules (user_id, module_type, ref_id, pos_x, pos_y, width, height)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        userId, 
        module_type, 
        ref_id || null, 
        pos_x || 0, 
        pos_y || 0, 
        width || 2, 
        height || 2
      ]);
      return rows[0];
    });
    res.json(newModule);
  } catch (error) {
    console.error('Error creating dashboard module:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

dashboardRouter.put('/modules/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { id } = req.params;
  const { pos_x, pos_y, width, height } = req.body;
  try {
    const updated = await withUser(userId, async (client) => {
      const { rows } = await client.query(`
        UPDATE dashboard_modules
        SET pos_x = COALESCE($1, pos_x),
            pos_y = COALESCE($2, pos_y),
            width = COALESCE($3, width),
            height = COALESCE($4, height),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [pos_x, pos_y, width, height, id]);
      return rows[0];
    });
    if (!updated) return res.status(404).json({ error: 'Module not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

dashboardRouter.delete('/modules/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { id } = req.params;
  try {
    const deleted = await withUser(userId, async (client) => {
      const { rowCount } = await client.query('DELETE FROM dashboard_modules WHERE id = $1', [id]);
      return rowCount > 0;
    });
    if (!deleted) return res.status(404).json({ error: 'Module not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting module:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
