import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

async function applyMigration() {
  const sql = fs.readFileSync('supabase/migrations/006_schedule_order_sync.sql', 'utf8');
  const client = new Client({
    connectionString: process.env.DATABASE_POOLER_URL || '',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  console.log('Executing migration 006_schedule_order_sync.sql...');
  await client.query(sql);
  console.log('Migration 006 executed successfully!');

  // Verify schedule column
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'schedule' AND column_name = 'order_id'
  `);
  console.log('Schedule column order_id verified:', cols.rows);

  await client.end();
}

applyMigration().catch((err) => {
  console.error('Migration 006 failed:', err);
  process.exit(1);
});
