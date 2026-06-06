import { pool } from './api/db.js';

async function migrate() {
    try {
        await pool.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS filename VARCHAR(255);');
        console.log('Migration successful.');
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
migrate();
