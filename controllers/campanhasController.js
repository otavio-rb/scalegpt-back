const axios = require('axios');
const Usuario = require('../models/Usuario');
require('dotenv').config();
const { updateCampaignStatusSchema } = require('../validators/validationSchemas');
const Campanha = require('../models/Campanha'); 

let accessToken = process.env.ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;

async function obterCampanhas(req, res) {
  try {
    const { status, search, page = 1, limit = 10 } = req.body;
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;

    const campanhas = await Promise.all(
      contasVinculadas.map(async (contaId) => {
        const campanhasPorConta = await obterCampanhasPorConta(contaId, status, search, page, limit);
        return campanhasPorConta;
      })
    );

    const campanhasFlat = campanhas.flat();
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const campanhasPaginadas = campanhasFlat.slice(startIndex, endIndex);
    console.log(campanhasPaginadas[0])

    res.json({
      total: campanhasPaginadas[0].total,
      campanhas: campanhasPaginadas[0].data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao obter as campanhas.' });
  }
}

async function obterCampanhasPorConta(accountId, status, search, page, limit) {
  const params = {
    accountId: accountId,
    adCategory: 1,
    status: status ? parseInt(status) : null,
    campaignIdList: search ? [parseInt(search)] : null,
    pageNo: page,
    pageSize: limit,
  };

  console.log(params);
  
  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/campaign/dspCampaignPageQueryPerformance',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );
    if (response.data.status === 200) {
      const campanhas = response.data.data;
      return campanhas;
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
        return obterCampanhasPorConta(accountId, status, search, page, limit);
      } else {
        throw new Error(`Erro ao obter campanhas da conta Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao obter campanhas da conta Kwai Ads.');
  }
}

async function deletarCampanha(req, res) {
  try {
    const { campaignId } = req.body;
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;

    const deletarPromises = contasVinculadas.map(async (contaId) => {
      await deletarCampanhaPorConta(contaId, campaignId);
    });

    await Promise.all(deletarPromises);

    res.json({ message: 'Campanha deletada com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao deletar a campanha.' });
  }
}

async function deletarCampanhaPorConta(accountId, campaignId) {
  const params = {
    accountId: accountId,
    campaignIdList: [parseInt(campaignId)],
  };

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/campaign/dspCampaignDeletePerformance',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status === 200) {
      return;
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
        return deletarCampanhaPorConta(accountId, campaignId);
      } else {
        throw new Error(`Erro ao deletar campanha da conta Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao deletar campanha da conta Kwai Ads.');
  }
}

async function atualizarStatusCampanha(req, res, next) {
  try {
    const { error } = updateCampaignStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { openStatus, campaignId } = req.body;
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;

    const atualizarStatusPromises = contasVinculadas.map(contaId => {
      return atualizarStatusCampanhaPorConta(contaId, campaignId, openStatus);
    });

    await Promise.all(atualizarStatusPromises);

    res.json({ message: 'Status da campanha atualizado com sucesso.' });
  } catch (error) {
    next(error);
  }
}

async function atualizarStatusCampanhaPorConta(accountId, campaignId, openStatus) {
  const params = {
    accountId: accountId,
    campaignIdList: [parseInt(campaignId)],
    openStatus: openStatus,
  };
  console.log(params)

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/campaign/dspCampaignUpdateOpenStatusPerformance',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status === 200) {
      return;
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
        return atualizarStatusCampanhaPorConta(accountId, campaignId, openStatus);
      } else {
        throw response.data.message;
      }
    }
  } catch (error) {
    throw new Error(error);
  }
}

async function duplicarCampanhaPorConta(req, res, next) {
  try {
    const {
      accountId,
      adCategory,
      campaignType,
      marketingType,
      deliveryStrategy,
      budgetType,
      dayBudget,
      budgetSchedule,
      campaignName
    } = req.body;

    // Cria um objeto com os dados recebidos para validação
    const novaCampanhaData = {
      accountId,
      adCategory,
      campaignType,
      marketingType,
      deliveryStrategy,
      budgetType,
      dayBudget,
      budgetSchedule,
      campaignName
    };

    // Validar os dados usando o esquema Joi do modelo Campanha
    const { error } = Campanha.joiSchema.validate(novaCampanhaData);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    console.log(novaCampanhaData)
    const novaCampanha = {
      accountId: accountId,
      campaignAddModelList: [
        {
          adCategory: adCategory,
          campaignType: campaignType,
          marketingType: marketingType,
          deliveryStrategy: deliveryStrategy,
          budgetType: budgetType,
          dayBudget: dayBudget,
          budgetSchedule: budgetSchedule,
          campaignName: campaignName
        }
      ],
    };

    // Enviar requisição para criar a nova campanha
    const response = await axios.post('https://developers.kwai.com/rest/n/mapi/campaign/dspCampaignAddPerformance', novaCampanha, {
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (response.data.status === 200) {
      res.json({ message: 'Campanha duplicada com sucesso.', data: response.data });
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
        return duplicarCampanhaPorConta(req, res, next);
      } else {
        throw new Error(`Erro ao duplicar campanha: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    next(error);
  }
}

async function atualizarAccessToken() {
  try {
    const response = await axios.get(
      `https://developers.kwai.com/oauth/token?grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${secretKey}`,
    );

    if (response.data) {
      accessToken = response.data.access_token;
    } else {
      throw new Error(`Erro ao atualizar o token de acesso`);
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao atualizar o token de acesso.');
  }
}

module.exports = {
  obterCampanhas,
  deletarCampanha,
  atualizarStatusCampanha,
  duplicarCampanhaPorConta
};