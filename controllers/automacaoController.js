const Automacao = require('../models/Automacao');
const Usuario = require('../models/Usuario');
const Joi = require('joi');
const logger = require('../logger');

async function listarAutomacoes(req, res) {
  try {
    const userId = req.user._id;
    const automacoes = await Automacao.find({ usuario: userId }).populate('conta');

    res.json(automacoes);
  } catch (error) {
    logger.error('Erro ao listar automações', { error });
    res.status(500).json({ error: 'Erro ao listar automações' });
  }
}

async function deletarAutomacao(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const automacao = await Automacao.findOneAndDelete({ _id: id, usuario: userId });

    if (!automacao) {
      return res.status(404).json({ error: 'Automação não encontrada' });
    }

    res.json({ message: 'Automação deletada com sucesso' });
  } catch (error) {
    logger.error('Erro ao deletar automação', { error });
    res.status(500).json({ error: 'Erro ao deletar automação' });
  }
}

async function criarAutomacao(req, res) {
  try {
    const { error } = Automacao.joiSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user._id;
    const { titulo, conta, campanha, evento, condicao, valor, acao } = req.body;

    const usuario = await Usuario.findById(userId);
    if (!usuario.contasVinculadas.includes(conta)) {
      return res.status(400).json({ error: 'Conta não vinculada ao usuário' });
    }

    const automacao = new Automacao({
      titulo,
      conta,
      campanha,
      evento,
      condicao,
      valor,
      acao,
      usuario: userId,
    });

    await automacao.save();

    res.status(201).json(automacao);
  } catch (error) {
    logger.error('Erro ao criar automação', { error });
    res.status(500).json({ error: 'Erro ao criar automação' });
  }
}

module.exports = {
  listarAutomacoes,
  deletarAutomacao,
  criarAutomacao,
};