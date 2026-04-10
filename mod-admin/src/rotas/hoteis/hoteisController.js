const hoteisService = require('./hoteisService');
const auditoria = require('../../servicos/auditoria');

async function listar(req, res) {
  const filtros = {
    ativo: req.query.ativo !== undefined ? req.query.ativo === 'true' : undefined,
    regiao_id: req.query.regiao_id ? Number(req.query.regiao_id) : undefined,
    hotel_base: req.query.hotel_base !== undefined ? req.query.hotel_base === 'true' : undefined,
    perfil_hotel: req.query.perfil_hotel || undefined,
    busca: req.query.busca || undefined,
  };

  const hoteis = await hoteisService.listar(filtros);
  return res.json({ hoteis });
}

async function buscarPorId(req, res) {
  const hotel = await hoteisService.buscarPorId(req.params.id);

  if (!hotel) {
    return res.status(404).json({ erro: 'Hotel não encontrado.' });
  }

  return res.json({ hotel });
}

async function criar(req, res) {
  const {
    nome, regiao_id, categoria_estrelas, perfil_hotel,
    url_booking, ativo, prioridade_monitoramento,
    hotel_base, observacoes,
  } = req.body;

  if (!nome || !regiao_id || !url_booking) {
    return res.status(400).json({ erro: 'Nome, regiao_id e url_booking são obrigatórios.' });
  }

  if (categoria_estrelas !== undefined && (categoria_estrelas < 1 || categoria_estrelas > 5)) {
    return res.status(400).json({ erro: 'Categoria de estrelas deve ser entre 1 e 5.' });
  }

  let hotel;
  try {
    hotel = await hoteisService.criar({
      nome, regiao_id, categoria_estrelas, perfil_hotel,
      url_booking, ativo, prioridade_monitoramento,
      hotel_base, observacoes,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um hotel com esta URL de Booking.' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ erro: 'Região informada não existe.' });
    }
    throw err;
  }

  await auditoria.registrar({
    usuario_id: req.usuario.id,
    entidade: 'hoteis_monitorados',
    entidade_id: hotel.id,
    schema_origem: 'mod_scraper',
    acao: 'criar',
    dados_antes: null,
    dados_depois: hotel,
    ip: req.ip,
  });

  return res.status(201).json({ hotel });
}

async function atualizar(req, res) {
  const antes = await hoteisService.buscarPorId(req.params.id);

  if (!antes) {
    return res.status(404).json({ erro: 'Hotel não encontrado.' });
  }

  const {
    nome, regiao_id, categoria_estrelas, perfil_hotel,
    url_booking, prioridade_monitoramento,
    hotel_base, observacoes,
  } = req.body;

  if (categoria_estrelas !== undefined && (categoria_estrelas < 1 || categoria_estrelas > 5)) {
    return res.status(400).json({ erro: 'Categoria de estrelas deve ser entre 1 e 5.' });
  }

  let hotel;
  try {
    hotel = await hoteisService.atualizar(req.params.id, {
      nome, regiao_id, categoria_estrelas, perfil_hotel,
      url_booking, prioridade_monitoramento,
      hotel_base, observacoes,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um hotel com esta URL de Booking.' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ erro: 'Região informada não existe.' });
    }
    throw err;
  }

  if (!hotel) {
    return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
  }

  await auditoria.registrar({
    usuario_id: req.usuario.id,
    entidade: 'hoteis_monitorados',
    entidade_id: hotel.id,
    schema_origem: 'mod_scraper',
    acao: 'atualizar',
    dados_antes: antes,
    dados_depois: hotel,
    ip: req.ip,
  });

  return res.json({ hotel });
}

async function alterarStatus(req, res) {
  const antes = await hoteisService.buscarPorId(req.params.id);

  if (!antes) {
    return res.status(404).json({ erro: 'Hotel não encontrado.' });
  }

  const ativo = req.body.ativo;

  if (typeof ativo !== 'boolean') {
    return res.status(400).json({ erro: 'Campo "ativo" (boolean) é obrigatório.' });
  }

  const hotel = await hoteisService.alterarStatus(req.params.id, ativo);

  await auditoria.registrar({
    usuario_id: req.usuario.id,
    entidade: 'hoteis_monitorados',
    entidade_id: hotel.id,
    schema_origem: 'mod_scraper',
    acao: ativo ? 'ativar' : 'desativar',
    dados_antes: antes,
    dados_depois: hotel,
    ip: req.ip,
  });

  return res.json({ hotel });
}

module.exports = { listar, buscarPorId, criar, atualizar, alterarStatus };
