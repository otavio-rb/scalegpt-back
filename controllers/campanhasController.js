const axios = require('axios');
const Usuario = require('../models/Usuario');
require('dotenv').config();
const { updateCampaignStatusSchema } = require('../validators/validationSchemas');
const Campanha = require('../models/Campanha');
const { default: mongoose } = require('mongoose');

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

async function obterCampanhas(req, res, next) {
  const userId = req.user._id;
  const { contaId, granularity, timeZoneIana, pageNo, pageSize } = req.body;
  const timestampBegin = toTimestampBR(req.body.dataBeginTime);
  const timestampEnd = toTimestampBR(req.body.dataEndTime);
  const status = req.body?.status;
  const search = req.body?.search;

  const usuario = await Usuario.findById(userId);
  if (!usuario.contasVinculadas || usuario.contasVinculadas.length === 0) {
    return res.status(400).json({ error: 'Usuário não possui contas vinculadas' });
  }

  if (!usuario.contasVinculadas.includes(contaId)) {
    return res.status(403).json({ error: 'Conta não vinculada ao usuário' });
  }

  try {
    const response = await obterDadosCompletosCampanhas(contaId, timestampBegin, timestampEnd, granularity, timeZoneIana, pageNo, pageSize, search, status);
    res.json(response);
  } catch (error) {
    next(error)
  }
}

async function obterCampanhasPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, search, status) {
  const adCategory = 1;

  try {
    const params = {
      adCategory,
      granularity,
      dataBeginTime,
      dataEndTime,
      timeZoneIana,
      accountId,
      campaignIdList: search ? [parseInt(search)] : null,
      corpId,
      pageNo,
      pageSize
    };

    if (status !== undefined && status !== null && status !== '') {
      params.status = status;
    }

    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/campaign/dspCampaignPageQueryPerformance',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        timeout: 10000 // 10 segundos de timeout
      }
    );

    if (response.data.status === 200) {
      return {"campaigns": response.data.data.data, "total": response.data.data.total};
    } else if (response.data.status === 401) {
      await atualizarAccessToken();
      return obterCampanhasPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, search, status);
    } else {
      throw error;
    }

  } catch (error) {
    console.error(error);
    throw new Error(`Erro ao obter campanhas: ${error}`);
  }
}

async function saveCampanhas(campanhasValidas) {
  if (!campanhasValidas.length) {
    console.log('Nenhuma campanha válida para inserir.');
    return; // Sai da função se não há campanhas válidas
  }

  try {
    const db = mongoose.connection;
    
    // Dropa a coleção existente
    console.log('Dropando a coleção de campanhas...');
    await db.dropCollection('campaign_all');

    // Preparando dados para inserção, assumindo que a `campaign.deliveryStrategy` para `budgetType` já é ajustada
    const campaignsToInsert = campanhasValidas.map(campaign => {
      return {
        ...campaign,
        budgetType: campaign.deliveryStrategy
      };
    });

    // Inserção em lote das campanhas
    console.log('Inserindo novas campanhas na coleção campaign_all...');
    await db.collection('campaign_all').insertMany(campaignsToInsert);
    console.log('Campanhas inseridas com sucesso na coleção campaign_all.');
  } catch (error) {
    console.error('Erro ao salvar campanhas:', error);
    // Verifica se a coleção existe antes de tentar dropar, se não existir, cria
    if (error.message.includes('ns not found')) {
      await db.createCollection('campaign_all');
      console.log('Coleção campaign_all criada, tente inserir novamente.');
    } else {
      throw error;
    }
  }
}


async function obterMetricasCampanha(params) {
  params.pageSize = 100;
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

    if (response.data.status === 200 && response.data.data.total > 0) {
      return response;
    } else if (response.data.status === 401) {
      await atualizarAccessToken();
      return obterMetricasCampanha(params);
    } else {
      return [];
    }
  } catch (error) {
    console.error('Erro ao obter as metricas da campanha', error);
    console.log("data", params)
    throw new Error(`Erro ao obter as metricas da campanha: ${error}`);
  }
}

async function obterDadosCompletosCampanhas(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, search, status) {
  try {
    console.log('Início da função obterDadosCompletosCampanhas');
    console.log('Obtendo campanhas por data');
    const campanhas = await obterCampanhasPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, search, status);
    console.log('campanhas obtidas:', campanhas.length);
    const params = {
      "adCategory": 1,
      "granularity": granularity,
      "dataBeginTime": dataBeginTime,
      "dataEndTime": dataEndTime,
      "timeZoneIana": timeZoneIana,
      "adCategory": 1,
      "pageNo": pageNo,
      "pageSize": pageSize
    };
    const metricasResultados = await obterMetricasCampanha(params);
    console.log('Métricas processadas para todas as campanhas');
    const dadosCompletos = campanhas.campaigns.map(campaign => {
      const metricas = metricasResultados.find(m => m && m.campaignId === campaign.campaignId) || metricasPadrao;
      return { ...campaign, ...metricas };
    });

    return {
      totalItems: campanhas.total,
      currentPage: pageNo,
      totalPages: Math.ceil(campanhas.total / pageSize),
      data: dadosCompletos,
    };
    await saveCampanhas(dadosCompletos);
    return getCampaigns(pageNo, pageSize);
  } catch (error) {
    console.error('Erro ao obter dados completos das campanhas', error);
    throw error;
  }
}

