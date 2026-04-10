const { Router } = require('express');
const authController = require('./authController');
const { autenticar } = require('./authMiddleware');

const router = Router();

// POST /api/admin/auth/login — público
router.post('/login', authController.login);

// GET /api/admin/auth/me — autenticado
router.get('/me', autenticar, authController.me);

// PUT /api/admin/auth/me/senha — autenticado
router.put('/me/senha', autenticar, authController.alterarSenha);

module.exports = router;
