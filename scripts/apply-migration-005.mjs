import fs from 'fs';
import { Client } from 'pg';

async function applyMigration() {
  const sql = fs.readFileSync('supabase/migrations/005_payment_terms_and_duplicata.sql', 'utf8');
  const client = new Client({
    host: process.env.DB_HOST || 'aws-0-us-east-2.pooler.supabase.com',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres.nlnkwrfzqvhncwfuuogo',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');
  
  console.log('Executing migration 005_payment_terms_and_duplicata.sql...');
  await client.query(sql);
  console.log('Migration executed successfully!');

  // Verify columns
  const ordersCols = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name IN ('payment_method', 'due_date')
  `);
  console.log('Orders columns:', ordersCols.rows.map(r => r.column_name));

  const transCols = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name IN ('payment_status', 'due_date')
  `);
  console.log('Transactions columns:', transCols.rows.map(r => r.column_name));

  await client.end();
}

applyMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
