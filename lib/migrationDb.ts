import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var _migrationPgPool: Pool | undefined
}

export const migrationDb =
  global._migrationPgPool ??
  new Pool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  })

if (process.env.NODE_ENV !== 'production') {
  global._migrationPgPool = migrationDb
}
