const axios = require('axios');
const moment = require('moment');
const Usuario = require('../models/Usuario');
require('dotenv').config();

let accessToken = process.env.ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const corpId = process.env.CORP_ID;

async function fetchKwaiData(req, res) {
  accessToken = await atualizarAccessToken();
  const userId = req.user._id;
  const { contaId } = req.body;

  const usuario = await Usuario.findById(userId);
  if (!usuario.contasVinculadas || usuario.contasVinculadas.length === 0) {
    return res.status(400).json({ error: 'Usuário não possui contas vinculadas' });
  }

  if (!usuario.contasVinculadas.includes(contaId)) {
    return res.status(403).json({ error: 'Conta não vinculada ao usuário' });
  }

  const dataAtual = moment().format('YYYY-MM-DD');

  try {
    const [totalGastoHoje, anunciosRejeitados, anunciosAtivos, topCinco, ultimos12Meses] = await Promise.all([
      obterTotalGastoPorData(contaId, dataAtual),
      obterNovosAnunciosRejeitados(contaId),
      obterAnunciosAtivos(contaId),
      obterTop5Campanhas(contaId),
      obterInvestimentoPorTempo(contaId)
    ]);

    res.json({
      totalGastoHoje,
      anunciosRejeitados,
      anunciosAtivos,
      topCinco,
      ultimos12Meses
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao obter dados da API Kwai Ads' });
  }
}

async function obterTotalGastoPorData(accountId, data) {
  const inicio = Date.now();
  const params = {
      granularity: 3,
      dataBeginTime: moment().startOf('day').valueOf(),
      dataEndTime: moment(data).endOf('day').valueOf(),
      timeZoneIana: 'UTC-3',
      accountId: accountId,
      corpId: corpId,
  };

  console.log("obterTotalGastoPorData", params)

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/report/dspAccountEffectQuery',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status === 200) {
      const totalGasto = response?.data?.data?.data[0]?.cost;
      const duracao = (Date.now() - inicio) / 1000;
      if(totalGasto) {
        console.log(`Tempo de execução obterTotalGastoPorData: ${duracao.toFixed(2)}s`);
        return totalGasto;
      } else {
        console.log(`Tempo de execução obterTotalGastoPorData: ${duracao.toFixed(2)}s`);
        return 0;
      }
    } else {
      if (response.data.status === 401) {
          console.log('aquiii');
          await atualizarAccessToken();
          return obterTotalGastoPorData(accountId, data);
      } else {

        throw new Error(`Erro ao obter o total gasto: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao obter o total gasto: ', error);
  }
}

async function obterNovosAnunciosRejeitados(accountId) {    
  const inicio = Date.now();
  const params = {
      accountId: accountId,
      corpId: corpId,
      status: 7,
      adCategory: 1,
      pageNo: 1,
      pageSize: 100,
  };

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

    if (response.data.status === 200) {
      const novosAnunciosRejeitados = response.data.data.total;
      const duracao = (Date.now() - inicio) / 1000;
      console.log(`Tempo de execução obterNovosAnunciosRejeitados: ${duracao.toFixed(2)}s`);
      return novosAnunciosRejeitados;
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
          return obterNovosAnunciosRejeitados(accountId);
      } else {
          throw new Error(`Erro ao obter o número de novos anúncios rejeitados da API Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao obter o número de novos anúncios rejeitados da API Kwai Ads.');
  }
}

async function obterAnunciosAtivos(accountId) {  
  const inicio = Date.now();
  const params = {
    accountId: accountId,
    corpId: corpId,
    status: 1,
    adCategory: 1,
    pageNo: 1,
    pageSize: 100,
  };

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

    if (response.data.status === 200) {
      const anunciosAtivos = response.data.data.total;
      const duracao = (Date.now() - inicio) / 1000;
      console.log(`Tempo de execução obterAnunciosAtivos: ${duracao.toFixed(2)}s`);
      return anunciosAtivos;
    } else {
      if (response.data.status === 401) {
          await atualizarAccessToken();
          return obterAnunciosAtivos(accountId);
      } else {
          throw new Error(`Erro ao obter o número de anúncios ativos da API Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao obter o número de anúncios ativos da API Kwai Ads.');
  }
}

async function obterTop5Campanhas(accountId) {
  const inicio = Date.now();
  let campanhas = [];
  let pageNo = 1;
  const pageSize = 2000;
  let totalCampanhas = 0;

  const dataInicio = moment().subtract(10, 'years').valueOf();
  const dataFim = moment().valueOf(); 

  do {
    const params = {
      granularity: 3,
      dataBeginTime: dataInicio,
      dataEndTime: dataFim,
      timeZoneIana: "UTC-3",
      accountId: accountId,
      pageNo: pageNo,
      pageSize: pageSize,
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
        const responseData = response.data.data.data;
        campanhas.push(...responseData.map(campanha => ({
          campaignId: campanha.campaignId,
          campaignName: campanha.campaignName,
          cost: campanha.cost / 1000000,
        })));
        totalCampanhas = response.data.data.total;
      } else {
        if (response.data.status === 401) {
            await atualizarAccessToken();
            return obterTop5Campanhas(accountId);
        } else {
            throw new Error(`Erro ao obter as campanhas da API Kwai Ads: ${response.data.message}`);
        }
      }
    } catch (error) {
      console.error(error);
      throw new Error('Erro ao obter as campanhas da API Kwai Ads.');
    }

    pageNo++;
  } while (campanhas.length < totalCampanhas);

  const top5Campanhas = campanhas.sort((a, b) => b.cost - a.cost).slice(0, 5);
  const duracao = (Date.now() - inicio) / 1000;
  console.log(`Tempo de execução obterTop5Campanhas: ${duracao.toFixed(2)}s`);
  return top5Campanhas;
}

async function obterInvestimentoPorTempo(accountId) {
  const inicio = Date.now();
  const dataInicio = moment().subtract(11, 'months').startOf('month');
  const dataFim = moment().startOf('month');

  // Calcula a diferença em meses e cria um array de requisições
  const totalMeses = dataFim.diff(dataInicio, 'months') + 1;
  const requests = Array.from({ length: totalMeses }, (_, index) => {
    const mesAtual = dataInicio.clone().add(index, 'months');
    return fetchDataForMonth(accountId, mesAtual.format('YYYY-MM'), mesAtual);
  });

  try {
    const results = await Promise.all(requests);
    const duracao = (Date.now() - inicio) / 1000;
    console.log(`Tempo de execução obterInvestimentoPorTempo: ${duracao.toFixed(2)}s`);
    return results.filter(result => result !== null); 
  } catch (error) {
    throw new Error('Erro ao obter investimento por tempo da API Kwai Ads.');
  }
}

async function fetchDataForMonth(accountId, mesFormatado, mes) {
  const params = {
    granularity: 3,
    dataBeginTime: mes.valueOf(),
    dataEndTime: mes.clone().endOf('month').valueOf(),
    timeZoneIana: 'UTC-3',
    accountId: accountId,
    corpId: corpId,
  };
  console.log("fetchDataForMonth", params)

  try {
    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/report/dspAccountEffectQuery',
      params,
      {
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status === 200) {
      const custoTotalMes = response.data.data.data.reduce((acc, cur) => acc + ((cur.cost ?? 0) / 1000000), 0);
      return {
        mes: mesFormatado,
        custoTotalMes
      };
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
        return fetchDataForMonth(accountId, mesFormatado, mes);
      } else {
        throw new Error(`Erro ao obter o investimento por tempo da API Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    return null;
  }
}

let isTokenBeingRefreshed = false;
let subscribers = [];
function onTokenRefreshed(error, newToken) {
  subscribers.forEach(callback => callback(error, newToken));
  subscribers = [];
}

async function atualizarAccessToken() {
  console.log('Chamou a atualização de token!');
  if (isTokenBeingRefreshed) {
    return new Promise((resolve, reject) => {
      subscribers.push((error, newToken) => {
        if (error) {
          reject(error);
        } else {
          resolve(newToken);
        }
      });
    });
  }

  isTokenBeingRefreshed = true;
  try {
    const response = await axios.get(`https://developers.kwai.com/oauth/token?grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${secretKey}`);
    if (response.data && response.status === 200) {
      accessToken = response.data.access_token;
      isTokenBeingRefreshed = false;
      onTokenRefreshed(null, accessToken);
      return accessToken;
    } else {
      throw new Error(`Erro ao atualizar o token de acesso: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    isTokenBeingRefreshed = false;
    onTokenRefreshed(error, null);
    throw error;
  }
}


module.exports = {
  fetchKwaiData
};
