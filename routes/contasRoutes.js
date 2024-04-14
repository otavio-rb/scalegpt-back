const express = require('express');
const router = express.Router();
const contasController = require('../controllers/contasController');
const authMiddleware = require('../authMiddleware');

router.get('/', authMiddleware, contasController.obterContasVinculadas);
router.post('/vincular', authMiddleware, contasController.vincularConta);

module.exports = router;