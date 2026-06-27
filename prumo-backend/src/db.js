const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

// O Render injeta DATABASE_URL automaticamente quando você conecta
// o banco PostgreSQL ao Web Service. Em produção, a conexão precisa
// de SSL (rejectUnauthorized:false porque o Render usa certificado próprio).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

pool.on('error', err => {
  console.error('Erro inesperado na conexão com o banco:', err);
});

module.exports = pool;
