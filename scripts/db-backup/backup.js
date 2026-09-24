#!/usr/bin/env node
// Read-only, row-level JSON export of the production database.
// Usage: node scripts/db-backup/backup.js
// Reads DATABASE_HOST/PORT/NAME/USER/PASSWORD from the environment. If any are
// unset, falls back to .env.migration, but only when git confirms it is ignored.
// Never writes to the database and never prints credentials.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const REPO = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.resolve(process.env.BACKUP_DIR || 'D:\\Backups\\collabcut');
const NEEDED = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME', 'DATABASE_USER', 'DATABASE_PASSWORD'];

function fail(msg) {
  console.error('BACKUP FAILED: ' + msg);
  process.exit(1);
}

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

function insideRepo(dir) {
  const rel = path.relative(REPO.toLowerCase(), dir.toLowerCase());
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

(async () => {
  if (insideRepo(OUT_DIR)) fail('output directory is inside the repo; dumps must live outside it');
  loadEnvFallback();
  const missing = NEEDED.filter((k) => !process.env[k]);
  if (missing.length) fail('missing env vars: ' + missing.join(', '));
  fs.mkdirSync(OUT_DIR, { recursive: true });

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
  const out = {};
  const counts = {};
  try {
    // One consistent snapshot, and the server rejects any write.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const version = (await client.query('SELECT version() AS v')).rows[0].v;
    const tables = (await client.query(
      "SELECT table_schema AS s, table_name AS t FROM information_schema.tables " +
      "WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema') " +
      'ORDER BY 1, 2')).rows;
    if (!tables.length) throw new Error('no base tables found');
    const exportedAt = new Date().toISOString();
    out._meta = { exported_at: exportedAt, database: process.env.DATABASE_NAME, version, host: process.env.DATABASE_HOST };
    for (const { s, t } of tables) {
      const key = s === 'public' ? t : `${s}.${t}`;
      const q = `"${s.replace(/"/g, '""')}"."${t.replace(/"/g, '""')}"`;
      const rows = (await client.query(`SELECT * FROM ${q}`)).rows;
      const live = Number((await client.query(`SELECT count(*) AS n FROM ${q}`)).rows[0].n);
      if (rows.length !== live) throw new Error(`row count mismatch on ${key}: exported ${rows.length}, live ${live}`);
      out[key] = rows;
      counts[key] = rows.length;
    }
    await client.query('ROLLBACK');
    out._meta.row_counts = counts;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    await client.end().catch(() => {});
    fail(String(e.message).split(process.env.DATABASE_PASSWORD).join('***'));
  }
  await client.end();

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) fail('dump has zero rows; refusing to keep it');

  const stamp = out._meta.exported_at.replace(/[:.]/g, '-');
  const file = path.join(OUT_DIR, `collabcut-prod-backup-${stamp}.json`);
  const tmp = file + '.partial';
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2));

  // Read the file back and re-check it before keeping it.
  const back = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  for (const [k, n] of Object.entries(counts)) {
    if (!Array.isArray(back[k]) || back[k].length !== n) {
      fs.rmSync(tmp, { force: true });
      fail(`written file failed verification on ${k}`);
    }
  }
  fs.renameSync(tmp, file);
  const size = fs.statSync(file).size;
  if (size === 0) fail('output file is empty');
  const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  fs.writeFileSync(file + '.sha256', `${sha}  ${path.basename(file)}\n`);

  console.log('BACKUP OK');
  console.log('file  :', file);
  console.log('size  :', size, 'bytes');
  console.log('sha256:', sha);
  console.log('tables:', Object.keys(counts).length, ' rows:', total);
  console.log(counts);
  console.log('SENSITIVE: contains password hashes and share-link tokens. Do not sync or share.');
})().catch((e) => fail(String(e.message)));
