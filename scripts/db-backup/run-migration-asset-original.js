#!/usr/bin/env node
// Applies scripts/migration-asset-original-b2.sql (three ADD COLUMN IF NOT
// EXISTS statements) in one transaction, then verifies the columns exist.
// Usage: node scripts/db-backup/run-migration-asset-original.js
// Credentials: DATABASE_* env vars, else the gitignored .env.migration. Only
// host and database name are ever printed.
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const REPO = path.resolve(__dirname, '..', '..');
const NEEDED = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME', 'DATABASE_USER', 'DATABASE_PASSWORD'];
const COLUMNS = ['original_b2_key', 'original_file_name', 'original_content_type'];

function fail(msg) {
  let s = String(msg);
  for (const k of ['DATABASE_PASSWORD', 'DATABASE_USER']) {
    if (process.env[k]) s = s.split(process.env[k]).join('***');
  }
  console.error('MIGRATION FAILED: ' + s);
  process.exit(1);
}

if (!NEEDED.every((k) => process.env[k])) require('dotenv').config({ path: path.join(REPO, '.env.migration'), quiet: true });
const missing = NEEDED.filter((k) => !process.env[k]);
if (missing.length) fail('missing env vars: ' + missing.join(', '));

(async () => {
  console.log('host    :', process.env.DATABASE_HOST);
  console.log('database:', process.env.DATABASE_NAME);
  const sql = fs.readFileSync(path.join(REPO, 'scripts', 'migration-asset-original-b2.sql'), 'utf8');

  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: false,
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  try {
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error('transaction rolled back: ' + e.message);
    }
    const found = (await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'assets' AND column_name = ANY($1)`,
      [COLUMNS]
    )).rows.map((r) => r.column_name);
    const absent = COLUMNS.filter((c) => !found.includes(c));
    if (absent.length) throw new Error('columns missing after commit: ' + absent.join(', '));
    console.log('MIGRATION OK - verified columns:', found.join(', '));
  } finally {
    await client.end().catch(() => {});
  }
})().catch((e) => fail(e.message));
