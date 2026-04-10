const pool = require('../../db/pool');

async function listar(filtros = {}) {
  const condicoes = [];
  const valores = [];
  let idx = 1;

  if (filtros.ativo !== undefined) {
    condicoes.push(`h.ativo = $${idx++}`);
    valores.push(filtros.ativo);
  }

  if (filtros.regiao_id) {
    condicoes.push(`h.regiao_id = $${idx++}`);
    valores.push(filtros.regiao_id);
  }

  if (filtros.hotel_base !== undefined) {
    condicoes.push(`h.hotel_base = $${idx++}`);
    valores.push(filtros.hotel_base);
  }

  if (filtros.perfil_hotel) {
    condicoes.push(`h.perfil_hotel = $${idx++}`);
    valores.push(filtros.perfil_hotel);
  }

  if (filtros.busca) {
    condicoes.push(`h.nome ILIKE $${idx++}`);
    valores.push(`%${filtros.busca}%`);
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';

  const sql = `
    SELECT
      h.*,
      r.nome AS regiao_nome,
      r.cidade AS regiao_cidade,
      r.estado AS regiao_estado
    FROM mod_scraper.hoteis_monitorados h
    LEFT JOIN mod_scraper.regioes r ON r.id = h.regiao_id
    ${where}
    ORDER BY h.prioridade_monitoramento ASC, h.nome ASC
  `;

  const { rows } = await pool.query(sql, valores);
  return rows;
}

async function buscarPorId(id) {
  const sql = `
    SELECT
      h.*,
      r.nome AS regiao_nome,
      r.cidade AS regiao_cidade,
      r.estado AS regiao_estado,
      jv.meses_a_venda_estimado,
      jv.ultimo_mes_com_preco,
      jv.aparenta_inativo_booking,
      jv.ultima_analise_em AS janela_ultima_analise_em
    FROM mod_scraper.hoteis_monitorados h
    LEFT JOIN mod_scraper.regioes r ON r.id = h.regiao_id
    LEFT JOIN mod_scraper.hoteis_janela_venda jv ON jv.hotel_id = h.id
    WHERE h.id = $1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

async function criar(dados) {
  const sql = `
    INSERT INTO mod_scraper.hoteis_monitorados (
      nome, regiao_id, categoria_estrelas, perfil_hotel,
      url_booking, ativo, prioridade_monitoramento,
      hotel_base, observacoes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  const valores = [
    dados.nome,
    dados.regiao_id,
    dados.categoria_estrelas || null,
    dados.perfil_hotel || null,
    dados.url_booking,
    dados.ativo !== undefined ? dados.ativo : true,
    dados.prioridade_monitoramento || 5,
    dados.hotel_base || false,
    dados.observacoes || null,
  ];
  const { rows } = await pool.query(sql, valores);
  return rows[0];
}

async function atualizar(id, dados) {
  const campos = [];
  const valores = [];
  let idx = 1;

  if (dados.nome !== undefined) { campos.push(`nome = $${idx++}`); valores.push(dados.nome); }
  if (dados.regiao_id !== undefined) { campos.push(`regiao_id = $${idx++}`); valores.push(dados.regiao_id); }
  if (dados.categoria_estrelas !== undefined) { campos.push(`categoria_estrelas = $${idx++}`); valores.push(dados.categoria_estrelas); }
  if (dados.perfil_hotel !== undefined) { campos.push(`perfil_hotel = $${idx++}`); valores.push(dados.perfil_hotel); }
  if (dados.url_booking !== undefined) { campos.push(`url_booking = $${idx++}`); valores.push(dados.url_booking); }
  if (dados.prioridade_monitoramento !== undefined) { campos.push(`prioridade_monitoramento = $${idx++}`); valores.push(dados.prioridade_monitoramento); }
  if (dados.hotel_base !== undefined) { campos.push(`hotel_base = $${idx++}`); valores.push(dados.hotel_base); }
  if (dados.observacoes !== undefined) { campos.push(`observacoes = $${idx++}`); valores.push(dados.observacoes); }

  if (campos.length === 0) return null;

  campos.push(`atualizada_em = NOW()`);
  valores.push(id);

  const sql = `
    UPDATE mod_scraper.hoteis_monitorados
    SET ${campos.join(', ')}
    WHERE id = $${idx}
    RETURNING *
  `;

  const { rows } = await pool.query(sql, valores);
  return rows[0] || null;
}

async function alterarStatus(id, ativo) {
  const sql = `
    UPDATE mod_scraper.hoteis_monitorados
    SET ativo = $2, atualizada_em = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id, ativo]);
  return rows[0] || null;
}

module.exports = { listar, buscarPorId, criar, atualizar, alterarStatus };
