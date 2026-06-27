const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/**
 * POST /api/auth/register
 * Usado na aba "Criar conta" do Diário de Trader. Sempre cria uma conta
 * nova com papel "trader" — rejeita se o e-mail já existir.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Informe seu nome.' });
    }
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Esse e-mail já tem uma conta. Tente entrar em vez de criar conta.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [String(name).trim(), normalizedEmail, passwordHash, 'trader']
    );
    const user = inserted.rows[0];
    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Esse e-mail já tem uma conta. Tente entrar em vez de criar conta.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro interno ao criar a conta.' });
  }
});

/**
 * POST /api/auth/login
 * Usado na aba "Entrar" do Diário de Trader. Só valida uma conta que já
 * existe — não cria conta nova (isso é papel do /register).
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Não encontramos uma conta com esse e-mail. Crie uma conta primeiro.' });
    }
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });
    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno ao processar login.' });
  }
});

/**
 * POST /api/auth/admin-login
 * Usado na tela de login do Admin. A conta precisa já existir com role = 'admin'
 * (criada uma única vez via /setup-admin).
 */
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Essa conta não tem permissão de administrador.' });
    }
    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno ao processar login.' });
  }
});

/**
 * POST /api/auth/setup-admin
 * Cria a ÚNICA conta de administrador do site. Protegida por um código secreto
 * (variável de ambiente ADMIN_SETUP_CODE) e bloqueada automaticamente depois
 * que a primeira conta admin é criada — não importa quantas vezes alguém tente
 * de novo, mesmo sabendo o código.
 */
router.post('/setup-admin', async (req, res) => {
  try {
    const { name, email, password, setupCode } = req.body || {};
    if (!setupCode || setupCode !== process.env.ADMIN_SETUP_CODE) {
      return res.status(403).json({ error: 'Código de configuração inválido.' });
    }

    const existingAdmin = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (existingAdmin.rows.length > 0) {
      return res.status(403).json({ error: 'Já existe uma conta de administrador criada.' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [String(name).trim(), normalizedEmail, passwordHash, 'admin']
    );
    const user = inserted.rows[0];
    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro interno ao criar conta de administrador.' });
  }
});

/**
 * GET /api/auth/me
 * Confirma se o token salvo no navegador ainda é válido, e devolve os dados
 * atuais do usuário. Usado pra manter a pessoa logada entre visitas.
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    return res.json({ user: publicUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
