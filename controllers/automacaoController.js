const Automacao = require('../models/Automacao');
const Usuario = require('../models/Usuario');
const Joi = require('joi');
const logger = require('../logger');
const mongoose = require('mongoose');

async function listarAutomacoes(req, res) {
  try {
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const contasVinculadas = usuario.contasVinculadas;
    if (!contasVinculadas || contasVinculadas.length === 0) {
      return res.status(404).json({ message: 'Não há contas vinculadas para este usuário.' });
    }

    const automacoes = await Automacao.find({
      conta: { $in: contasVinculadas }
    }); 

    console.log('automacoes', automacoes)

    res.json(automacoes);
  } catch (error) {
    logger.error('Erro ao listar automações', { error });
    res.status(400).json({ error: error });
  }
}

async function deletarAutomacao(req, res) {
  const { id } = req.params;
  const userId = req.user._id;

  // Verifica se o ID é um ObjectId válido
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ error: 'ID inválido' });
  }

  try {
    const automacao = await Automacao.findOne({ _id: id, usuario: userId });
    if (!automacao) {
      return res.status(404).json({ error: 'Automação não encontrada' });
    }

    await Automacao.deleteOne({ _id: id });
    res.json({ message: 'Automação deletada com sucesso' });
  } catch (error) {
    console.log('Erro ao deletar automação', { error });
    res.status(500).json({ error: 'Erro ao deletar automação' });
  }
}

async function criarAutomacao(req, res, next) {
  try {
    const { error } = Automacao.joiSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user._id;
    const { titulo, conta, campanhaId, evento, condicao, valor, acao, type } = req.body;

    const usuario = await Usuario.findById(userId);
    if (!usuario.contasVinculadas.includes(conta)) {
      return res.status(400).json({ error: 'Conta não vinculada ao usuário' });
    }
    
    const automacao = new Automacao({
      titulo,
      conta,
      campanhaId,
      evento,
      condicao,
      valor,
      acao,
      usuario: userId,
      type
    });

    await automacao.save();

    res.status(201).json(automacao);
  } catch (error) {
    console.log("Aquiiiii", error)
    next(error);
  }
}

module.exports = {
  listarAutomacoes,
  deletarAutomacao,
  criarAutomacao,
};