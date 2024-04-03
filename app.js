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



app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

require('./db');
module.exports = app;