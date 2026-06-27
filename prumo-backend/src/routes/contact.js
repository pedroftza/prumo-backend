const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/contact
 * Público. Salva a mensagem do formulário de contato (área Sobre).
 */
router.post('/', async (req, res) => {
  try {
    const name = req.body && req.body.name ? String(req.body.name).trim() : '';
    const email = req.body && req.body.email ? String(req.body.email).trim() : '';
    const message = req.body && req.body.message ? String(req.body.message).trim() : '';

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Preencha nome, e-mail e mensagem antes de enviar.' });
    }

    await pool.query(
      'INSERT INTO contact_messages (name, email, message) VALUES ($1,$2,$3)',
      [name, email, message]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao enviar a mensagem.' });
  }
});

/**
 * GET /api/contact
 * Só admin. Lista todas as mensagens recebidas, mais recente primeiro.
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.json({
      messages: result.rows.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        message: r.message,
        read: r.is_read,
        time: r.created_at
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar as mensagens.' });
  }
});

/**
 * PATCH /api/contact/:id/read
 * Só admin. Marca uma mensagem como lida.
 */
router.patch('/:id/read', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE contact_messages SET is_read = TRUE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao marcar a mensagem como lida.' });
  }
});

module.exports = router;
