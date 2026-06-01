import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/trashnet' });

async function run() {
  await client.connect();
  const sql = fs.readFileSync(path.join(process.cwd(), 'migrations/003-dashboard.sql'), 'utf8');
  await client.query(sql);
  console.log('Migration 003 applied');
  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
