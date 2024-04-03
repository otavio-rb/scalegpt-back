const axios = require('axios');
const moment = require('moment');
const mongoose = require('mongoose');
const Automacao = require('./models/Automacao');
require('dotenv').config();

let accessToken = '';
const refreshToken = process.env.REFRESH_TOKEN;
const clientId = process.env.CLIENT_ID;
const secretKey = process.env.SECRET_KEY;
const corpId = process.env.CORP_ID;

async function handler(event, context) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const automacoes = await Automacao.find({
      proximaExecucao: { $lte: new Date() },
      executada: false,
    });

    for (const automacao of automacoes) {
      const { conta, campanhaId, evento, condicao, valor, acao } = automacao;

      const conjuntosAnuncio = await obterConjuntosAnuncioPorCampanha(conta, campanhaId);

      for (const conjuntoAnuncio of conjuntosAnuncio) {
        const { unitId, bid } = conjuntoAnuncio;

        const metricas = await obterMetricasConjuntoAnuncio(conta, unitId, evento);

        const metricaAtual = metricas[evento];

        if (condicao === 'maior que' && metricaAtual > valor) {
          await executarAcao(conta, unitId, acao, bid);
        } else if (condicao === 'menor que' && metricaAtual < valor) {
          await executarAcao(conta, unitId, acao, bid);
        }
      }

      automacao.proximaExecucao = moment().add(5, 'minutes').toDate();
      automacao.executada = true;
      await automacao.save();
    }

    await mongoose.disconnect();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Automações executadas com sucesso' }),
    };
  } catch (error) {
    console.error('Erro ao executar automações', error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao executar automações' }),
    };
  }
}

async function obterConjuntosAnuncioPorCampanha(accountId, campaignId) {
    const params = {
      accountId: accountId,
      campaignIdList: [campaignId],
      pageSize: 100,
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
          return obterConjuntosAnuncioPorCampanha(accountId, campaignId);
        } else {
          throw new Error(`Erro ao obter conjuntos de anúncio da campanha: ${response.data.message}`);
        }
      }
    } catch (error) {
      console.error('Erro ao obter conjuntos de anúncio da campanha', error);
      throw error;
    }
  }
  
  async function obterMetricasConjuntoAnuncio(accountId, unitId, evento) {
    const params = {
      accountId: accountId,
      unitIdList: [unitId],
      granularity: 3,
      dataBeginTime: moment().subtract(1, 'days').startOf('day').valueOf(),
      dataEndTime: moment().endOf('day').valueOf(),
      timeZoneIana: 'UTC-3',
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
        const metricas = response.data.data.data[0];
        return {
          CPA: metricas.cpa,
          Purchase: metricas.purchase,
          'Add to Cart': metricas.addToCart,
          Registration: metricas.registration,
          'Content View': metricas.contentView,
        };
      } else {
        if (response.data.status === 401) {
          await atualizarAccessToken();
          return obterMetricasConjuntoAnuncio(accountId, unitId, evento);
        } else {
          throw new Error(`Erro ao obter métricas do conjunto de anúncio: ${response.data.message}`);
        }
      }
    } catch (error) {
      console.error('Erro ao obter métricas do conjunto de anúncio', error);
      throw error;
    }
  }
  
  async function executarAcao(accountId, unitId, acao, bid) {
    const { tipo, valor } = acao;
  
    if (tipo === 'Aumentar bid') {
      const novoBid = bid * (1 + valor / 100);
      await atualizarBidConjuntoAnuncio(accountId, unitId, novoBid);
    } else if (tipo === 'Diminuir bid') {
      const novoBid = bid * (1 - valor / 100);
      await atualizarBidConjuntoAnuncio(accountId, unitId, novoBid);
    } else if (tipo === 'Desativar') {
      await desativarConjuntoAnuncio(accountId, unitId);
    } else if (tipo === 'Desativar e duplicar') {
      await desativarConjuntoAnuncio(accountId, unitId);
      await duplicarConjuntoAnuncio(accountId, unitId, valor);
    }
  }
  
  async function atualizarBidConjuntoAnuncio(accountId, unitId, bid) {
    const params = {
      accountId: accountId,
      unitUpdateModelList: [
        {
          unitId: unitId,
          bid: bid * 1000000,
        },
      ],
    };
  
    try {
      const response = await axios.post(
        'https://developers.kwai.com/rest/n/mapi/unit/dspUnitUpdatePerformance',
        params,
        {
          headers: {
            'Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );
  
      if (response.data.status === 200) {
        console.log(`Bid do conjunto de anúncio ${unitId} atualizado para ${bid}`);
      } else {
        if (response.data.status === 401) {
          await atualizarAccessToken();
          return atualizarBidConjuntoAnuncio(accountId, unitId, bid);
        } else {
          throw new Error(`Erro ao atualizar bid do conjunto de anúncio: ${response.data.message}`);
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar bid do conjunto de anúncio', error);
      throw error;
    }
  }
  
  async function desativarConjuntoAnuncio(accountId, unitId) {
    const params = {
      accountId: accountId,
      unitIdList: [unitId],
      openStatus: 2,
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
        console.log(`Conjunto de anúncio ${unitId} desativado`);
      } else {
        if (response.data.status === 401) {
          await atualizarAccessToken();
          return desativarConjuntoAnuncio(accountId, unitId);
        } else {
          throw new Error(`Erro ao desativar conjunto de anúncio: ${response.data.message}`);
        }
      }
    } catch (error) {
      console.error('Erro ao desativar conjunto de anúncio', error);
      throw error;
    }
  }
  
  async function duplicarConjuntoAnuncio(accountId, unitId, quantidade) {
    const conjuntoAnuncio = await obterConjuntoAnuncioPorId(accountId, unitId);
  
    const novosConjuntosAnuncio = [];
  
    for (let i = 0; i < quantidade; i++) {
      const novoConjuntoAnuncio = {
        ...conjuntoAnuncio,
        unitName: `${conjuntoAnuncio.unitName} (Duplicado ${i + 1})`,
      };
      delete novoConjuntoAnuncio.unitId;
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
        console.log(`Conjunto de anúncio ${unitId} duplicado ${quantidade} vezes`);
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
  
  async function atualizarAccessToken() {
    try {
      const response = await axios.post(
        'https://developers.kwai.com/oauth/token',
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: secretKey,
        }
      );
  
      if (response.data.status === 200) {
        accessToken = response.data.access_token;
      } else {
        throw new Error(`Erro ao atualizar o token de acesso: ${response.data.message}`);
      }
    } catch (error) {
      console.error(error);
      throw new Error('Erro ao atualizar o token de acesso.');
    }
}
  
module.exports = {
  handler,
};