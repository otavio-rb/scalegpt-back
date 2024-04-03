const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../authMiddleware')

router.post('/login', authController.login);
router.post('/cadastro', authController.cadastrarUsuario);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
