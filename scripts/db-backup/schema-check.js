#!/usr/bin/env node
// Read-only drift check: compares the live database schema to
// scripts/schema.sql and scripts/auth-schema.sql.
// Usage: node scripts/db-backup/schema-check.js   (exit 0 = no drift, 1 = drift or error)
// Credentials come from DATABASE_* env vars, with the same gitignore-guarded
// .env.migration fallback as backup.js. Nothing is printed except object names.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const REPO = path.resolve(__dirname, '..', '..');
const NEEDED = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME', 'DATABASE_USER', 'DATABASE_PASSWORD'];

function fail(msg) {
  console.error('SCHEMA CHECK FAILED: ' + msg);
  process.exit(1);
}

function loadEnvFallback() {
  if (NEEDED.every((k) => process.env[k])) return;
  try {
    execFileSync('git', ['check-ignore', '-q', '.env.migration'], { cwd: REPO, stdio: 'ignore' });
  } catch {
    fail('.env.migration is not gitignored (or git check failed); refusing to read it');
  }
  let text;
  try { text = fs.readFileSync(path.join(REPO, '.env.migration'), 'utf8'); } catch { fail('DATABASE_* not set and .env.migration not readable'); }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const sql =
  fs.readFileSync(path.join(REPO, 'scripts', 'schema.sql'), 'utf8') + '\n' +
  fs.readFileSync(path.join(REPO, 'scripts', 'auth-schema.sql'), 'utf8');

// Tables and columns as declared in the scripts.
const scriptCols = {};
for (const m of sql.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\);/g)) {
  scriptCols[m[1]] = {};
  for (const l of m[2].split('\n')) {
    const x = l.trim().replace(/,$/, '');
    const cm = x.match(/^(\w+)\s+(\w+)/);
    if (cm) scriptCols[m[1]][cm[1]] = /NOT NULL|PRIMARY KEY/.test(x) ? 'NOT NULL' : 'NULL';
  }
}
const scriptIdx = [...sql.matchAll(/CREATE INDEX (\w+)/g)].map((m) => m[1]).sort();
const scriptCounts = {
  p: (sql.match(/PRIMARY KEY/g) || []).length,
  f: (sql.match(/REFERENCES/g) || []).length,
  c: (sql.match(/CHECK \(/g) || []).length,
  u: (sql.match(/\bUNIQUE\b/g) || []).length,
};

(async () => {
  loadEnvFallback();
  const missing = NEEDED.filter((k) => !process.env[k]);
  if (missing.length) fail('missing env vars: ' + missing.join(', '));
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
  const diffs = [];
  const info = [];
  try {
    await client.query('BEGIN READ ONLY');
    const q = async (s) => (await client.query(s)).rows;
    const cols = await q(
      "SELECT table_name, column_name, is_nullable FROM information_schema.columns " +
      "WHERE table_schema = 'public' AND table_name IN " +
      "(SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')");
    const liveCols = {};
    for (const c of cols) (liveCols[c.table_name] ??= {})[c.column_name] = c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
    for (const t of new Set([...Object.keys(scriptCols), ...Object.keys(liveCols)])) {
      if (!scriptCols[t]) { diffs.push(`table only live: ${t}`); continue; }
      if (!liveCols[t]) { diffs.push(`table only in scripts: ${t}`); continue; }
      for (const c of new Set([...Object.keys(scriptCols[t]), ...Object.keys(liveCols[t])])) {
        if (!scriptCols[t][c]) diffs.push(`column only live: ${t}.${c}`);
        else if (!liveCols[t][c]) diffs.push(`column only in scripts: ${t}.${c}`);
        else if (scriptCols[t][c] !== liveCols[t][c]) diffs.push(`nullability differs: ${t}.${c} script=${scriptCols[t][c]} live=${liveCols[t][c]}`);
      }
    }
    const liveIdx = (await q(
      "SELECT i.indexname FROM pg_indexes i WHERE i.schemaname = 'public' AND NOT EXISTS (" +
      "SELECT 1 FROM pg_constraint c WHERE c.conindid = (quote_ident(i.schemaname)||'.'||quote_ident(i.indexname))::regclass)"))
      .map((r) => r.indexname).sort();
    for (const i of liveIdx) if (!scriptIdx.includes(i)) diffs.push(`index only live: ${i}`);
    for (const i of scriptIdx) if (!liveIdx.includes(i)) diffs.push(`index only in scripts: ${i}`);
    const liveCons = {};
    for (const r of await q("SELECT contype, count(*)::int AS n FROM pg_constraint WHERE connamespace = 'public'::regnamespace GROUP BY 1")) liveCons[r.contype] = r.n;
    for (const k of ['p', 'f', 'c', 'u']) {
      if ((liveCons[k] || 0) !== scriptCounts[k]) diffs.push(`constraint count differs (${k}): script=${scriptCounts[k]} live=${liveCons[k] || 0}`);
    }
    // Objects the scripts never define: any at all is drift.
    const extras = {
      triggers: "SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace",
      functions: "SELECT count(*)::int AS n FROM pg_proc WHERE pronamespace='public'::regnamespace",
      sequences: "SELECT count(*)::int AS n FROM pg_sequences WHERE schemaname='public'",
      views: "SELECT count(*)::int AS n FROM information_schema.views WHERE table_schema='public'",
      enum_types: "SELECT count(*)::int AS n FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e'",
      rls_tables: "SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relrowsecurity",
      other_schemas_with_tables: "SELECT count(DISTINCT table_schema)::int AS n FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('public','pg_catalog','information_schema')",
    };
    for (const [k, s] of Object.entries(extras)) {
      const n = (await q(s))[0].n;
      if (n) diffs.push(`live has ${n} ${k} not defined by the scripts`);
    }
    info.push(`extensions: ${(await q('SELECT extname FROM pg_extension ORDER BY 1')).map((r) => r.extname).join(', ')}`);
    await client.query('ROLLBACK');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    await client.end().catch(() => {});
    fail(String(e.message).split(process.env.DATABASE_PASSWORD).join('***'));
  }
  await client.end();
  console.log(`tables: ${Object.keys(scriptCols).length} in scripts; indexes: ${scriptIdx.length}; constraints (p/f/c/u): ${scriptCounts.p}/${scriptCounts.f}/${scriptCounts.c}/${scriptCounts.u}`);
  info.forEach((l) => console.log(l));
  console.log('Not compared: column data types, defaults, seed rows.');
  if (diffs.length) {
    console.error('DRIFT FOUND:');
    diffs.forEach((d) => console.error(' - ' + d));
    process.exit(1);
  }
  console.log('SCHEMA CHECK OK: no drift');
})().catch((e) => fail(String(e.message)));
