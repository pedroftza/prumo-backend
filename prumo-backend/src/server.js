require('dotenv').config();
const express = require('express');
const cors = require('cors');
const migrate = require('./migrate');
const authRoutes = require('./routes/auth');
const journalRoutes = require('./routes/journal');
const marketRoutes = require('./routes/market');
const contactRoutes = require('./routes/contact');
const { requireAuth } = require('./middleware/auth');

const app = express();

// Lista de sites que podem chamar essa API, separados por vírgula na
// variável de ambiente ALLOWED_ORIGINS. Sem isso, o navegador bloqueia
// as chamadas vindas do prumotrading.com por segurança (CORS).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origem não permitida pelo CORS: ' + origin));
  }
}));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/journal', requireAuth, journalRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/contact', contactRoutes);

// captura de erro genérica (ex.: CORS rejeitado) pra nunca devolver HTML de erro
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno.' });
});

const PORT = process.env.PORT || 3000;

migrate()
  .then(() => {
    app.listen(PORT, () => console.log('API da Prumo rodando na porta ' + PORT));
  })
  .catch(err => {
    console.error('Falha ao rodar a migração do banco de dados:', err);
    process.exit(1);
  });
