const axios = require('axios');
const moment = require('moment');
const Usuario = require('../models/Usuario');
require('dotenv').config();

let accessToken = process.env.ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const corpId = process.env.CORP_ID;

async function obterTotalGastoHoje(req, res) {
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
  const totalGastoHoje = await obterTotalGastoPorData(contaId, dataAtual);

  res.json(totalGastoHoje);
}

async function obterAnunciosRejeitados(req, res) {
  const userId = req.user._id;
  const { contaId } = req.body;
  
  const usuario = await Usuario.findById(userId);
  if (!usuario.contasVinculadas || usuario.contasVinculadas.length === 0) {
    return res.status(400).json({ error: 'Usuário não possui contas vinculadas' });
  }
  
  if (!usuario.contasVinculadas.includes(contaId)) {
    return res.status(403).json({ error: 'Conta não vinculada ao usuário' });
  }

  const anunciosRejeitados = await obterNovosAnunciosRejeitados(contaId);

  res.json(anunciosRejeitados);
}

async function obterAnunciosAtivosCount(req, res) {
  const userId = req.user._id;
  const { contaId } = req.body;
  
  const usuario = await Usuario.findById(userId);
  if (!usuario.contasVinculadas || usuario.contasVinculadas.length === 0) {
    return res.status(400).json({ error: 'Usuário não possui contas vinculadas' });
  }
  
  if (!usuario.contasVinculadas.includes(contaId)) {
    return res.status(403).json({ error: 'Conta não vinculada ao usuário' });
  }

  const anunciosAtivos = await obterAnunciosAtivos(contaId);

  res.json(anunciosAtivos);
}

async function obterTopCinco(req, res) {
  const userId = req.user._id;
  const { contaId } = req.body;
  
  const usuario = await Usuario.findById(userId);
  if (!usuario.contasVinculadas || usuario.contasVinculadas.length === 0) {
    return res.status(400).json({ error: 'Usuário não possui contas vinculadas' });
  }
  
  if (!usuario.contasVinculadas.includes(contaId)) {
    return res.status(403).json({ error: 'Conta não vinculada ao usuário' });
  }

  const topCinco = await obterTop5Campanhas(contaId);

  res.json(topCinco);
}

async function obterUltimos12Meses(req, res) {
  const userId = req.user._id;
  const { contaId } = req.body;
  
  const usuario = await Usuario.findById(userId);
  if (!usuario.contasVinculadas || usuario.contasVinculadas.length === 0) {
    return res.status(400).json({ error: 'Usuário não possui contas vinculadas' });
  }
  
  if (!usuario.contasVinculadas.includes(contaId)) {
    return res.status(403).json({ error: 'Conta não vinculada ao usuário' });
  }

  const investimentosUlt12 = await obterInvestimentoPorTempo(contaId);

  res.json(investimentosUlt12);
}


async function obterTotalGastoPorData(accountId, data) {
    const params = {
        granularity: 3,
        dataBeginTime: moment(data).startOf('day').valueOf(),
        dataEndTime: moment(data).endOf('day').valueOf(),
        timeZoneIana: 'UTC-3',
        accountId: accountId,
        corpId: corpId,
    };
  
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
        if(totalGasto) {
          return totalGasto;
        } else {
          return 0;
        }
      } else {
        if (response.data.status === 401) {
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

async function obterInvestimentoPorTempo(accountId) {  
  const dataAtual = moment().startOf('month');
  const dataInicio = moment().subtract(11, 'months').startOf('month');

  const investimentoPorTempo = [];

  for (let mes = dataInicio; mes.isSameOrBefore(moment(), 'month'); mes.add(1, 'month')) {
    const params = {
      granularity: 3,
      dataBeginTime: mes.valueOf(),
      dataEndTime: mes.clone().endOf('month').valueOf(),
      timeZoneIana: 'UTC-3',
      accountId: accountId,
      corpId: corpId,
    };

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
        investimentoPorTempo.push({
          mes: mes.format('YYYY-MM'),
          custoTotalMes
        });

      } else {
        if (response.data.status === 401) {
          await atualizarAccessToken();
          return obterInvestimentoPorTempo(accountId);
        } else {
          throw new Error(`Erro ao obter o investimento por tempo da API Kwai Ads: ${response.data.message}`);
        }
      }
    } catch (error) {
      console.error(error);
      throw new Error('Erro ao obter o investimento por tempo da API Kwai Ads.');
    }
  }

  return investimentoPorTempo;
}

async function obterTop5Campanhas(accountId) {
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

  return top5Campanhas;
}

async function atualizarAccessToken() {

  try {
    const response = await axios.get(
      `https://developers.kwai.com/oauth/token?grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${secretKey}`,
    );
    
    if (response.data) {
      accessToken = response.data.access_token;
    } else {
      console.log(response, "blabla")
      throw new Error(`Erro ao atualizar o token de acesso`);
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao atualizar o token de acesso.');
  }
}

module.exports = {
  obterTotalGastoHoje,
  obterAnunciosRejeitados,
  obterAnunciosAtivosCount,
  obterTopCinco,
  obterUltimos12Meses
};