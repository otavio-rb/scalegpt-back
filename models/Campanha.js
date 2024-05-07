const mongoose = require('mongoose');
const Joi = require('joi');

const campaignSchema = new mongoose.Schema({
  accountId: {
    type: Number,
    required: true,
  },
  adCategory: {
    type: Number,
    required: true,
  },
  campaignType: {
    type: Number,
    required: true,
  },
  marketingType: {
    type: Number,
    required: true,
  },
  deliveryStrategy: {
    type: Number,
    required: true,
  },
  budgetType: {
    type: Number,
    required: true,
  },
  dayBudget: {
    type: Number,
    default: 0,
  },
  budgetSchedule: {
    type: [Number],
    default: [],
  },
  campaignName: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 255,
  },
  campaignId: {
    type: Number,
    required: false,
  }
});

campaignSchema.statics.joiSchema = Joi.object({
  accountId: Joi.number().required().messages({
    'number.base': 'AccountId deve ser um número.',
    'any.required': 'AccountId é obrigatório.'
  }),
  adCategory: Joi.number().required().messages({
    'number.base': 'AdCategory deve ser um número.',
    'any.required': 'AdCategory é obrigatório.'
  }),
  campaignType: Joi.number().required().messages({
    'number.base': 'CampaignType deve ser um número.',
    'any.required': 'CampaignType é obrigatório.'
  }),
  marketingType: Joi.number().required().messages({
    'number.base': 'MarketingType deve ser um número.',
    'any.required': 'MarketingType é obrigatório.'
  }),
  deliveryStrategy: Joi.number().required().messages({
    'number.base': 'DeliveryStrategy deve ser um número.',
    'any.required': 'DeliveryStrategy é obrigatório.'
  }),
  budgetType: Joi.number().required().messages({
    'number.base': 'BudgetType deve ser um número.',
    'any.required': 'BudgetType é obrigatório.'
  }),
  dayBudget: Joi.number().min(0).messages({
    'number.base': 'DayBudget deve ser um número.',
    'number.min': 'DayBudget não pode ser negativo.'
  }),
  budgetSchedule: Joi.array().items(Joi.number()).messages({
    'array.base': 'BudgetSchedule deve ser um array de números.'
  }),
  campaignName: Joi.string().required().min(3).max(255).messages({
    'string.base': 'CampaignName deve ser um texto.',
    'string.empty': 'CampaignName é obrigatório.',
    'string.min': 'CampaignName deve ter pelo menos 3 caracteres.',
    'string.max': 'CampaignName deve ter no máximo 255 caracteres.'
  }),
});

const Campanha = mongoose.model('Campanha', campaignSchema);

module.exports = Campanha;
