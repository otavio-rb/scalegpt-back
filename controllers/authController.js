const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { sanitizeInput } = require('../utils');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function login(req, res) {
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

async function resetPassword(req, res) {
  try {
    const emailSchema = Joi.object({
      email: Usuario.joiSchema.extract('email')
    });

    const { error } = emailSchema.validate(req.body);
    if (error) return res.status(400).send({
      message: error.details[0].message
    });

    const usuario = await Usuario.findOne({ email: req.body.email });
    if (!usuario) return res.status(404).send({
      message: 'Não foi encontrado um usuário com o email informado.'
    });

    // Gerar uma nova senha aleatória
    const newPassword = crypto.randomBytes(8).toString('hex');

    // Gerar um hash da nova senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Atualizar a senha do usuário
    usuario.senha = hashedPassword;
    await usuario.save();

    // Ler o conteúdo do template HTML
    const templatePath = path.join(__dirname, '../templates/reset-password.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    // Substituir o placeholder pela nova senha
    htmlContent = htmlContent.replace('{{senha}}', newPassword);

    // Configurar o transporte de email para Mailtrap
    // const transporter = nodemailer.createTransport({
    //   host: process.env.EMAIL_HOST,
    //   port: process.env.EMAIL_PORT,
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS
    //   }
    // });

    const transporter = nodemailer.createTransport({
      host: 'sandbox.smtp.mailtrap.io',
      port: 2525, // ou 25, 465, 587, escolha um dos mencionados
      auth: {
        user: 'b5b591b5376b37',
        pass: '69661474288275'
      }
    });

    // Configurar o conteúdo do email
    const mailOptions = {
      from: '"Suporte" <support@example.com>', // Ajuste o endereço de email conforme necessário
      to: usuario.email,
      subject: 'Sua senha foi resetada',
      html: htmlContent
    };

    // Enviar o email
    await transporter.sendMail(mailOptions);

    res.status(200).send({
      message: 'Senha resetada com sucesso. Verifique seu email para a nova senha.'
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: 'Erro ao resetar a senha.'
    });
  }
}

module.exports = {
    login,
    cadastrarUsuario,
    me,
    resetPassword
};