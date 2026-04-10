const { Router } = require('express');
const { autenticar, autorizar } = require('../../auth/authMiddleware');
const ctrl = require('./rotinasController');

const router = Router();

router.use(autenticar);

router.get('/',                    autorizar('operador'), ctrl.listar);
router.get('/:id',                 autorizar('operador'), ctrl.buscarPorId);
router.get('/:id/execucoes',       autorizar('operador'), ctrl.listarExecucoes);
router.post('/',                   autorizar('gerente'),  ctrl.criar);
router.put('/:id',                 autorizar('gerente'),  ctrl.atualizar);
router.patch('/:id/ativo',         autorizar('gerente'),  ctrl.alterarAtivo);
router.post('/:id/executar',       autorizar('gerente'),  ctrl.executarAgora);

module.exports = router;
