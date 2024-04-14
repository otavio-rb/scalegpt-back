const axios = require('axios');
const Usuario = require('../models/Usuario');
require('dotenv').config();

let accessToken = process.env.ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const corpId = process.env.CORP_ID;

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
    const totalCampanhas = campanhasFlat.length;
    
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const campanhasPaginadas = campanhasFlat.slice(startIndex, endIndex);

    res.json({
      total: totalCampanhas,
      campanhas: campanhasPaginadas,
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
      const campanhas = response.data.data.data;
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

async function atualizarStatusCampanha(req, res) {
  try {
    const { openStatus, campaignId } = req.body;
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;

    const atualizarStatusPromises = contasVinculadas.map(async (contaId) => {
      await atualizarStatusCampanhaPorConta(contaId, campaignId, openStatus);
    });

    await Promise.all(atualizarStatusPromises);

    res.json({ message: 'Status da campanha atualizado com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar o status da campanha.' });
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
        throw new Error(`Erro ao atualizar status da campanha da conta Kwai Ads: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao atualizar status da campanha da conta Kwai Ads.');
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
};