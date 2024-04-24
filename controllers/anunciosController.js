const axios = require('axios');
const Usuario = require('../models/Usuario');
const { updateCreativeStatusSchema } = require('../validators/validationSchemas');
require('dotenv').config();

let accessToken = process.env.ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const corpId = process.env.CORP_ID;

async function obterAnuncios(req, res) {
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
    const response = await obterAnunciosPorData(contaId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function obterAnunciosPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana, pageNo, pageSize) {
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
      'https://developers.kwai.com/rest/n/mapi/report/dspCreativeEffectQuery',
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
          return obterAnunciosPorData(accountId, dataBeginTime, dataEndTime, granularity, timeZoneIana);
      } else {
        throw new Error(`Erro ao obter anúncios: ${response.data.message}`);
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error('Erro ao obter anúncios: ', error);
  }
}

async function deletarAnuncio(req, res) {
  try {
    const { creativeId } = req.body;
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;
    console.log("contasVinculadas", contasVinculadas)
    console.log("length", contasVinculadas.length)

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
  console.log("params", params)

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

async function duplicarAnuncioPorConta(req, res, next) {
  try {
    const dadosAnuncio = req.body;

    const { error } = anuncioSchema.validate(dadosAnuncio);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const response = await axios.post(
      'https://developers.kwai.com/rest/n/mapi/creative/dspCreativeAddPerformance',
      dadosAnuncio,
      {
        headers: {
          'Access-Token': process.env.ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status === 200) {
      res.json({ message: 'Anúncio duplicado com sucesso.', data: response.data });
    } else {
      throw new Error(`Erro ao duplicar anúncio: ${response.data.message}`);
    }
  } catch (error) {
    console.error(error);
    next(error);
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
  duplicarAnuncioPorConta
};