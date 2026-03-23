require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'gestiq',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

module.exports = pool;