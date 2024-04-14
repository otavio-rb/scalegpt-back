const jwt = require('jsonwebtoken');
const Usuario = require('./models/Usuario');

const mongoose = require('mongoose');

async function authMiddleware(req, res, next) {
  const token = req.header('Access-Token');
  if (!token) {
    return res.status(401).send('Acesso negado. Token não encontrado.');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded._id;
    const usuario = await Usuario.findById(userId); 
    if (!usuario) {
      return res.status(401).send('Acesso negado. Usuário não encontrado.');
    }

    req.user = usuario;
    next();
  } catch (error) {
    return res.status(400).send('Token inválido.');
  }
}

module.exports = authMiddleware;