# Production database backup

Read-only backup tooling for the CollabCut production PostgreSQL database
(CloudClusters, PostgreSQL 16). Scripts live in `scripts/db-backup/`.

| script | what it does | status |
|---|---|---|
| `backup.js` | Row-level JSON export of every table | tested against production (read-only) |
| `schema-check.js` | Compares the live schema to `scripts/schema.sql` + `auth-schema.sql` | tested against production (read-only) |
| `restore-check.js` | Loads a dump into a throwaway database to prove it restores | **written, not yet tested** |

## This is NOT a full database dump

The JSON export is a data backup. Together with `scripts/schema.sql` and
`scripts/auth-schema.sql` it is enough to rebuild the current structure and data,
but it does not capture:

- **Grants and privileges**, and **roles / object ownership**.
- **Sequence current values.** None exist today (0 sequences, all ids are UUIDs).
- **RLS policies.** The schema scripts do not define any, and none exist live as of 2026-09-24. Any added later would not be in the dump or the scripts.
- **Extensions.** Only `plpgsql` (built in) is installed. Any added later is not recorded.
- **Schema itself.** Tables, columns, indexes, constraints are not in the JSON. They come from the schema scripts, so keep those scripts in sync (`schema-check.js` detects drift).
- **Triggers, functions, views, custom types.** None exist today.
- **Exact type fidelity.** `bigint` and `numeric` values are exported as strings, timestamps as ISO strings, `jsonb` as JSON. Binary (`bytea`) columns are not handled. There are none today.
- **Comments, server settings, statistics, large objects.**

A real `pg_dump` backup is a recommended later upgrade. `pg_dump` is not installed
on this machine; the client should be v16 or newer.

## Sensitive data

Dumps contain **password hashes** (`auth_credentials.password_hash`,
`share_links.password_hash`), **share-link tokens**, and user emails. Treat every
dump file as sensitive:

- Store only in `D:\Backups\collabcut\`. Never inside the repo, never committed.
- Do not put it in OneDrive, Google Drive, Dropbox or any synced folder. For an
  off-laptop copy use encrypted removable storage.
- Do not paste or attach it to chats or tickets.

## Running a backup

Requirements: Node with the repo's `node_modules` (uses the existing `pg` package).
Nothing to install.

Set the connection in your environment for one PowerShell session (values are
never printed by the scripts):

```powershell
$env:DATABASE_HOST     = '<host>'
$env:DATABASE_PORT     = '<port>'
$env:DATABASE_NAME     = '<database>'
$env:DATABASE_USER     = '<user>'
$env:DATABASE_PASSWORD = '<password>'
node scripts/db-backup/backup.js
```

Variables die with the session. If any `DATABASE_*` variable is unset, the scripts
fall back to reading `.env.migration`, but only after `git check-ignore` confirms
that file is gitignored; otherwise they stop.

What `backup.js` guarantees:

- One transaction, `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`. The server rejects any write, and it is rolled back at the end.
- Every base table in every non-system schema is exported.
- Each table's exported row count is checked against a live `count(*)` in the same snapshot.
- The file is written, read back and re-verified before it is kept. A zero-row dump is rejected.
- Refuses to write anywhere inside the repo. Output goes to `D:\Backups\collabcut\` (override with `BACKUP_DIR`, still not inside the repo).
- Filename is timestamped: `collabcut-prod-backup-<UTC timestamp>.json`, plus a `.sha256` sidecar.
- Exits non-zero on any failure.

Verify a stored dump later:

```powershell
Get-FileHash D:\Backups\collabcut\<file>.json -Algorithm SHA256
```

Compare with the `.sha256` file next to it.

## Schema drift check

```powershell
node scripts/db-backup/schema-check.js
```

Exit 0 means the live tables, columns, nullability, named indexes and constraint
counts match the schema scripts, and that the live DB has no triggers, functions,
sequences, views, enum types, RLS or extra schemas the scripts don't define.
Exit 1 lists each difference. It does not compare column data types, defaults or
seed rows.

## Restore check (written, not yet tested)

`restore-check.js` has never been run. There is no throwaway database yet.

It loads a dump into an empty throwaway database (schema scripts first, then
rows in foreign-key order), compares counts to the dump, then rolls back.

```powershell
$env:RESTORE_HOST = '<throwaway host>'; $env:RESTORE_PORT = '<port>'
$env:RESTORE_DB = '<empty throwaway db>'; $env:RESTORE_USER = '<user>'; $env:RESTORE_PASSWORD = '<password>'
node scripts/db-backup/restore-check.js D:\Backups\collabcut\<file>.json --throwaway
```

Safety guard, checked before any connection is made. It refuses when:

- host, port and database name all match production;
- the target database name equals the production name, on any host;
- the target host equals the production host (a separate server is required);
- production identity cannot be determined;
- `--throwaway` is not passed, or the target database is not empty.

Never create a database on the production server for this. Use a separate local
or hosted PostgreSQL. After its first successful run, update the status table above.
