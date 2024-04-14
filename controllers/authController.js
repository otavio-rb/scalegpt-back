const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { sanitizeInput } = require('../utils')

async function login(req, res) {
  console.log(process.env.MONGODB_URI)
  const loginSchema = Joi.object({
    email: Usuario.joiSchema.extract('email'),
    senha: Usuario.joiSchema.extract('senha'),
  });

  const { error } = loginSchema.validate(req.body);
  if (error) return res.status(400).send({
    message: error.details[0].message
  });

  const usuario = await Usuario.findOne({ email: req.body.email });
  if (!usuario) return res.status(400).send({
    message: 'Não foi encontrado um usuário com o email informado.'
  });

  const senhaValida = await bcrypt.compare(req.body.senha, usuario.senha);
  if (!senhaValida) return res.status(400).send({
    message: 'A senha inserida é inválida.'
  });

  const token = jwt.sign({ _id: usuario._id }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });

  res.status(200).send({
    token,
    usuario: {
      _id: usuario._id,
      nome: usuario.nome,
      email: usuario.email,
      is_admin: usuario.is_admin,
    }
  });
}


async function cadastrarUsuario(req, res) {
  req.body = sanitizeInput(req.body);
  const { error } = Usuario.joiSchema.validate(req.body);
  if (error) return res.status(400).send({
    message: error.details[0].message
  });

  let usuario = await Usuario.findOne({ email: req.body.email });
  if (usuario) return res.status(400).send({
    message: 'Já existe um usuário cadastrado com esse email'
  });

  usuario = new Usuario({
    nome: req.body.nome,
    email: req.body.email,
    senha: req.body.senha,
    is_admin: req.body.is_admin || false,
  });

  const salt = await bcrypt.genSalt(10);
  usuario.senha = await bcrypt.hash(usuario.senha, salt);

  await usuario.save();

  res.status(200).send({
    usuario
  });
}

async function me(req, res) {
  try {
      const usuario = await Usuario.findById(req.user._id);
      if (!usuario) {
          return res.status(404).send({ message: 'Usuário não encontrado.' });
      }

      res.send(usuario);
  } catch (error) {
      res.status(500).send({ message: 'Erro ao buscar os dados do usuário.' });
  }
}

module.exports = {
    login,
    cadastrarUsuario,
    me
};