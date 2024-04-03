const express = require('express');
const router = express.Router();
const contasController = require('../controllers/contasController');
const authMiddleware = require('../authMiddleware');

router.get('/', authMiddleware, contasController.obterContasVinculadas);

module.exports = router;