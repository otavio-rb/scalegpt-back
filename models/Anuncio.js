const Joi = require('joi');

const anuncioSchema = Joi.object({
    accountId: Joi.number().required(),
    creativeAddModelList: Joi.array().items(
        Joi.object({
            unitId: Joi.number().required(),
            adCategory: Joi.number().required(),
            creativeType: Joi.number().required(),
            materialType: Joi.number().required(),
            photoId: Joi.number().required(),
            subTitle: Joi.string().required(),
            desc: Joi.string().required(),
            callToAction: Joi.number().required(),
            playableId: Joi.number().required(),
            materialSourceType: Joi.number().required(),
            materialIdList: Joi.array().items(Joi.number()).required(),
            creativeName: Joi.string().required(),
            useUnitAppIconAndName: Joi.any(),
            avatarId: Joi.number().required(),
            deepLink: Joi.any()
        })
    )
});

const Anuncio = mongoose.model('Anuncio', anuncioSchema);
module.exports = Anuncio;
