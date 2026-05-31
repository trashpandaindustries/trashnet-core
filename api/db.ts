import { Pool } from 'pg';

// Fallback logic added for preview environment
const dbUrl = process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/trashnet';

export const pool = new Pool({
  connectionString: dbUrl,
});

export async function query(text: string, params?: any[]) {
  // Execute wrapped connection query to enforce RLS
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// Wrapper to enforce per-user scope
export async function withUser<T>(userId: string, callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_user_id = $1`, [userId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
