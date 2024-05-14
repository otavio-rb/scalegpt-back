const axios = require('axios');
const Usuario = require('../models/Usuario');
const { default: mongoose } = require('mongoose');
require('dotenv').config();

let accessToken = process.env.ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const corpId = process.env.CORP_ID;

async function obterConjuntosAnuncio(req, res, next) {
  const userId = req.user._id;
  const { contaId, granularity, timeZoneIana, pageNo, pageSize, search, status } = req.body;
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
    const response = await obterDadosCompletosConjuntosAnuncio(contaId, timestampBegin, timestampEnd, granularity, timeZoneIana, pageNo, pageSize, search, status);
    res.json(response);
  } catch (error) {
    next(res)
  }
}

async function obterDadosCompletosConjuntosAnuncio(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, search, status = 1) {
  try {
    console.log('Início da função obterDadosCompletosConjuntosAnuncio');
    console.log('Obtendo conjuntos de anúncios por data');
    const ConjuntoAnuncios = await obterConjuntosAnuncioPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, status);
    console.log('Conjuntos de anúncios obtidos:', ConjuntoAnuncios.length);
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
    const metricasResultados = await obterMetricasConjuntoAnuncio(params);
    console.log('Métricas processadas para todos os conjuntos de anúncios');
    const dadosCompletos = ConjuntoAnuncios.adSets.map(adSet => {
      const metricas = metricasResultados.find(m => m && m.adSetId === adSet.adSetId) || metricasPadrao;
      return { ...adSet, ...metricas };
    });
    return {
      totalItems: ConjuntoAnuncios.total,
      currentPage: pageNo,
      totalPages: Math.ceil(ConjuntoAnuncios.total / pageSize),
      data: dadosCompletos,
    };
    console.log('dadosCompletos', dadosCompletos)
    await saveConjuntoAnuncios(dadosCompletos, pageNo);
    return getAdSets(pageNo, pageSize);
  } catch (error) {
    console.error('Erro ao obter dados completos das ConjuntoAnuncios', error);
    throw error;
  }
}

async function obterConjuntosAnuncioPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, status) {
  let totalConjuntoAnuncio = [];
  const adCategory = 1;

  try {
      const params = {
        adCategory,
        granularity,
        dataBeginTime,
        dataEndTime,
        timeZoneIana,
        status,
        accountId,
        corpId,
        pageNo,
        pageSize
      };
      const response = await axios.post(
        'https://developers.kwai.com/rest/n/mapi/unit/dspUnitPageQueryPerformance',
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
        const adSets = response.data.data.data;
        totalConjuntoAnuncio = totalConjuntoAnuncio.concat(adSets);
      } else if (response.data.status === 401) {
        await atualizarAccessToken();
        return obterConjuntosAnuncioPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize, status);
      } else {
        throw new Error(`Erro ao obter conjuntoAnuncio: ${response.data.message}`);
      }
    return {"adSets": totalConjuntoAnuncio, "total": response.data.data.total};

  } catch (error) {
    console.error(error);
    throw new Error(`Erro ao obter conjuntoAnuncio: ${error}`);
  }
}

async function saveConjuntoAnuncios(conjuntoAnuncioValidas, pageNo) {
  try {
    const db = mongoose.connection;
    const bulkOps = conjuntoAnuncioValidas.map(ad_set => ({
      updateOne: {
        filter: { unitId: ad_set.unitId }, 
        update: { $set: { ...ad_set, pageNo: pageNo } },
        upsert: true
      }
    }));

    console.log('Atualizando/Inserindo conjuntoAnuncio na coleção ad_set_all...');
    const result = await db.collection('ad_set_all').bulkWrite(bulkOps);
    console.log(`Operação completada. Matched: ${result.matchedCount}, Upserted: ${result.upsertedCount}`);
  } catch (error) {
    console.error('Erro ao salvar conjuntoAnuncio:', error);
    throw error;
  }
}


async function obterMetricasConjuntoAnuncio(params) {
  params.pageSize = 100;
  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/report/dspUnitEffectQuery',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );
    // console.log('obterMetricasConjuntoAnuncio', response.data.data)
    if (response.data.status === 200 && response.data.data.total > 0) {
      return response;
    } else if (response.data.status === 401) {
      await atualizarAccessToken();
      return obterMetricasConjuntoAnuncio(params);
    } else {
      return [];
    }
  } catch (error) {
    console.error('Erro ao obter as metricas do conjunto de anuncios', error);
    throw new Error(`Erro ao obter as metricas do conjunto de anuncios: ${error}`);
  }
}

