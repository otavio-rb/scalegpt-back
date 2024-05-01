const express = require('express');
const router = express.Router();
const conjuntoAnunciosController = require('../controllers/conjuntoAnunciosController');
const authMiddleware = require('../authMiddleware');

router.patch('/', authMiddleware, conjuntoAnunciosController.obterConjuntosAnuncio);
router.delete('/', authMiddleware, conjuntoAnunciosController.deletarConjuntoAnuncio);
router.post('/status', authMiddleware, conjuntoAnunciosController.atualizarStatusConjuntoAnuncio);
router.post('/duplicate', authMiddleware, conjuntoAnunciosController.duplicarConjuntoAnuncio);

module.exports = router;

