const express = require('express');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Access-Token']
}));

const authRoutes = require('./routes/authRoutes');
const dashRoutes = require('./routes/dashRoutes');
const contasRoutes = require('./routes/contasRoutes');
const conjuntoAnunciosRoutes = require('./routes/conjuntoAnunciosRoutes');
const campanhasRoutes = require('./routes/campanhasRoutes');
const automacaoRoutes = require('./routes/automacaoRoutes');
const anunciosRoutes = require('./routes/anunciosRoutes');

app.use('/auth', authRoutes);
app.use('/dash', dashRoutes);
app.use('/contas', contasRoutes);
app.use('/conjuntos-anuncio', conjuntoAnunciosRoutes);
app.use('/campanhas', campanhasRoutes);
app.use('/automacoes', automacaoRoutes);
app.use('/anuncios', anunciosRoutes);

function parseErrorMessage(error) {
  console.log('ERROR!!!!! ', error)
  try {
    const firstLevel = JSON.parse(error.message);
    const secondLevel = JSON.parse(firstLevel.message);
    let finalMessage = `${secondLevel.errorMessage}`;

    if (secondLevel.detailMsg && secondLevel.detailMsg.length > 0) {
      const details = secondLevel.detailMsg.map(detail => `${detail.errorMessage}`).join(', ');
      finalMessage += ` - Details: ${details}`;
    }

    return finalMessage;
  } catch (e) {
    console.error('Erro ao analisar a mensagem de erro:', e);
    return error.message;
  }
}

// Middleware de Tratamento de Erros
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json({ errors });
  } else if (err.name === 'CastError') {
    return res.status(400).json({
      field: err.path,
      message: `Invalid ${err.kind}: ${err.value}`
    });
  } else {
    console.log("!!!!!!!!!!!!!!", err)
    const simpleMessage = parseErrorMessage(err);
    res.status(500).json({ message: 'Internal server error', error: simpleMessage });
  }
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

require('./db');
module.exports = app;
