const axios = require('axios');
const Usuario = require('../models/Usuario');
const { updateCreativeStatusSchema } = require('../validators/validationSchemas');
const { default: mongoose } = require('mongoose');
require('dotenv').config();

let accessToken = process.env.ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const corpId = process.env.CORP_ID;

async function obterAnuncios(req, res, next) {
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
    const response = await obterDadosCompletosAnuncio(contaId, timestampBegin, timestampEnd, granularity, timeZoneIana, pageNo, pageSize, search, status);
    res.json(response);
  } catch (error) {
    next(res)
  }
}

async function obterDadosCompletosAnuncio(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, search, status) {
  try {
    console.log('Início da função obterDadosCompletosAnuncio');
    console.log('Obtendo anúncios por data');
    const anuncios = await obterAnuncioPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, search, status);
    console.log('anúncios obtidos:', anuncios);
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
    const metricasResultados = await obterMetricasAnuncio(params);
    console.log('Métricas processadas para todos os conjuntos de anúncios');
    const dadosCompletos = anuncios.creatives.map(creative => {
      const metricas = metricasResultados.find(m => m && m.creativeId === creative.creativeId) || metricasPadrao;
      return { ...creative, ...metricas };
    });

    return {
      totalItems: anuncios.total,
      currentPage: pageNo,
      totalPages: Math.ceil(anuncios.total / pageSize),
      data: dadosCompletos,
    }; 
    await saveConjuntoAnuncios(dadosCompletos);
    return getCreatives(pageNo, pageSize);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function obterAnuncioPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, search, status) {
  const adCategory = 1;

  try {
    const params = {
      adCategory,
      granularity,
      dataBeginTime,
      dataEndTime,
      timeZoneIana,
      creativeIdList: search ? [parseInt(search)] : null,
      accountId,
      corpId,
      pageNo,
      pageSize
    };

    if (status !== undefined && status !== null && status !== '') {
      params.status = status;
    }

    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/creative/dspCreativePageQueryPerformance',
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
      return {
        "total": response.data.data.total,
        "creatives": response.data.data.data
      };
    } else if (response.data.status === 401) {
      await atualizarAccessToken();
      return obterAnuncioPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, search, status);
    }

  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function saveConjuntoAnuncios(conjuntoAnuncioValidas) {
  try {
    const db = mongoose.connection;
    
    // Dropa a coleção existente
    console.log('Dropando a coleção de conjuntoAnuncio...');
    await db.dropCollection('creative_all');

    // Preparando dados para inserção, assumindo que a `creative.deliveryStrategy` para `budgetType` já é ajustada
    const adSetToInsert = conjuntoAnuncioValidas.map(creative => {
      return {
        ...creative,
        budgetType: creative.deliveryStrategy
      };
    });

    // Inserção em lote das conjuntoAnuncio
    console.log('Inserindo novas conjuntoAnuncio na coleção creative_all...');
    await db.collection('creative_all').insertMany(adSetToInsert);
    console.log('conjuntoAnuncio inseridas com sucesso na coleção creative_all.');
  } catch (error) {
    console.error('Erro ao salvar conjuntoAnuncio:', error);
    // Verifica se a coleção existe antes de tentar dropar, se não existir, cria
    if (error.message.includes('ns not found')) {
      await db.createCollection('creative_all');
      console.log('Coleção creative_all criada, tente inserir novamente.');
    } else {
      throw error;
    }
  }
}

async function obterMetricasAnuncio(params) {
  params.pageSize = 100;
  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/report/dspCreativeEffectQuery',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );
    // console.log('obterMetricasAnuncio', response.data.data)
    if (response.data.status === 200 && response.data.data.total > 0) {
      return response;
    } else if (response.data.status === 401) {
      await atualizarAccessToken();
      return obterMetricasAnuncio(params);
    } else {
      return [];
    }
  } catch (error) {
    console.error('Erro ao obter as metricas do conjunto de anuncios', error);
    throw new Error(`Erro ao obter as metricas do conjunto de anuncios: ${error}`);
  }
}

async function creativeSearch(search, pageNo = 1, pageSize = 10) {
  const db = mongoose.connection;
  const collection = db.collection('creative_all');

  // Assegura que o índice de texto foi criado (idealmente, isso deve ser feito fora da função de busca, durante a inicialização do app ou similar)
  await collection.createIndex({ creativeName: 'text' });

  // Modifica a consulta para usar aspas, forçando uma pesquisa por frase exata
  const searchText = `"${search}"`; // Adiciona aspas ao redor da pesquisa para uma correspondência exata da frase
  const totalItems = await collection.countDocuments({ $text: { $search: searchText } });
  const skip = (pageNo - 1) * pageSize;
  const creative = await collection.find({ $text: { $search: searchText } })
    .skip(skip)
    .limit(pageSize)
    .toArray();

  return {
    totalItems,
    currentPage: pageNo,
    totalPages: Math.ceil(totalItems / pageSize),
    creative
  };
}

