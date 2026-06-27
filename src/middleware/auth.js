const jwt = require('jsonwebtoken');

// Exige um token válido no cabeçalho "Authorization: Bearer <token>".
// Se válido, disponibiliza os dados do usuário em req.user para as próximas funções.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente. Faça login novamente.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}

// Usar depois de requireAuth, em rotas que só o administrador pode acessar.
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
