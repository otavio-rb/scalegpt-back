const express = require('express');
const router = express.Router();
const dashController = require('../controllers/dashController');
const authMiddleware = require('../authMiddleware');

router.post('/total-gasto-hoje', authMiddleware, dashController.obterTotalGastoHoje);
router.post('/novos-anuncios-rejeitados', authMiddleware, dashController.obterAnunciosRejeitados);
router.post('/anuncios-ativos', authMiddleware, dashController.obterAnunciosAtivosCount);
router.post('/investimento-por-tempo', authMiddleware, dashController.obterUltimos12Meses);
router.post('/top-cinco', authMiddleware, dashController.obterTopCinco);

module.exports = router;