const axios = require('axios');
const moment = require('moment');
const Usuario = require('../models/Usuario');
require('dotenv').config();

let accessToken = process.env.ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const corpId = process.env.CORP_ID;

async function obterConjuntosAnuncio(req, res) {
  const userId = req.user._id;
  const { contaId, granularity, dataBeginTime, dataEndTime, timeZoneIana, pageNo, pageSize } = req.body;
  
  const usuario = await Usuario.findById(userId);
  if (!usuario.contasVinculadas || usuario.contasVinculadas.length === 0) {
    return res.status(400).json({ error: 'Usuário não possui contas vinculadas' });
  }
  
  if (!usuario.contasVinculadas.includes(contaId)) {
    return res.status(403).json({ error: 'Conta não vinculada ao usuário' });
  }

  try {
    const response = await obterConjuntosAnuncioPorData(contaId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function obterConjuntosAnuncioPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize) {
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
      'https://developers.kwai.com/rest/n/mapi/report/dspUnitEffectQuery',
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
          return obterConjuntosAnuncioPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana);
      } else {
        throw new Error(`Erro ao obter anúncios: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao obter anúncios: ', error);
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
  obterConjuntosAnuncio,
  deletarConjuntoAnuncio,
  atualizarStatusConjuntoAnuncio,
};