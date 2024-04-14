const axios = require('axios');
const moment = require('moment');
const Usuario = require('../models/Usuario');
require('dotenv').config();

let accessToken = process.env.ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const corpId = process.env.CORP_ID;

async function obterAnuncios(req, res) {
  try {
    const { status, search, page = 1, limit = 10 } = req.body;
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;

    const anuncios = await Promise.all(
      contasVinculadas.map(async (contaId) => {
        const anunciosPorConta = await obterAnunciosPorConta(contaId, status, search, page, limit);
        return anunciosPorConta;
      })
    );

    const anunciosFlat = anuncios.flat();
    const totalAnuncios = anunciosFlat.length;

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const anunciosPaginados = anunciosFlat.slice(startIndex, endIndex);

    res.json({
      total: totalAnuncios,
      anuncios: anunciosPaginados,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao obter os anúncios.' });
  }
}

async function obterAnunciosPorConta(accountId, status, search, page, limit) {
  const params = {
    accountId: accountId,
    adCategory: 1,
    status: status ? parseInt(status) : null,
    creativeIdList: search ? [parseInt(search)] : null,
    pageNo: page,
    pageSize: limit,
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
      const anuncios = response.data.data.data;
      return anuncios;
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
        return obterAnunciosPorConta(accountId, status, search, page, limit);
      } else {
        throw new Error(`Erro ao obter anúncios da conta Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao obter anúncios da conta Kwai Ads.');
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

async function atualizarStatusAnuncio(req, res) {
  try {
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
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar o status do anúncio.' });
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
    } else {
      if (response.data.status === 401) {
        await atualizarAccessToken();
        return atualizarStatusAnuncioPorConta(accountId, creativeId, openStatus);
      } else {
        throw new Error(`Erro ao atualizar status do anúncio da conta Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao atualizar status do anúncio da conta Kwai Ads.');
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
  obterAnuncios,
  deletarAnuncio,
  atualizarStatusAnuncio,
};