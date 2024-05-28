const mongoose = require('mongoose');
const Joi = require('joi');

const automacaoSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 255,
  },
  conta: {
    type: Number,
    ref: 'ContaKwaiAds',
    required: true,
  },
  campanhaId: {
    type: Number,
    required: true,
  },
  evento: {
    type: String,
    required: true,
  },
  condicao: {
    type: String,
    required: true,
  },
  valor: {
    type: Number,
    required: true,
  },
  acao: {
    tipo: {
      type: String,
      required: true,
    },
    valor: {
      type: Number,
      required: true,
    },
  },
  proximaExecucao: {
    type: Date,
    default: null,
  },
  executada: {
    type: Boolean,
    default: false,
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario', 
    required: true
  },
  
});

automacaoSchema.statics.joiSchema = Joi.object({
  titulo: Joi.string().required().min(3).max(255).messages({
    'string.empty': 'O título da automação é obrigatório.',
    'string.min': 'O título da automação deve ter pelo menos 3 caracteres.',
    'string.max': 'O título da automação deve ter no máximo 255 caracteres.',
  }),
  conta: Joi.string().required().messages({
    'string.empty': 'A conta Kwai Ads é obrigatória.',
    'string.pattern.base': 'A conta deve ser um ObjectId válido.'
  }),
  campanhaId: Joi.number().required().messages({
    'number.base': 'O id da campanha é obrigatório',
  }),
  evento: Joi.string().required().messages({
    'string.empty': 'O evento é obrigatório.',
  }),
  condicao: Joi.string().required().messages({
    'string.empty': 'A condição é obrigatória.',
  }),
  valor: Joi.number().required().messages({
    'number.base': 'O valor é obrigatório.',
  }),
  acao: Joi.object({
    tipo: Joi.string().required().messages({
      'string.empty': 'O tipo de ação é obrigatório.',
    }),
    valor: Joi.number().required().messages({
      'number.base': 'O valor da ação é obrigatório.',
    }),
  }),
});

automacaoSchema.index({ proximaExecucao: 1, executada: 1 });

const Automacao = mongoose.model('Automacao', automacaoSchema);

module.exports = Automacao;