async function adSetSearch(search, pageNo = 1, pageSize = 10, status) {
  try {
    const db = mongoose.connection;
    const collection = db.collection('ad_set_all');

    // Assegura que o índice de texto foi criado (idealmente, isso deve ser feito fora da função de busca, durante a inicialização do app ou similar)
    const unitName = {
      unitName: { $regex: search, $options: 'i' }, // '$options: 'i'' para busca case-insensitive
      status: status // Assume que status é um campo numérico
    };

    // Modifica a consulta para usar aspas, forçando uma pesquisa por frase exata
    const totalItems = await collection.countDocuments(query);
    const skip = (pageNo - 1) * pageSize;
    const adSet = await collection.find(query)
      .skip(skip)
      .limit(pageSize)
      .toArray();
      
    return {
      totalItems,
      currentPage: pageNo,
      totalPages: Math.ceil(totalItems / pageSize),
      ad_set: adSet
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function getAdSets(pageNo = 1, pageSize = 10) {
  try {
    const db = mongoose.connection;
    const collection = db.collection('ad_set_all');
    const totalItems = await collection.countDocuments();
    const skip = (pageNo - 1) * pageSize;
    const adSets = await collection.find({})
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return {
      totalItems,
      currentPage: pageNo,
      totalPages: Math.ceil(totalItems / pageSize),
      adSets,
    };
  } catch (error) {
    console.error('Erro ao buscar conjuntoAnuncio:', error);
    throw error;
  }
}

async function deletarConjuntoAnuncio(req, res) {
  try {
    const { unitId } = req.body;
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;

    const deletarPromises = contasVinculadas.map(async (contaId) => {
      await deletarConjuntoAnuncioPorConta(contaId, unitId);
    });

    await Promise.all(deletarPromises);

    res.json({ message: 'Conjunto de anúncio deletado com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao deletar o conjunto de anúncio.' });
  }
}

async function deletarConjuntoAnuncioPorConta(accountId, unitId) {
  const params = {
    accountId: accountId,
    unitIdList: [parseInt(unitId)],
  };

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/unit/dspUnitDeletePerformance',
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
        return deletarConjuntoAnuncioPorConta(accountId, unitId);
      } else {
        throw new Error(`Erro ao deletar conjunto de anúncio da conta Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao deletar conjunto de anúncio da conta Kwai Ads.');
  }
}

async function atualizarStatusConjuntoAnuncio(req, res, next) {
  try {
    const { openStatus, unitIdList } = req.body;
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;

    const atualizarStatusPromises = contasVinculadas.map(async (contaId) => {
      await atualizarStatusConjuntoAnuncioPorConta(contaId, unitIdList, openStatus);
    });

    await Promise.all(atualizarStatusPromises);

    res.json({ message: 'Status do conjunto de anúncio atualizado com sucesso.' });
  } catch (error) {
    console.error(error);
    next(error)
  }
}

async function atualizarStatusConjuntoAnuncioPorConta(accountId, unitIdList, openStatus) {
  const params = {
    accountId: accountId,
    unitIdList: unitIdList,
    openStatus: openStatus,
  };

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/unit/dspUnitUpdateOpenStatusPerformance',
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
        return atualizarStatusConjuntoAnuncioPorConta(accountId, unitIdList, openStatus);
      } else {
        throw new Error(`Erro ao atualizar status do conjunto de anúncio da conta Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function obterConjuntoAnuncioPorId(accountId, unitId) {
  const params = {
    accountId: accountId,
    unitIdList: [unitId],
  };
  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/unit/dspUnitPageQueryPerformance',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status === 200) {
      const conjuntoAnuncio = response.data.data.data[0];
      return conjuntoAnuncio;
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
        return obterConjuntoAnuncioPorId(accountId, unitId);
      } else {
        throw new Error(`Erro ao obter conjunto de anúncio por ID: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error('Erro ao obter conjunto de anúncio por ID', error);
    throw error;
  }
}

async function duplicarConjuntoAnuncio(req, res, next) {
  const { accountId, unitId, quantidade } = req.body;
  const conjuntoAnuncio = await obterConjuntoAnuncioPorId(accountId, unitId);
  let novosConjuntosAnuncio = [];

  for (let i = 0; i < quantidade; i++) {
    const novoConjuntoAnuncio = {
      ...conjuntoAnuncio,
      unitName: `${conjuntoAnuncio.unitName} (Duplicado ${i + 1})`,
    };
    delete novoConjuntoAnuncio.unitId;
    novoConjuntoAnuncio.budgetType = 1;
    if(novoConjuntoAnuncio.budgetType == 1) { 
      novoConjuntoAnuncio.dayBudget = null 
      novoConjuntoAnuncio.budgetSchedule = null
    }
    novoConjuntoAnuncio.urlType = 2;
    novosConjuntosAnuncio.push(novoConjuntoAnuncio);
  }
  const params = {
    accountId: accountId,
    unitAddModelList: novosConjuntosAnuncio,
  };
  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/unit/dspUnitAddPerformance',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status === 200) {
      res.json(response);
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
        return duplicarConjuntoAnuncio(accountId, unitId, quantidade);
      } else {
        throw new Error(`Erro ao duplicar conjunto de anúncio: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error('Erro ao duplicar conjunto de anúncio', error);
    next(error)
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
  obterConjuntosAnuncio,
  deletarConjuntoAnuncio,
  atualizarStatusConjuntoAnuncio,
  duplicarConjuntoAnuncio
};