async function getCreatives(pageNo = 1, pageSize = 10) {
  try {
    const db = mongoose.connection;
    const collection = db.collection('creative_all');
    const totalItems = await collection.countDocuments();
    const skip = (pageNo - 1) * pageSize;
    const creative = await collection.find({})
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return {
      totalItems,
      currentPage: pageNo,
      totalPages: Math.ceil(totalItems / pageSize),
      creative
    };
  } catch (error) {
    console.error('Erro ao buscar conjuntoAnuncio:', error);
    throw error;
  }
}

async function deletarAnuncio(req, res) {
  try {
    const { creativeId } = req.body;
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;

    const deletarPromises = contasVinculadas.map(async (contaId) => {
      await deletarAnuncioPorConta(contaId, creativeId);
    });

    await Promise.all(deletarPromises);

    res.json({ message: 'Anúncio deletado com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao deletar o anúncio.' });
  }
}

async function deletarAnuncioPorConta(accountId, creativeId) {
  const params = {
    accountId: accountId,
    creativeIdList: [parseInt(creativeId)],
  };

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/creative/dspCreativeDeletePerformance',
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
        return deletarAnuncioPorConta(accountId, creativeId);
      } else {
        throw new Error(`Erro ao deletar anúncio da conta Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao deletar anúncio da conta Kwai Ads.');
  }
}

async function atualizarStatusAnuncio(req, res, next) {
  try {
    const { error } = updateCreativeStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { openStatus, creativeId } = req.body;
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;

    const atualizarStatusPromises = contasVinculadas.map(async (contaId) => {
      await atualizarStatusAnuncioPorConta(contaId, creativeId, openStatus);
    });

    await Promise.all(atualizarStatusPromises);

    res.json({ message: 'Status do anúncio atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar status do anúncio:', error);
    next(error);
  }
}

async function atualizarStatusAnuncioPorConta(accountId, creativeId, openStatus) {
  const params = {
    accountId: accountId,
    creativeIdList: [parseInt(creativeId)],
    openStatus: openStatus,
  };

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/creative/dspCreativeUpdateOpenStatusPerformance',
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
    } else if (response.data.status === 401) {
      await atualizarAccessToken();
      return atualizarStatusAnuncioPorConta(accountId, creativeId, openStatus);
    } else {
      throw new Error(`Erro ao atualizar status do anúncio da conta Kwai Ads: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error('Erro ao chamar API Kwai:', error);
    throw error;
  }
}

async function obterAnuncioPorId(accountId, creativeIdList, unitIdList) {
  const params = {
    accountId: accountId,
    adCategory: 1,
    campaignIdList: [],
    unitIdList: unitIdList,
    creativeIdList: creativeIdList,
    status: 1, // Assume que queremos anúncios ativos
    pageNo: 1,
    pageSize: 1 // Apenas um anúncio, já que conhecemos o ID
  };
  console.log("obterAnuncioPorId", params)

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/creative/dspCreativePageQueryPerformance',
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
      return obterAnuncioPorId(accountId, creativeIdList, unitIdList);
    } else {
      throw new Error(`Erro ao obter anúncio por ID: ${response.data}`);
    }
  } catch (error) {
    console.error('Erro ao obter anúncio por ID', error);
    throw error;
  }
}

async function duplicarAnuncio(req, res) {
  const { accountId, creativeIdList, unitIdList, quantidade } = req.body;
  const anuncioOriginal = await obterAnuncioPorId(accountId, creativeIdList, unitIdList);

  let novosAnuncios = [];

  for (let i = 0; i < quantidade; i++) {
    const novoAnuncio = {
      unitId: anuncioOriginal.unitId,
      adCategory: anuncioOriginal.adCategory,
      creativeType: 1,
      materialType: anuncioOriginal.materialType,
      photoId: anuncioOriginal.photoId,
      subTitle: `${anuncioOriginal.subTitle} (Duplicado ${i + 1})`,
      desc: anuncioOriginal.desc,
      callToAction: anuncioOriginal.callToAction,
      playableId: anuncioOriginal.playableId,
      materialSourceType: anuncioOriginal.materialSourceType == undefined ? anuncioOriginal.materialSourceType : 0,
      materialIdList: anuncioOriginal.materialIdList,
      creativeName: `${anuncioOriginal.creativeName} (Duplicado ${i + 1})`,
      useUnitAppIconAndName: anuncioOriginal.useUnitAppIconAndName == undefined ? anuncioOriginal.useUnitAppIconAndName : 0,
      avatarId: anuncioOriginal.avatarId,
      deepLink: anuncioOriginal.deepLink
    };

    novosAnuncios.push(novoAnuncio);
  }

  const params = {
    accountId: accountId,
    creativeAddModelList: novosAnuncios,
  };

  console.log(params);

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/creative/dspCreativeUpdatePerformance',
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
      return duplicarAnuncio(req, res);
    } else {
      throw new Error(`Erro ao duplicar anúncio: ${response.data.message}`);
    }
  } catch (error) {
    console.error('Erro ao duplicar anúncio', error);
    res.status(500).send('Erro ao duplicar anúncio');
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
  obterAnuncios,
  deletarAnuncio,
  atualizarStatusAnuncio,
  duplicarAnuncio
};