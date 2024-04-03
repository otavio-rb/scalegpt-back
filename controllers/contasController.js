const axios = require('axios');
const moment = require('moment');
const Usuario = require('../models/Usuario');
require('dotenv').config();

let accessToken = '';
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const corpId = process.env.CORP_ID;

async function obterContasVinculadas(req, res) {
  try {
    const userId = req.user._id;
    const usuario = await Usuario.findById(userId);
    const contasVinculadas = usuario.contasVinculadas;

    const contasDetalhadas = await Promise.all(
      contasVinculadas.map(async (contaId) => {
        const { accountId, accountName, totalGasto } = await obterDadosContaKwaiAds(contaId);

        return {
          id: accountId,
          nome: accountName,
          totalGasto,
        };
      })
    );

    res.json(contasDetalhadas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao obter as contas vinculadas.' });
  }
}

async function obterDadosContaKwaiAds(accountId) {
  let totalGasto = 0;
  let pageNo = 1;
  const pageSize = 2000;
  let accountName = '';

  while (true) {
    const params = {
      accountId: accountId,
      corpId: corpId,
      granularity: 3,
      dataBeginTime: moment('2000-01-01').valueOf(),
      dataEndTime: moment().valueOf(),
      timeZoneIana: 'UTC-3',
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
        const campanhas = response.data.data.data;
        const gastoNaPagina = campanhas.reduce((sum, campanha) => sum + campanha.cost, 0);
        totalGasto += gastoNaPagina;

        if (pageNo === 1 && campanhas.length > 0) {
          accountName = campanhas[0].accountName;
        }

        if (campanhas.length < pageSize) {
          break;
        } else {
          pageNo++;
        }
      } else {
        if (response.data.status === 401) {
          await atualizarAccessToken();
          continue;
        } else {
          throw new Error(`Erro ao obter dados da conta Kwai Ads: ${response.data.message}`);
        }
      }
    } catch (error) {
      console.error(error);
      throw new Error('Erro ao obter dados da conta Kwai Ads.');
    }
  }

  return { accountId, accountName, totalGasto: totalGasto / 1000000 };
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
  obterContasVinculadas,
};