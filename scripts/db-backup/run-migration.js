#!/usr/bin/env node
// Applies scripts/migration-project-brief.sql (four idempotent ADD COLUMN statements)
// in a single transaction, verifies the columns exist, then runs a self-cleaning
// write test on the lowest-id project.
// Usage: node scripts/db-backup/run-migration.js
// Credentials load exactly like backup.js (DATABASE_* env vars, else the gitignored
// .env.migration). Only host and database name are ever printed.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const REPO = path.resolve(__dirname, '..', '..');
const SQL_FILE = path.join(REPO, 'scripts', 'migration-project-brief.sql');
const NEEDED = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME', 'DATABASE_USER', 'DATABASE_PASSWORD'];
const COLUMNS = ['brief_notes', 'brief_reference', 'brief_deadline', 'brief_drive_link'];

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

function readStatements() {
  let text;
  try { text = fs.readFileSync(SQL_FILE, 'utf8'); } catch { fail('cannot read scripts/migration-project-brief.sql'); }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('--'));
  const ok = /^ALTER TABLE projects ADD COLUMN IF NOT EXISTS [a-z_]+ [a-z]+;$/;
  if (lines.length !== 4 || !lines.every((l) => ok.test(l))) {
    fail('migration file must contain exactly four "ALTER TABLE projects ADD COLUMN IF NOT EXISTS ..." statements; nothing changed');
  }
  return lines;
}

(async () => {
  loadEnvFallback();
  const missing = NEEDED.filter((k) => !process.env[k]);
  if (missing.length) fail('missing env vars: ' + missing.join(', '));

  console.log('host    :', process.env.DATABASE_HOST);
  console.log('database:', process.env.DATABASE_NAME);

  const statements = readStatements();

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
      for (const s of statements) await client.query(s);
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw new Error('transaction rolled back: ' + e.message);
    }
    console.log('migration committed (4 statements)');

    // 2. Verify columns.
    const cols = (await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'projects' AND column_name IN ('brief_notes','brief_reference','brief_deadline','brief_drive_link')"
    )).rows.map((r) => r.column_name);
    const absent = COLUMNS.filter((c) => !cols.includes(c));
    if (absent.length) throw new Error('columns missing after commit: ' + absent.join(', '));
    console.log('verified columns:', COLUMNS.join(', '));

    // 3. Self-cleaning write test on the lowest-id project.
    const proj = (await client.query('SELECT id, brief_notes FROM projects ORDER BY id ASC LIMIT 1')).rows[0];
    if (!proj) throw new Error('no projects found for the write test');
    console.log('write test on project id:', proj.id);
    if (proj.brief_notes !== null) throw new Error('brief_notes is already set on that project; skipping write test to avoid clobbering it');
    let dirty = false;
    try {
      dirty = true;
      await client.query('UPDATE projects SET brief_notes = $1 WHERE id = $2', ['migration-test', proj.id]);
      const a = (await client.query('SELECT brief_notes FROM projects WHERE id = $1', [proj.id])).rows[0];
      if (!a || a.brief_notes !== 'migration-test') throw new Error('write test: value did not persist');
      console.log('write test: set to "migration-test" confirmed');
    } finally {
      if (dirty) {
        await client.query('UPDATE projects SET brief_notes = NULL WHERE id = $1', [proj.id]);
      }
    }
    const b = (await client.query('SELECT brief_notes FROM projects WHERE id = $1', [proj.id])).rows[0];
    if (!b || b.brief_notes !== null) throw new Error('write test: reset to NULL not confirmed for project ' + proj.id);
    console.log('write test: reset to NULL confirmed');
    console.log('MIGRATION OK');
  } catch (e) {
    await client.end().catch(() => {});
    fail(e.message);
  }
  await client.end();
})().catch((e) => fail(e.message));
