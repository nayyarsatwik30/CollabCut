#!/usr/bin/env node
// WRITTEN, NOT YET TESTED. Restores a JSON dump into a THROWAWAY database to
// prove the dump is usable. It must never be pointed at production.
//
// Usage: node scripts/db-backup/restore-check.js <dump.json> --throwaway
// Target (an EMPTY database you created yourself, never on the production server):
//   RESTORE_HOST, RESTORE_PORT, RESTORE_DB, RESTORE_USER, RESTORE_PASSWORD
// Production identity for the guard comes from DATABASE_* (env, or the same
// gitignore-guarded .env.migration fallback as backup.js). If production
// identity cannot be determined, this script refuses to run.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const REPO = path.resolve(__dirname, '..', '..');
const PROD = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME'];
const TARGET = ['RESTORE_HOST', 'RESTORE_PORT', 'RESTORE_DB', 'RESTORE_USER', 'RESTORE_PASSWORD'];

// Parents before children. projects.cover_asset_id points at assets, which point
// back at projects, so it is inserted as NULL and patched after assets.
const ORDER = [
  'plans', 'workspace_plans', 'profiles', 'auth_credentials', 'workspaces', 'workspace_members',
  'projects', 'assets', 'project_members', 'share_links', 'comments', 'replies',
  'approvals', 'notifications', 'asset_editors', 'raw_files',
];

function fail(msg) {
  console.error('RESTORE CHECK FAILED: ' + msg);
  process.exit(1);
}

function loadProdIdentity() {
  if (PROD.every((k) => process.env[k])) return;
  try {
    execFileSync('git', ['check-ignore', '-q', '.env.migration'], { cwd: REPO, stdio: 'ignore' });
  } catch {
    fail('cannot verify production identity: .env.migration is not gitignored');
  }
  let text;
  try { text = fs.readFileSync(path.join(REPO, '.env.migration'), 'utf8'); } catch { fail('cannot verify production identity: DATABASE_* not set'); }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(DATABASE_(?:HOST|PORT|NAME))\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

function guard() {
  loadProdIdentity();
  const missingProd = PROD.filter((k) => !process.env[k]);
  if (missingProd.length) fail('production identity unknown, refusing: ' + missingProd.join(', '));
  const missing = TARGET.filter((k) => !process.env[k]);
  if (missing.length) fail('missing target env vars: ' + missing.join(', '));
  const norm = (s) => String(s).trim().toLowerCase();
  const sameHost = norm(process.env.RESTORE_HOST) === norm(process.env.DATABASE_HOST);
  const samePort = String(process.env.RESTORE_PORT) === String(process.env.DATABASE_PORT);
  const sameDb = norm(process.env.RESTORE_DB) === norm(process.env.DATABASE_NAME);
  if (sameHost && samePort && sameDb) fail('target is the production database');
  if (sameDb) fail('target database name equals the production database name (on any host)');
  if (sameHost) fail('target is on the production server; use a separate server');
}

(async () => {
  const dumpPath = process.argv[2];
  if (!dumpPath || dumpPath.startsWith('--')) fail('usage: restore-check.js <dump.json> --throwaway');
  if (!process.argv.includes('--throwaway')) fail('pass --throwaway to confirm the target is disposable');
  guard();

  const dump = JSON.parse(fs.readFileSync(path.resolve(dumpPath), 'utf8'));
  const dumped = Object.keys(dump).filter((k) => k !== '_meta');
  const unknown = dumped.filter((k) => !ORDER.includes(k));
  if (unknown.length) fail('dump has tables this script does not know how to order: ' + unknown.join(', '));

  const client = new Client({
    host: process.env.RESTORE_HOST,
    port: Number(process.env.RESTORE_PORT),
    database: process.env.RESTORE_DB,
    user: process.env.RESTORE_USER,
    password: process.env.RESTORE_PASSWORD,
    ssl: process.env.RESTORE_SSL === '1',
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  try {
    const existing = (await client.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n;
    if (existing) throw new Error('target database is not empty; use a fresh throwaway database');
    await client.query('BEGIN');
    for (const f of ['schema.sql', 'auth-schema.sql']) {
      await client.query(fs.readFileSync(path.join(REPO, 'scripts', f), 'utf8'));
    }
    // The schema script seeds workspace_plans; clear it so the dump is the only source.
    await client.query('DELETE FROM workspace_plans');
    const cover = [];
    for (const t of ORDER) {
      const rows = dump[t] || [];
      for (const row of rows) {
        const r = { ...row };
        if (t === 'projects' && r.cover_asset_id) { cover.push([r.id, r.cover_asset_id]); r.cover_asset_id = null; }
        const keys = Object.keys(r);
        const vals = keys.map((k) => (r[k] !== null && typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]));
        await client.query(
          `INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
          vals);
      }
      if (t === 'assets') {
        for (const [pid, aid] of cover) await client.query('UPDATE projects SET cover_asset_id = $1 WHERE id = $2', [aid, pid]);
      }
    }
    const bad = [];
    for (const t of ORDER) {
      const n = (await client.query(`SELECT count(*)::int AS n FROM "${t}"`)).rows[0].n;
      const want = (dump[t] || []).length;
      if (n !== want) bad.push(`${t}: restored ${n}, dump ${want}`);
    }
    if (bad.length) throw new Error('count mismatch after restore: ' + bad.join('; '));
    await client.query('ROLLBACK'); // nothing is kept, the check itself is the result
    console.log('RESTORE CHECK OK: schema built and all rows loaded with matching counts (rolled back)');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    await client.end().catch(() => {});
    fail(String(e.message).split(process.env.RESTORE_PASSWORD).join('***'));
  }
  await client.end();
})().catch((e) => fail(String(e.message)));
