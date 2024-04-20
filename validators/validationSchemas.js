const Joi = require('joi');

const updateCampaignStatusSchema = Joi.object({
    openStatus: Joi.number().valid(1, 2).required() // Aqui você pode adicionar mais números se necessário
        .messages({
            'number.base': 'O status deve ser um número.',
            'any.only': 'O status deve ser 1 (ligado) ou 2 (desligado).',
            'any.required': 'O status é obrigatório.'
        }),
    campaignId: Joi.number().required().messages({
        'number.base': 'O ID da campanha deve ser um número.',
        'any.required': 'O ID da campanha é obrigatório.'
    }),
});

const updateCreativeStatusSchema = Joi.object({
    openStatus: Joi.number().valid(1, 2).required() // Aqui você pode adicionar mais números se necessário
        .messages({
            'number.base': 'O status deve ser um número.',
            'any.only': 'O status deve ser 1 (ligado) ou 2 (desligado).',
            'any.required': 'O status é obrigatório.'
        }),
    creativeId: Joi.number().required().messages({
        'number.base': 'O ID da anúncio deve ser um número.',
        'any.required': 'O ID da anúncio é obrigatório.'
    }),
});

module.exports = {
    updateCampaignStatusSchema,
    updateCreativeStatusSchema
};