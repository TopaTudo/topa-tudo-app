import fs from 'fs';
import { Client } from 'pg';

async function applyMigration() {
  const sql = fs.readFileSync('supabase/migrations/002_fixes_and_security.sql', 'utf8');
  const client = new Client({
    host: 'aws-0-us-east-2.pooler.supabase.com',
    port: 5432,
    user: 'postgres.nlnkwrfzqvhncwfuuogo',
    password: '@Edu99001628',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');
  console.log('Executing migration 002_fixes_and_security.sql...');
  await client.query(sql);
  console.log('Migration executed successfully!');

  // Verify profiles table
  const profilesRes = await client.query('SELECT id, name, pin, role FROM profiles');
  console.log('Updated profiles in DB:');
  for (const p of profilesRes.rows) {
    const pinPreview = p.pin ? p.pin.substring(0, 10) + '...' : 'null';
    console.log(`- ${p.name} (${p.role}): PIN is ${pinPreview} (length: ${p.pin?.length})`);
  }

  // Verify verify_user_pin RPC
  const admin = profilesRes.rows.find((p) => p.name === 'Administrador');
  if (admin) {
    const testCorrect = await client.query('SELECT public.verify_user_pin($1::uuid, $2::text) as ok', [admin.id, '1234']);
    const testWrong = await client.query('SELECT public.verify_user_pin($1::uuid, $2::text) as ok', [admin.id, '9999']);
    console.log('Test verify_user_pin with 1234:', testCorrect.rows[0].ok);
    console.log('Test verify_user_pin with 9999:', testWrong.rows[0].ok);
  }

  await client.end();
}

applyMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
