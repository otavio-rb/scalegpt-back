const mongoose = require('mongoose');
const Joi = require('joi');

const userSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 255,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    minlength: 5,
    maxlength: 255,
  },
  senha: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 1024,
  },
  is_admin: {
    type: Boolean,
    default: false
  },
  contasVinculadas: {
    type: [Number],
    default: [],
  },
  automacoes: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Automacao',
  },
  totalGastosHoje: {
    type: Number,
    default: 0
  },
  anunciosRejeitados: {
    type: Number,
    default: 0
  },
  anunciosAtivos: {
    type: Number,
    default: 0
  },
  top5campanhas: {
    type: [{
      nomeCampanha: String,
      totalInvestido: {
        type: Number,
        default: 0
      }
    }]
  },
  investimentoPorTempo: {
    type: [{
      periodo: String,
      totalInvestido: {
        type: Number,
        default: 0
      }
    }]
  },
  ultimaSincronizacao: Date
});

userSchema.statics.joiSchema = Joi.object({
  nome: Joi.string().required().min(2).max(255).messages({
    'string.empty': 'O nome é obrigatório.',
    'string.min': 'O nome deve ter pelo menos 2 caracteres.',
    'string.max': 'O nome deve ter no máximo 255 caracteres.',
  }),
  email: Joi.string().email().required().min(5).max(255).messages({
    'string.email': 'O email informado não é válido.',
    'string.empty': 'O email é obrigatório.',
    'string.min': 'O email deve ter pelo menos 5 caracteres.',
    'string.max': 'O email deve ter no máximo 255 caracteres.',
  }),
  senha: Joi.string().required().min(6).max(1024).messages({
    'string.empty': 'A senha é obrigatória.',
    'string.min': 'A senha deve ter pelo menos 6 caracteres.',
    'string.max': 'A senha deve ter no máximo 1024 caracteres.',
  }),
});

const Usuario = mongoose.model('Usuario', userSchema);

module.exports = Usuario;