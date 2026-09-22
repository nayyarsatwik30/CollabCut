require('dotenv').config({ path: '.env.migration', quiet: true });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const client = new Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function run() {
  await client.connect();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, 'seed-plans.sql'), 'utf8');

  try {
    await client.query('BEGIN');
    await client.query(schema);
    await client.query(seed);
    await client.query('COMMIT');
    console.log('Schema + seed applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('FAILED, rolled back:', err.message);
    process.exitCode = 1;
    return;
  }

  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
  );
  console.log('Tables now in public schema:', tables.rows.map(r => r.table_name));

  const plans = await client.query('SELECT id, name, storage_gb, price_monthly FROM plans ORDER BY sort_order, id;');
  console.log('plans rows:', plans.rows);

  await client.end();
}

run();
