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
  try {
    const { status, search, page = 1, limit = 10 } = req.body;
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;

    const conjuntosAnuncio = await Promise.all(
      contasVinculadas.map(async (contaId) => {
        const conjuntosAnuncioPorConta = await obterConjuntosAnuncioPorConta(contaId, status, search, page, limit);
        return conjuntosAnuncioPorConta;
      })
    );

    const conjuntosAnuncioFlat = conjuntosAnuncio.flat();
    const totalConjuntosAnuncio = conjuntosAnuncioFlat.length;

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const conjuntosAnuncioPaginados = conjuntosAnuncioFlat.slice(startIndex, endIndex);

    res.json({
      total: totalConjuntosAnuncio,
      conjuntosAnuncio: conjuntosAnuncioPaginados,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao obter os conjuntos de anúncio.' });
  }
}

async function obterConjuntosAnuncioPorConta(accountId, status, search, page, limit) {
  const params = {
    accountId: accountId,
    status: status ? parseInt(status) : null,
    unitIdList: search ? [parseInt(search)] : null,
    pageNo: page,
    pageSize: limit,
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
      const conjuntosAnuncio = response.data.data.data;
      return conjuntosAnuncio;
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
        return obterConjuntosAnuncioPorConta(accountId, status, search, page, limit);
      } else {
        throw new Error(`Erro ao obter conjuntos de anúncio da conta Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao obter conjuntos de anúncio da conta Kwai Ads.');
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