async function campaignSearch(search, pageNo = 1, pageSize = 10, status = 1) {
  try {
    const db = mongoose.connection;
    const collection = db.collection('campaign_all');

    // Construa uma consulta básica sem usar índices de texto
    // Utiliza uma expressão regular para fazer uma busca 'contém' no campo 'campaignName'
    const query = {
      campaignName: { $regex: search, $options: 'i' }, // '$options: 'i'' para busca case-insensitive
      status: status // Assume que status é um campo numérico
    };

    const totalItems = await collection.countDocuments(query);
    const skip = (pageNo - 1) * pageSize;
    const campaigns = await collection.find(query)
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return {
      totalItems,
      currentPage: pageNo,
      totalPages: Math.ceil(totalItems / pageSize),
      campaigns
    };
  } catch (error) {
      console.log|(error)
      throw error;
  }
}

async function getCampaigns(pageNo = 1, pageSize = 10) {
  try {
    const db = mongoose.connection;
    const collection = db.collection('campaign_all');
    const totalItems = await collection.countDocuments();
    const skip = (pageNo - 1) * pageSize;
    const campaigns = await collection.find({})
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return {
      totalItems,
      currentPage: pageNo,
      totalPages: Math.ceil(totalItems / pageSize),
      campaigns
    };
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error);
    throw error;
  }
}

function toTimestampBR(dateInput) {
  let dateStr = dateInput;

  // Verifica se dateInput é um número (timestamp), então converte para string de data
  if (typeof dateInput === 'number') {
    const date = new Date(dateInput);
    // Converte a data para o formato "dd/mm/yyyy hh:mm:ss"
    const day = `0${date.getDate()}`.slice(-2);
    const month = `0${date.getMonth() + 1}`.slice(-2); // Janeiro é 0!
    const year = date.getFullYear();
    const hours = `0${date.getHours()}`.slice(-2);
    const minutes = `0${date.getMinutes()}`.slice(-2);
    const seconds = `0${date.getSeconds()}`.slice(-2);
    dateStr = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }

  // Assume que dateStr está agora no formato "dd/mm/yyyy hh:mm:ss"
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

const metricasPadrao = {
  time: 0,
  accountName: "",
  convertedTaxId: 0,
  id: 0,
  countryCode: 0,
  clientId: 0,
  buyingType: "",
  biddingType: "",
  cost: 0,
  exposure: 0,
  click: 0,
  ctr: 0,
  cpm: 0,
  cpc: 0,
  action: 0,
  cvr: 0,
  cpa: 0,
  play3s: 0,
  play5s: 0,
  playFinished: 0,
  activation: 0,
  costPerActivation: 0,
  activationRate: 0,
  appLaunch: 0,
  costPerAppLaunch: 0,
  appLaunchRate: 0,
  pageView: 0,
  costPerPageView: 0,
  pageViewRate: 0,
  registration: 0,
  costPerRegistration: 0,
  registrationRate: 0,
  addToCar: 0,
  addToCart: 0,
  costPerAddToCart: 0,
  addToCartRate: 0,
  play3sRate: 0,
  costPerformancePlay3s: 0,
  play5sRate: 0,
  costPerformancePlay5s: 0,
  photoThruPlayCnt: 0,
  costPhotoThruPlay: 0,
  photoThruPlayRate: 0,
  photo25percentPlayCnt: 0,
  costPhoto25percentPlay: 0,
  photo25percentPlayRate: 0,
  photo50percentPlayCnt: 0,
  costPhoto50percentPlay: 0,
  photo50percentPlayRate: 0,
  photo75percentPlayCnt: 0,
  costPhoto75percentPlay: 0,
  photo75percentPlayRate: 0,
  photoAvgPlayTime: 0,
  purchase: 0,
  purchaseRate: 0,
  costPurchase: 0,
  uniquePurchase: 0,
  costUniquePurchase: 0,
  totalDayOneRetention: 0,
  costPerDayOneRetention: 0,
  dayOneRetentionRate: 0,
  totalDayOneRetentionPlatformAttribution: 0,
  costPerDayOneRetentionPlatformAttribution: 0,
  dayOneRetentionRatePlatformAttribution: 0,
  keyInAppAction: 0,
  costKeyInAppAction: 0,
  uniqueKeyInAppAction: 0,
  costUniqueKeyInAppAction: 0,
  firstAdViewCnt: 0,
  costFirstAdView: 0,
  firstAdViewRate: 0,
  firstAdClickCnt: 0,
  costFirstAdClick: 0,
  firstAdClickRate: 0,
  adView: 0,
  costAdView: 0,
  adViewRate: 0,
  adClick: 0,
  costAdClick: 0,
  adClickRate: 0,
  uniquePageView: 0,
  costUniquePageView: 0,
  firstPageViewRate: 0,
  uniqueAppLaunch: 0,
  costUniqueAppLaunch: 0,
  firstReengageRate: 0,
  brandExposure: 0,
  brandClick: 0,
  brandPlayFinished: 0,
  brandJumpClick: 0,
  brandPlay3sCnt: 0,
  brandPlay5sCnt: 0
};

module.exports = {
  obterCampanhas,
  deletarCampanha,
  atualizarStatusCampanha,
  duplicarCampanha
};