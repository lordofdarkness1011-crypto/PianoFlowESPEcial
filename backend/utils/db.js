const { Pool } = require('pg');
require('dotenv').config();
const logger = require('./logger');

const poolConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'pianoflow',
        password: process.env.DB_PASSWORD || 'postgres',
        port: process.env.DB_PORT || 5432,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };

const pool = new Pool(poolConfig);

pool.on('error', (err, client) => {
    logger.error('Error inesperado del pool de conexiones a Postgres', err);
});

module.exports = pool;
