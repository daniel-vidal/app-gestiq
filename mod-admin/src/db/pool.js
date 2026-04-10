const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../..', '.env') });

const { Pool } = require('pg');

const rawPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD || '';
const coercedPassword = typeof rawPassword === 'string' ? rawPassword : String(rawPassword);

const pool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  database: process.env.DB_NAME || process.env.PGDATABASE || 'gestiq',
  user: process.env.DB_USER || process.env.PGUSER,
  password: coercedPassword,
});

module.exports = pool;
