const { Router } = require('express');
const { autenticar, autorizar } = require('../../auth/authMiddleware');
const ctrl = require('./hoteisController');

const router = Router();

router.use(autenticar);

router.get('/',      autorizar('operador'), ctrl.listar);
router.get('/:id',   autorizar('operador'), ctrl.buscarPorId);
router.post('/',     autorizar('gerente'),  ctrl.criar);
router.put('/:id',   autorizar('gerente'),  ctrl.atualizar);
router.patch('/:id/status', autorizar('admin'), ctrl.alterarStatus);

module.exports = router;
