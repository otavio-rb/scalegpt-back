const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.header('Access-Token');
  if (!token) return res.status(401).send('Acesso negado. Token não encontrado.');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).send('Token inválido.');
  }
}

module.exports = authMiddleware;