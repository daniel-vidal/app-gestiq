require('dotenv').config();

const { Pool } = require('pg');

const rawPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD || ''
const coercedPassword = typeof rawPassword === 'string' ? rawPassword : String(rawPassword)

if (process.env.DEBUG_DB_PASSWORD === 'true') {
  const masked = coercedPassword ? '*'.repeat(Math.min(8, coercedPassword.length)) : '(empty)'
  console.log(`[db] DB password present=${Boolean(coercedPassword)} type=${typeof rawPassword} masked=${masked}`)
}

const pool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  database: process.env.DB_NAME || process.env.PGDATABASE || 'gestiq',
  user: process.env.DB_USER || process.env.PGUSER,
  password: coercedPassword,
})

module.exports = pool;