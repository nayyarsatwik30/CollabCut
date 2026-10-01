#!/usr/bin/env node
// Applies scripts/migration-asset-priority.sql (ADD COLUMN, a guarded ADD
// CONSTRAINT, and a CREATE INDEX, all IF NOT EXISTS / idempotent) in a single
// transaction, then verifies the column, constraint and index exist and that
// every existing row backfilled to priority 3.
// Usage: node scripts/db-backup/run-migration-priority.js
// Credentials load exactly like backup.js (DATABASE_* env vars, else the
// gitignored .env.migration). Only host and database name are ever printed.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const REPO = path.resolve(__dirname, '..', '..');
const SQL_FILE = path.join(REPO, 'scripts', 'migration-asset-priority.sql');
const NEEDED = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME', 'DATABASE_USER', 'DATABASE_PASSWORD'];

function scrub(msg) {
  let s = String(msg);
  for (const k of ['DATABASE_PASSWORD', 'DATABASE_USER']) {
    const v = process.env[k];
    if (v) s = s.split(v).join('***');
  }
  return s;
}

function fail(msg) {
  console.error('MIGRATION FAILED: ' + scrub(msg));
  process.exit(1);
}

// Identical to backup.js loadEnvFallback.
function loadEnvFallback() {
  if (NEEDED.every((k) => process.env[k])) return;
  const file = path.join(REPO, '.env.migration');
  try {
    execFileSync('git', ['check-ignore', '-q', '.env.migration'], { cwd: REPO, stdio: 'ignore' });
  } catch {
    fail('.env.migration is not gitignored (or git check failed); refusing to read it');
  }
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { fail('DATABASE_* not set and .env.migration not readable'); }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

function readSql() {
  let text;
  try { text = fs.readFileSync(SQL_FILE, 'utf8'); } catch { fail('cannot read scripts/migration-asset-priority.sql'); }
  const required = [
    'ALTER TABLE assets ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 3;',
    "conname = 'assets_priority_check'",
    'ALTER TABLE assets ADD CONSTRAINT assets_priority_check CHECK (priority BETWEEN 1 AND 3);',
    'CREATE INDEX IF NOT EXISTS idx_assets_asset_group_id ON assets (asset_group_id);',
  ];
  for (const fragment of required) {
    if (!text.includes(fragment)) fail('migration file is missing expected statement: ' + fragment);
  }
  return text;
}

(async () => {
  loadEnvFallback();
  const missing = NEEDED.filter((k) => !process.env[k]);
  if (missing.length) fail('missing env vars: ' + missing.join(', '));

  console.log('host    :', process.env.DATABASE_HOST);
  console.log('database:', process.env.DATABASE_NAME);

  const sql = readSql();

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
    // 1. Migration, all-or-nothing.
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw new Error('transaction rolled back: ' + e.message);
    }
    console.log('migration committed');

    // 2. Verify column, constraint and index.
    const col = (await client.query(
      `SELECT column_name, data_type, column_default, is_nullable
       FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'priority'`
    )).rows[0];
    if (!col) throw new Error('column "priority" missing after commit');
    console.log('verified column:', col);

    const constraint = (await client.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'assets_priority_check'`
    )).rows[0];
    if (!constraint) throw new Error('constraint "assets_priority_check" missing after commit');
    console.log('verified constraint: assets_priority_check');

    const index = (await client.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_assets_asset_group_id'`
    )).rows[0];
    if (!index) throw new Error('index "idx_assets_asset_group_id" missing after commit');
    console.log('verified index: idx_assets_asset_group_id');

    // 3. Every pre-existing row must have backfilled to the default, 3.
    const counts = (await client.query(
      `SELECT count(*) AS total, count(*) FILTER (WHERE priority = 3) AS at_default
       FROM assets`
    )).rows[0];
    console.log('row counts:', counts);
    if (Number(counts.total) !== Number(counts.at_default)) {
      throw new Error(`expected every row to backfill to priority 3; total=${counts.total} at_default=${counts.at_default}`);
    }
    console.log('verified backfill: all', counts.total, 'existing rows show priority 3');
    console.log('MIGRATION OK');
  } catch (e) {
    await client.end().catch(() => {});
    fail(e.message);
  }
  await client.end();
})().catch((e) => fail(e.message));
