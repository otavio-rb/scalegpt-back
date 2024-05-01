const axios = require('axios');
const Usuario = require('../models/Usuario');
require('dotenv').config();
const { updateCampaignStatusSchema } = require('../validators/validationSchemas');
const Campanha = require('../models/Campanha');

let accessToken = process.env.ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const corpId = process.env.CORP_ID;

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

async function obterCampanhaPorId(accountId, campaignId) {
  const params = {
    accountId: accountId,
    adCategory: 1,
    campaignIdList: [campaignId],
    status: 1, // Assume que queremos campanhas ativas
    pageNo: 1,
    pageSize: 1 // Apenas uma campanha, já que conhecemos o ID
  };

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

    if (response.data.status === 200 && response.data.data.total > 0) {
      return response.data.data.data[0];
    } else if (response.data.status === 401) {
      await atualizarAccessToken();
      return obterCampanhaPorId(accountId, campaignId);
    } else {
      throw new Error(`Erro ao obter campanha por ID: ${response.data.message}`);
    }
  } catch (error) {
    console.error('Erro ao obter campanha por ID', error);
    throw error;
  }
}

async function duplicarCampanha(req, res) {
  const { campaignId, accountId, quantidade } = req.body;
  const campanhaOriginal = await obterCampanhaPorId(accountId, campaignId);

  let novasCampanhas = [];

  for (let i = 0; i < quantidade; i++) {
    const novaCampanha = {
      adCategory: campanhaOriginal.adCategory,
      campaignType: campanhaOriginal.campaignType,
      marketingType: campanhaOriginal.marketingType,
      deliveryStrategy: campanhaOriginal.deliveryStrategy,
      budgetType: campanhaOriginal.dayBudget > 0 ? 2 : (campanhaOriginal.budgetSchedule.length > 0 ? 3 : 1),
      dayBudget: campanhaOriginal.dayBudget,
      campaignName: `${campanhaOriginal.campaignName} (Duplicado ${i + 1})`,
      cboAuthorized: campanhaOriginal.deliveryStrategy === 3 ? campanhaOriginal.budgetOptimization : undefined // CBO autorizado apenas se for Lowest Cost
    };

    if (campanhaOriginal.budgetSchedule.length > 0) {
      novaCampanha.budgetSchedule = campanhaOriginal.budgetSchedule;
    }

    // Verifica se dayBudget e budgetSchedule estão de acordo com o budgetType
    if (novaCampanha.budgetType === 2 && !novaCampanha.dayBudget) {
      novaCampanha.dayBudget = 1000000; // Valor mínimo teórico para budget diário
    }

    novasCampanhas.push(novaCampanha);
  }

  const params = {
    accountId: accountId,
    campaignAddModelList: novasCampanhas,
  };

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/campaign/dspCampaignAddPerformance',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status === 200) {
      res.json(response.data);
    } else if (response.data.status === 401) {
      await atualizarAccessToken();
      return duplicarCampanha(req, res);
    } else {
      throw new Error(`Erro ao duplicar campanha: ${response.data.message}`);
    }
  } catch (error) {
    console.error('Erro ao duplicar campanha', error);
    res.status(500).send('Erro ao duplicar campanha');
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

async function obterCampanhas(req, res) {
  const userId = req.user._id;
  const { contaId, granularity, dataBeginTime, dataEndTime, timeZoneIana, pageNo, pageSize } = req.body;
  const timestampBegin = toTimestampBR(req.body.dataBeginTime);
  const timestampEnd = toTimestampBR(req.body.dataEndTime);

  const usuario = await Usuario.findById(userId);
  if (!usuario.contasVinculadas || usuario.contasVinculadas.length === 0) {
    return res.status(400).json({ error: 'Usuário não possui contas vinculadas' });
  }

  if (!usuario.contasVinculadas.includes(contaId)) {
    return res.status(403).json({ error: 'Conta não vinculada ao usuário' });
  }

  try {
    const response = await obterCampanhasPorData(contaId, timestampBegin, timestampEnd, granularity, timeZoneIana, pageNo, pageSize);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function obterCampanhasPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize) {
  const params = {
    granularity,
    dataBeginTime,
    dataEndTime,
    timeZoneIana,
    accountId,
    corpId,
    pageNo,
    pageSize
  };

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/report/dspCampaignEffectQuery',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status === 200) {
      const totalGasto = response?.data?.data;
      return totalGasto || 0;
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
        return obterCampanhasPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana);
      } else {
        throw new Error(`Erro ao obter campanhas: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao obter campanhas: ', error);
  }
}

function toTimestampBR(dateStr) {
  // Assume dateStr está no formato "dd/mm/yyyy hh:mm:ss"
  const parts = dateStr.split(' ');
  const dateParts = parts[0].split('/');
  const timeParts = parts[1].split(':');

  // Constrói um objeto Date
  // Note que o mês é 0-indexado em JavaScript, então subtraímos 1
  const date = new Date(Date.UTC(
    parseInt(dateParts[2], 10),
    parseInt(dateParts[1], 10) - 1,
    parseInt(dateParts[0], 10),
    parseInt(timeParts[0], 10),
    parseInt(timeParts[1], 10),
    parseInt(timeParts[2], 10)
  ));

  // Ajusta para o fuso horário UTC-3
  const utc3Offset = 3 * 60 * 60 * 1000; // 3 horas em milissegundos
  const timestamp = date.getTime() - utc3Offset;

  return timestamp;
}


module.exports = {
  obterCampanhas,
  deletarCampanha,
  atualizarStatusCampanha,
  duplicarCampanha
};