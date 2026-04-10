const regioesService = require('./regioesService');
const auditoria = require('../../servicos/auditoria');

async function listar(req, res) {
  const filtros = {
    ativa: req.query.ativa !== undefined ? req.query.ativa === 'true' : undefined,
    estado: req.query.estado || undefined,
    busca: req.query.busca || undefined,
  };

  const regioes = await regioesService.listar(filtros);
  return res.json({ regioes });
}

async function buscarPorId(req, res) {
  const regiao = await regioesService.buscarPorId(req.params.id);

  if (!regiao) {
    return res.status(404).json({ erro: 'Região não encontrada.' });
  }

  return res.json({ regiao });
}

async function criar(req, res) {
  const { nome, cidade, estado, tipo_regiao, ativa } = req.body;

  if (!nome || !cidade || !estado) {
    return res.status(400).json({ erro: 'Nome, cidade e estado são obrigatórios.' });
  }

  if (estado.length !== 2) {
    return res.status(400).json({ erro: 'Estado deve ter exatamente 2 caracteres (UF).' });
  }

  let regiao;
  try {
    regiao = await regioesService.criar({ nome, cidade, estado, tipo_regiao, ativa });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe uma região com este nome, cidade e estado.' });
    }
    throw err;
  }

  await auditoria.registrar({
    usuario_id: req.usuario.id,
    entidade: 'regioes',
    entidade_id: regiao.id,
    schema_origem: 'mod_scraper',
    acao: 'criar',
    dados_antes: null,
    dados_depois: regiao,
    ip: req.ip,
  });

  return res.status(201).json({ regiao });
}

async function atualizar(req, res) {
  const antes = await regioesService.buscarPorId(req.params.id);

  if (!antes) {
    return res.status(404).json({ erro: 'Região não encontrada.' });
  }

  const { nome, cidade, estado, tipo_regiao } = req.body;

  if (estado !== undefined && estado.length !== 2) {
    return res.status(400).json({ erro: 'Estado deve ter exatamente 2 caracteres (UF).' });
  }

  let regiao;
  try {
    regiao = await regioesService.atualizar(req.params.id, { nome, cidade, estado, tipo_regiao });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe uma região com este nome, cidade e estado.' });
    }
    throw err;
  }

  if (!regiao) {
    return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
  }

  await auditoria.registrar({
    usuario_id: req.usuario.id,
    entidade: 'regioes',
    entidade_id: regiao.id,
    schema_origem: 'mod_scraper',
    acao: 'atualizar',
    dados_antes: antes,
    dados_depois: regiao,
    ip: req.ip,
  });

  return res.json({ regiao });
}

async function alterarStatus(req, res) {
  const antes = await regioesService.buscarPorId(req.params.id);

  if (!antes) {
    return res.status(404).json({ erro: 'Região não encontrada.' });
  }

  const ativa = req.body.ativa;

  if (typeof ativa !== 'boolean') {
    return res.status(400).json({ erro: 'Campo "ativa" (boolean) é obrigatório.' });
  }

  const regiao = await regioesService.alterarStatus(req.params.id, ativa);

  await auditoria.registrar({
    usuario_id: req.usuario.id,
    entidade: 'regioes',
    entidade_id: regiao.id,
    schema_origem: 'mod_scraper',
    acao: ativa ? 'ativar' : 'desativar',
    dados_antes: antes,
    dados_depois: regiao,
    ip: req.ip,
  });

  return res.json({ regiao });
}

module.exports = { listar, buscarPorId, criar, atualizar, alterarStatus };
