const express = require('express');
const router = express.Router();
const automacaoController = require('../controllers/automacaoController');
const authMiddleware = require('../authMiddleware');

router.patch('/', authMiddleware, automacaoController.listarAutomacoes);
router.post('/', authMiddleware, automacaoController.criarAutomacao);
router.delete('/:id', authMiddleware, automacaoController.deletarAutomacao);

module.exports = router;