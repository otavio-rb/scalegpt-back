const axios = require('axios');
const moment = require('moment');
const Usuario = require('../models/Usuario');
require('dotenv').config();

let accessToken = process.env.ACCESS_TOKEN;
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
          return { status: response.data.status };
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

async function vincularConta(req, res) {
  try {
    const userId = req.user._id;
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).send({ message: 'Id da conta obrigatório' });
    }

    // Primeiro, verifica se a conta pode ser acessada e está ativa
    const dadosConta = await obterDadosContaKwaiAds(accountId);
    if (dadosConta.status && dadosConta.status !== 200 && dadosConta.status !== 401) {
      return res.status(403).send({ message: 'Esta conta não pode ser vinculada.' });
    }

    const usuario = await Usuario.findById(userId);
    if (!usuario.contasVinculadas) {
      usuario.contasVinculadas = [];
    }

    if (usuario.contasVinculadas.includes(accountId)) {
      return res.status(409).send({ message: 'Conta já está vinculada.' });
    }

    usuario.contasVinculadas.push(accountId);
    await usuario.save();
    res.send({ message: 'Conta vinculada com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Erro ao vincular a conta.' });
  }
}

module.exports = {
  obterContasVinculadas,
  vincularConta
};