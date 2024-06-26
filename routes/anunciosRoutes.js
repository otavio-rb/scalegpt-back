const express = require('express');
const router = express.Router();
const anunciosController = require('../controllers/anunciosController');
const authMiddleware = require('../authMiddleware');

router.patch('/', authMiddleware, anunciosController.obterAnuncios);
router.delete('/', authMiddleware, anunciosController.deletarAnuncio);
router.patch('/status', authMiddleware, anunciosController.atualizarStatusAnuncio);

module.exports = router;