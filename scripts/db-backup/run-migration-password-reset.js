#!/usr/bin/env node
// Applies scripts/migration-password-reset.sql (idempotent) in one transaction,
// then verifies the three columns and the index exist.
// Usage: node scripts/db-backup/run-migration-password-reset.js
// Credentials load exactly like backup.js (DATABASE_* env vars, else the
// gitignored .env.migration). Only host and database name are ever printed.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const REPO = path.resolve(__dirname, '..', '..');
const SQL_FILE = path.join(REPO, 'scripts', 'migration-password-reset.sql');
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
  try { return fs.readFileSync(SQL_FILE, 'utf8'); } catch { fail('cannot read scripts/migration-password-reset.sql'); }
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
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw new Error('transaction rolled back: ' + e.message);
    }
    console.log('migration committed');

    const cols = (await client.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
       WHERE table_name = 'auth_credentials' AND column_name LIKE 'reset\_%'
       ORDER BY column_name`
    )).rows;
    console.log('columns:', cols);
    for (const c of ['reset_requested_at', 'reset_token_expires_at', 'reset_token_hash']) {
      if (!cols.some((r) => r.column_name === c)) throw new Error('column missing after commit: ' + c);
    }
    const idx = (await client.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_auth_credentials_reset_token_hash'`
    )).rows[0];
    if (!idx) throw new Error('index missing after commit');
    console.log('verified index:', idx.indexname);
    console.log('MIGRATION OK');
  } catch (e) {
    await client.end().catch(() => {});
    fail(e.message);
  }
  await client.end();
})().catch((e) => fail(e.message));
