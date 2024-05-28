const express = require('express');
const router = express.Router();
const campanhasController = require('../controllers/campanhasController');
const authMiddleware = require('../authMiddleware');

router.patch('/', authMiddleware, campanhasController.obterCampanhas);
router.delete('/', authMiddleware, campanhasController.deletarCampanha);
router.patch('/status', authMiddleware, campanhasController.atualizarStatusCampanha);
router.post('/duplicate', authMiddleware, campanhasController.duplicarCampanha);

module.exports = router;

