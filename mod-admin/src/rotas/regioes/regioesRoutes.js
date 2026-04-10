const { Router } = require('express');
const regioesController = require('./regioesController');
const { autenticar, autorizar } = require('../../auth/authMiddleware');

const router = Router();

// GET    /api/admin/regioes          — listar (operador+)
router.get('/', autenticar, autorizar('operador'), regioesController.listar);

// GET    /api/admin/regioes/:id      — buscar por id (operador+)
router.get('/:id', autenticar, autorizar('operador'), regioesController.buscarPorId);

// POST   /api/admin/regioes          — criar (gerente+)
router.post('/', autenticar, autorizar('gerente'), regioesController.criar);

// PUT    /api/admin/regioes/:id      — atualizar (gerente+)
router.put('/:id', autenticar, autorizar('gerente'), regioesController.atualizar);

// PATCH  /api/admin/regioes/:id/status — ativar/desativar (admin)
router.patch('/:id/status', autenticar, autorizar('admin'), regioesController.alterarStatus);

module.exports = router;
