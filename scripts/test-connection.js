require('dotenv').config({ path: '.env.migration' });
const { Client } = require('pg');

const client = new Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: false,
  connectionTimeoutMillis: 8000,
});

client.connect()
  .then(async () => {
    const res = await client.query('SELECT version(), current_database(), current_user;');
    console.log('CONNECTED OK');
    console.log(res.rows[0]);
    await client.end();
  })
  .catch((err) => {
    console.error('CONNECTION FAILED:', err.message);
    process.exit(1);
  });
