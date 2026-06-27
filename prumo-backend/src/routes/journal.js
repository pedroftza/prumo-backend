const express = require('express');
const pool = require('../db');

const router = express.Router();

// lista de colunas usada tanto no SELECT quanto no INSERT...RETURNING,
// já convertendo a data pra texto (YYYY-MM-DD) pra evitar bug de fuso horário
// que acontece quando o node-postgres devolve colunas DATE como objeto Date.
const ENTRY_COLUMNS = `
  id, user_id, to_char(entry_date, 'YYYY-MM-DD') AS entry_date, market, total_result,
  vp, renko_100r, renko_50r, vwap_note, rule3, risk_rule, disc_star,
  good, improve, intent, emotions, errors, pdf_stats, created_at, updated_at
`;

// converte uma linha do banco pro mesmo formato de objeto que o painel já usa
// (essa função existe só pra eu não precisar reescrever o código de exibição do Diário)
function toApiShape(row) {
  return {
    date: row.entry_date,
    market: row.market,
    totalResult: row.total_result !== null ? Number(row.total_result) : 0,
    vp: row.vp,
    r40: row.renko_100r,
    r20: row.renko_50r,
    vwap: row.vwap_note,
    rule3: row.rule3,
    riskRule: row.risk_rule,
    discStar: row.disc_star,
    good: row.good,
    improve: row.improve,
    intent: row.intent,
    emotions: row.emotions || [],
    errors: row.errors || [],
    pdfStats: row.pdf_stats,
    savedAt: row.updated_at ? new Date(row.updated_at).getTime() : null
  };
}

// GET /api/journal — lista todas as sessões do usuário logado
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${ENTRY_COLUMNS} FROM journal_entries WHERE user_id = $1 ORDER BY entry_date DESC`,
      [req.user.userId]
    );
    res.json({ entries: result.rows.map(toApiShape) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar as sessões.' });
  }
});

// POST /api/journal — cria a sessão de uma data, ou atualiza se já existir
// (mesma lógica de "uma sessão por dia" que o painel já tinha em memória)
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.date) return res.status(400).json({ error: 'Informe a data da sessão.' });

    const result = await pool.query(
      `INSERT INTO journal_entries
        (user_id, entry_date, market, total_result, vp, renko_100r, renko_50r, vwap_note,
         rule3, risk_rule, disc_star, good, improve, intent, emotions, errors, pdf_stats, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, NOW())
       ON CONFLICT (user_id, entry_date) DO UPDATE SET
         market = EXCLUDED.market,
         total_result = EXCLUDED.total_result,
         vp = EXCLUDED.vp,
         renko_100r = EXCLUDED.renko_100r,
         renko_50r = EXCLUDED.renko_50r,
         vwap_note = EXCLUDED.vwap_note,
         rule3 = EXCLUDED.rule3,
         risk_rule = EXCLUDED.risk_rule,
         disc_star = EXCLUDED.disc_star,
         good = EXCLUDED.good,
         improve = EXCLUDED.improve,
         intent = EXCLUDED.intent,
         emotions = EXCLUDED.emotions,
         errors = EXCLUDED.errors,
         pdf_stats = EXCLUDED.pdf_stats,
         updated_at = NOW()
       RETURNING ${ENTRY_COLUMNS}`,
      [
        req.user.userId,
        b.date,
        b.market || null,
        b.totalResult || 0,
        b.vp || null,
        b.r40 || null,
        b.r20 || null,
        b.vwap || null,
        b.rule3 || null,
        b.riskRule || null,
        b.discStar || 0,
        b.good || null,
        b.improve || null,
        b.intent || null,
        JSON.stringify(b.emotions || []),
        JSON.stringify(b.errors || []),
        b.pdfStats ? JSON.stringify(b.pdfStats) : null
      ]
    );
    res.status(201).json({ entry: toApiShape(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar a sessão.' });
  }
});

// DELETE /api/journal/:date — remove a sessão de uma data específica
router.delete('/:date', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM journal_entries WHERE user_id = $1 AND entry_date = $2',
      [req.user.userId, req.params.date]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir a sessão.' });
  }
});

module.exports = router;
