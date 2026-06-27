const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function reportShape(row, comments) {
  return {
    id: row.id,
    time: row.created_at,
    macro: row.macro,
    tecnica: row.tecnica,
    resumo: row.resumo,
    image: row.image,
    likeCount: row.like_count,
    evaluation: row.eval_rating != null || row.eval_text
      ? { rating: row.eval_rating, text: row.eval_text, time: row.eval_time }
      : null,
    comments: (comments || []).map(commentShape)
  };
}

function commentShape(row) {
  return {
    id: row.id,
    author: row.author,
    text: row.text,
    time: row.created_at,
    reply: row.reply_text ? { text: row.reply_text, time: row.reply_time } : null
  };
}

/**
 * GET /api/market/reports
 * Público — alimenta o feed em "Análise de Mercado". Mais novo primeiro.
 */
router.get('/reports', async (req, res) => {
  try {
    const reportsResult = await pool.query('SELECT * FROM market_reports ORDER BY created_at DESC');
    const reportIds = reportsResult.rows.map(r => r.id);

    let commentsByReport = {};
    if (reportIds.length > 0) {
      const commentsResult = await pool.query(
        'SELECT * FROM market_comments WHERE report_id = ANY($1) ORDER BY created_at ASC',
        [reportIds]
      );
      commentsByReport = commentsResult.rows.reduce((acc, c) => {
        (acc[c.report_id] = acc[c.report_id] || []).push(c);
        return acc;
      }, {});
    }

    const reports = reportsResult.rows.map(r => reportShape(r, commentsByReport[r.id]));
    res.json({ reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar os relatórios.' });
  }
});

/**
 * POST /api/market/reports
 * Só admin. Publica um relatório novo — recusa se for idêntico a um já existente
 * (mesma checagem que já existia no painel, agora também garantida no servidor).
 */
router.post('/reports', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { macro, tecnica, resumo, image } = req.body || {};
    if (!macro && !tecnica && !resumo) {
      return res.status(400).json({ error: 'Preencha pelo menos uma pergunta antes de publicar.' });
    }

    const dup = await pool.query(
      `SELECT id FROM market_reports
       WHERE macro IS NOT DISTINCT FROM $1
         AND tecnica IS NOT DISTINCT FROM $2
         AND resumo IS NOT DISTINCT FROM $3
         AND image IS NOT DISTINCT FROM $4
       LIMIT 1`,
      [macro || null, tecnica || null, resumo || null, image || null]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'Esse relatório é idêntico a um já publicado. Altere o conteúdo antes de publicar.' });
    }

    const inserted = await pool.query(
      'INSERT INTO market_reports (macro, tecnica, resumo, image) VALUES ($1,$2,$3,$4) RETURNING *',
      [macro || null, tecnica || null, resumo || null, image || null]
    );
    res.status(201).json({ report: reportShape(inserted.rows[0], []) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao publicar o relatório.' });
  }
});

/**
 * PUT /api/market/reports/:id
 * Só admin. Edita o conteúdo de um relatório já publicado (sem mudar a posição/data).
 */
router.put('/reports/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { macro, tecnica, resumo, image } = req.body || {};
    const updated = await pool.query(
      `UPDATE market_reports SET macro=$1, tecnica=$2, resumo=$3, image=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [macro || null, tecnica || null, resumo || null, image || null, req.params.id]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Relatório não encontrado.' });

    const commentsResult = await pool.query(
      'SELECT * FROM market_comments WHERE report_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ report: reportShape(updated.rows[0], commentsResult.rows) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar o relatório.' });
  }
});

/**
 * DELETE /api/market/reports/:id
 * Só admin. Exclui o relatório (e seus comentários, em cascata).
 */
router.delete('/reports/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM market_reports WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir o relatório.' });
  }
});

/**
 * POST /api/market/reports/:id/evaluation
 * Só admin. Publica/atualiza a avaliação de um relatório específico.
 */
router.post('/reports/:id/evaluation', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rating, text } = req.body || {};
    const updated = await pool.query(
      `UPDATE market_reports SET eval_rating=$1, eval_text=$2, eval_time=NOW(), updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [rating || null, text || null, req.params.id]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Relatório não encontrado.' });
    res.json({ report: reportShape(updated.rows[0], []) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao publicar a avaliação.' });
  }
});

/**
 * POST /api/market/reports/:id/like
 * POST /api/market/reports/:id/unlike
 * Públicos, sem login (decisão do produto) — só sobe/desce o contador.
 */
router.post('/reports/:id/like', async (req, res) => {
  try {
    const updated = await pool.query(
      'UPDATE market_reports SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count',
      [req.params.id]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Relatório não encontrado.' });
    res.json({ likeCount: updated.rows[0].like_count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao curtir o relatório.' });
  }
});

router.post('/reports/:id/unlike', async (req, res) => {
  try {
    const updated = await pool.query(
      'UPDATE market_reports SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1 RETURNING like_count',
      [req.params.id]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Relatório não encontrado.' });
    res.json({ likeCount: updated.rows[0].like_count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover a curtida.' });
  }
});

/**
 * POST /api/market/reports/:id/comments
 * Público, sem login (decisão do produto) — só nome e texto.
 */
router.post('/reports/:id/comments', async (req, res) => {
  try {
    const author = (req.body && req.body.author ? String(req.body.author).trim() : '') || 'Visitante';
    const text = req.body && req.body.text ? String(req.body.text).trim() : '';
    if (!text) return res.status(400).json({ error: 'Escreva um comentário antes de publicar.' });

    const inserted = await pool.query(
      'INSERT INTO market_comments (report_id, author, text) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, author, text]
    );
    res.status(201).json({ comment: commentShape(inserted.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao publicar o comentário.' });
  }
});

/**
 * POST /api/market/comments/:commentId/reply
 * Só admin. Responde a um comentário como "Analista".
 */
router.post('/comments/:commentId/reply', requireAuth, requireAdmin, async (req, res) => {
  try {
    const text = req.body && req.body.text ? String(req.body.text).trim() : '';
    if (!text) return res.status(400).json({ error: 'Escreva uma resposta antes de publicar.' });

    const updated = await pool.query(
      'UPDATE market_comments SET reply_text=$1, reply_time=NOW() WHERE id=$2 RETURNING *',
      [text, req.params.commentId]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Comentário não encontrado.' });
    res.json({ comment: commentShape(updated.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao publicar a resposta.' });
  }
});

/**
 * DELETE /api/market/comments/:commentId
 * Só admin. Exclui um comentário de visitante (e a resposta dele, se houver).
 */
router.delete('/comments/:commentId', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM market_comments WHERE id = $1', [req.params.commentId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir o comentário.' });
  }
});

module.exports = router;
