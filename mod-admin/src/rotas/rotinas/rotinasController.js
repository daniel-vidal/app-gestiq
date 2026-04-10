const rotinasService = require('./rotinasService');
const auditoria = require('../../servicos/auditoria');

const FREQUENCIA_TIPOS_VALIDOS = ['minutos', 'horas', 'diaria', 'semanal', 'mensal'];

async function listar(req, res) {
  const filtros = {
    ativo: req.query.ativo !== undefined ? req.query.ativo === 'true' : undefined,
    tipo_rotina: req.query.tipo_rotina || undefined,
  };

  const rotinas = await rotinasService.listar(filtros);
  return res.json({ rotinas });
}

async function buscarPorId(req, res) {
  const rotina = await rotinasService.buscarPorId(req.params.id);

  if (!rotina) {
    return res.status(404).json({ erro: 'Rotina não encontrada.' });
  }

  return res.json({ rotina });
}

async function criar(req, res) {
  const {
    nome, tipo_rotina, ativo, script_gerador, parametros_json,
    frequencia_tipo, frequencia_valor, hora_inicio, hora_fim,
    dias_semana, prioridade,
  } = req.body;

  if (!nome || !tipo_rotina || !script_gerador || !frequencia_tipo) {
    return res.status(400).json({ erro: 'nome, tipo_rotina, script_gerador e frequencia_tipo são obrigatórios.' });
  }

  if (!FREQUENCIA_TIPOS_VALIDOS.includes(frequencia_tipo)) {
    return res.status(400).json({ erro: `frequencia_tipo deve ser um de: ${FREQUENCIA_TIPOS_VALIDOS.join(', ')}.` });
  }

  if (frequencia_valor !== undefined && frequencia_valor < 1) {
    return res.status(400).json({ erro: 'frequencia_valor deve ser maior que 0.' });
  }

  if (prioridade !== undefined && prioridade < 0) {
    return res.status(400).json({ erro: 'prioridade deve ser maior ou igual a 0.' });
  }

  const rotina = await rotinasService.criar({
    nome, tipo_rotina, ativo, script_gerador, parametros_json,
    frequencia_tipo, frequencia_valor, hora_inicio, hora_fim,
    dias_semana, prioridade,
  });

  await auditoria.registrar({
    usuario_id: req.usuario.id,
    entidade: 'rotinas_agendadas',
    entidade_id: rotina.id,
    schema_origem: 'mod_scraper',
    acao: 'criar',
    dados_antes: null,
    dados_depois: rotina,
    ip: req.ip,
  });

  return res.status(201).json({ rotina });
}

async function atualizar(req, res) {
  const antes = await rotinasService.buscarPorId(req.params.id);

  if (!antes) {
    return res.status(404).json({ erro: 'Rotina não encontrada.' });
  }

  const {
    nome, tipo_rotina, ativo, script_gerador, parametros_json,
    frequencia_tipo, frequencia_valor, hora_inicio, hora_fim,
    dias_semana, prioridade,
  } = req.body;

  if (frequencia_tipo !== undefined && !FREQUENCIA_TIPOS_VALIDOS.includes(frequencia_tipo)) {
    return res.status(400).json({ erro: `frequencia_tipo deve ser um de: ${FREQUENCIA_TIPOS_VALIDOS.join(', ')}.` });
  }

  if (frequencia_valor !== undefined && frequencia_valor < 1) {
    return res.status(400).json({ erro: 'frequencia_valor deve ser maior que 0.' });
  }

  if (prioridade !== undefined && prioridade < 0) {
    return res.status(400).json({ erro: 'prioridade deve ser maior ou igual a 0.' });
  }

  const rotina = await rotinasService.atualizar(req.params.id, {
    nome, tipo_rotina, ativo, script_gerador, parametros_json,
    frequencia_tipo, frequencia_valor, hora_inicio, hora_fim,
    dias_semana, prioridade,
  });

  if (!rotina) {
    return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
  }

  await auditoria.registrar({
    usuario_id: req.usuario.id,
    entidade: 'rotinas_agendadas',
    entidade_id: rotina.id,
    schema_origem: 'mod_scraper',
    acao: 'atualizar',
    dados_antes: antes,
    dados_depois: rotina,
    ip: req.ip,
  });

  return res.json({ rotina });
}

async function alterarAtivo(req, res) {
  const antes = await rotinasService.buscarPorId(req.params.id);

  if (!antes) {
    return res.status(404).json({ erro: 'Rotina não encontrada.' });
  }

  const { ativo } = req.body;

  if (typeof ativo !== 'boolean') {
    return res.status(400).json({ erro: 'Campo "ativo" (boolean) é obrigatório.' });
  }

  const rotina = await rotinasService.alterarAtivo(req.params.id, ativo);

  await auditoria.registrar({
    usuario_id: req.usuario.id,
    entidade: 'rotinas_agendadas',
    entidade_id: rotina.id,
    schema_origem: 'mod_scraper',
    acao: ativo ? 'ativar' : 'desativar',
    dados_antes: antes,
    dados_depois: rotina,
    ip: req.ip,
  });

  return res.json({ rotina });
}

async function executarAgora(req, res) {
  const antes = await rotinasService.buscarPorId(req.params.id);

  if (!antes) {
    return res.status(404).json({ erro: 'Rotina não encontrada.' });
  }

  const rotina = await rotinasService.executarAgora(req.params.id);

  await auditoria.registrar({
    usuario_id: req.usuario.id,
    entidade: 'rotinas_agendadas',
    entidade_id: rotina.id,
    schema_origem: 'mod_scraper',
    acao: 'executar_agora',
    dados_antes: antes,
    dados_depois: rotina,
    ip: req.ip,
  });

  return res.json({ rotina });
}

async function listarExecucoes(req, res) {
  const rotina = await rotinasService.buscarPorId(req.params.id);

  if (!rotina) {
    return res.status(404).json({ erro: 'Rotina não encontrada.' });
  }

  const limite = req.query.limite ? Number(req.query.limite) : 20;
  const execucoes = await rotinasService.listarExecucoes(req.params.id, limite);

  return res.json({ execucoes });
}

module.exports = { listar, buscarPorId, criar, atualizar, alterarAtivo, executarAgora, listarExecucoes };
