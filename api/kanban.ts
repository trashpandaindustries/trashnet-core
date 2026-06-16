import express from 'express';
import { withUser } from './db.js';

export const kanbanRouter = express.Router();

// GET /api/kanban/board
kanbanRouter.get('/board', async (req: any, res) => {
    try {
        const userId = req.user.sub;
        
        await withUser(userId, async (client) => {
            const columns = [
                { id: 'To Do', name: 'To Do' },
                { id: 'In Progress', name: 'In Progress' },
                { id: 'In Review', name: 'In Review' },
                { id: 'Done', name: 'Done' }
            ];
            
            const itemsResult = await client.query(`
                SELECT i.*, 
                   COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color)) FILTER (WHERE t.id IS NOT NULL), '[]') as tags
                FROM kanban_items i
                LEFT JOIN kanban_item_tags it ON i.id = it.item_id
                LEFT JOIN tags t ON it.tag_id = t.id
                WHERE i.user_id = $1
                GROUP BY i.id
                ORDER BY i.created_at DESC
            `, [userId]);
            
            res.json({
                columns,
                items: itemsResult.rows
            });
        });
    } catch (error) {
        console.error('Error fetching kanban board:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/kanban/items
kanbanRouter.post('/items', async (req: any, res) => {
    try {
        const { status, title, description, priority, due_date, show_on_dashboard } = req.body;
        const userId = req.user.sub;
        
        if (!title) return res.status(400).json({ error: 'Title required' });
        
        const result = await withUser(userId, async (client) => {
            const r = await client.query(`
                INSERT INTO kanban_items (user_id, status, title, description, priority, due_date, show_on_dashboard)
                VALUES ($1, COALESCE($2, 'To Do'), $3, $4, COALESCE($5, 'medium'), $6, COALESCE($7, false))
                RETURNING *
            `, [userId, status || 'To Do', title, description, priority, due_date, show_on_dashboard || false]);
            
            if (r.rows[0].show_on_dashboard) {
                await client.query(`
                    INSERT INTO dashboard_modules (user_id, module_type, ref_id)
                    VALUES ($1, 'kanban_item', $2)
                `, [userId, r.rows[0].id]);
            }
            
            return r;
        });
        
        const item = result.rows[0];
        item.tags = [];
        res.status(201).json(item);
    } catch (error) {
        console.error('Error creating kanban item:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/kanban/items/:id
kanbanRouter.put('/items/:id', async (req: any, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.user.sub;
        
        // Fields to update
        const updates: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let pidx = 1;

        if (req.body.title !== undefined) { updates.push(`title = $${pidx++}`); values.push(req.body.title); }
        if (req.body.description !== undefined) { updates.push(`description = $${pidx++}`); values.push(req.body.description); }
        if (req.body.priority !== undefined) { updates.push(`priority = $${pidx++}`); values.push(req.body.priority); }
        if (req.body.due_date !== undefined) { updates.push(`due_date = $${pidx++}`); values.push(req.body.due_date); }
        if (req.body.status !== undefined) { updates.push(`status = $${pidx++}`); values.push(req.body.status); }
        if (req.body.show_on_dashboard !== undefined) { updates.push(`show_on_dashboard = $${pidx++}`); values.push(req.body.show_on_dashboard); }
        
        values.push(itemId);
        values.push(userId);
        const userIdPidx = pidx + 1;

        const updated = await withUser(userId, async (client) => {
            const old = await client.query('SELECT show_on_dashboard FROM kanban_items WHERE id = $1 AND user_id = $2', [itemId, userId]);
            if (old.rows.length === 0) return null;
            
            const r = await client.query(`
                UPDATE kanban_items 
                SET ${updates.join(', ')}
                WHERE id = $${pidx} AND user_id = $${userIdPidx}
                RETURNING *
            `, values);

            if (req.body.show_on_dashboard !== undefined && old.rows[0].show_on_dashboard !== req.body.show_on_dashboard) {
                if (req.body.show_on_dashboard) {
                    await client.query(`INSERT INTO dashboard_modules (user_id, module_type, ref_id) VALUES ($1, 'kanban_item', $2)`, [userId, itemId]);
                } else {
                    await client.query(`DELETE FROM dashboard_modules WHERE module_type = 'kanban_item' AND ref_id = $1 AND user_id = $2`, [itemId, userId]);
                }
            }
            return r;
        });

        if (!updated) return res.status(404).json({ error: 'Not found' });
        res.json(updated.rows[0]);
    } catch (error) {
        console.error('Error updating kanban item:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/kanban/items/:id
kanbanRouter.delete('/items/:id', async (req: any, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.user.sub;
        
        const deleted = await withUser(userId, async (client) => {
            const r = await client.query('DELETE FROM kanban_items WHERE id = $1 AND user_id = $2 RETURNING id', [itemId, userId]);
            if (r.rowCount > 0) {
                await client.query(`DELETE FROM dashboard_modules WHERE module_type = 'kanban_item' AND ref_id = $1 AND user_id = $2`, [itemId, userId]);
            }
            return r.rowCount > 0;
        });
        
        if (!deleted) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting kanban item:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/kanban/items/:id/tags/:tagId
kanbanRouter.post('/items/:id/tags/:tagId', async (req: any, res) => {
    try {
        await withUser(req.user.sub, async (client) => {
            await client.query(`
                INSERT INTO kanban_item_tags (item_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
            `, [req.params.id, req.params.tagId]);
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/kanban/items/:id/tags/:tagId
kanbanRouter.delete('/items/:id/tags/:tagId', async (req: any, res) => {
    try {
        await withUser(req.user.sub, async (client) => {
            await client.query(`
                DELETE FROM kanban_item_tags WHERE item_id = $1 AND tag_id = $2
            `, [req.params.id, req.params.tagId]);
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/kanban/items/:id
kanbanRouter.get('/items/:id', async (req: any, res) => {
    try {
        const result = await withUser(req.user.sub, async (client) => {
            return client.query(`
                SELECT i.*, 
                   i.status as column_name,
                   COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color)) FILTER (WHERE t.id IS NOT NULL), '[]') as tags
                FROM kanban_items i
                LEFT JOIN kanban_item_tags it ON i.id = it.item_id
                LEFT JOIN tags t ON it.tag_id = t.id
                WHERE i.id = $1 AND i.user_id = $2
                GROUP BY i.id
            `, [req.params.id, req.user.sub]);
        });
        
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

