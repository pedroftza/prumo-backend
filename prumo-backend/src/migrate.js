const fs = require('fs');
const path = require('path');
const pool = require('./db');

// Roda o schema.sql inteiro a cada start do servidor. Como todas as
// instruções usam "IF NOT EXISTS", isso é seguro de rodar repetidas vezes —
// não apaga nem duplica nada que já existe.
async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Migração concluída: tabelas verificadas/criadas.');
}

module.exports = migrate;
