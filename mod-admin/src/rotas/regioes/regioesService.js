const pool = require('../../db/pool');

async function listar(filtros = {}) {
  const condicoes = [];
  const valores = [];
  let idx = 1;

  if (filtros.ativa !== undefined) {
    condicoes.push(`r.ativa = $${idx++}`);
    valores.push(filtros.ativa);
  }

  if (filtros.estado) {
    condicoes.push(`r.estado = $${idx++}`);
    valores.push(filtros.estado);
  }

  if (filtros.busca) {
    condicoes.push(`(r.nome ILIKE $${idx} OR r.cidade ILIKE $${idx})`);
    valores.push(`%${filtros.busca}%`);
    idx++;
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';

  const sql = `
    SELECT
      r.*,
      COUNT(h.id)::int AS total_hoteis
    FROM mod_scraper.regioes r
    LEFT JOIN mod_scraper.hoteis_monitorados h
      ON h.regiao_id = r.id AND h.ativo = TRUE
    ${where}
    GROUP BY r.id
    ORDER BY r.nome ASC
  `;

  const { rows } = await pool.query(sql, valores);
  return rows;
}

async function buscarPorId(id) {
  const sql = `
    SELECT
      r.*,
      COUNT(h.id)::int AS total_hoteis
    FROM mod_scraper.regioes r
    LEFT JOIN mod_scraper.hoteis_monitorados h
      ON h.regiao_id = r.id AND h.ativo = TRUE
    WHERE r.id = $1
    GROUP BY r.id
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

async function criar(dados) {
  const sql = `
    INSERT INTO mod_scraper.regioes (nome, cidade, estado, tipo_regiao, ativa)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const valores = [
    dados.nome,
    dados.cidade,
    dados.estado,
    dados.tipo_regiao || null,
    dados.ativa !== undefined ? dados.ativa : true,
  ];
  const { rows } = await pool.query(sql, valores);
  return rows[0];
}

async function atualizar(id, dados) {
  const campos = [];
  const valores = [];
  let idx = 1;

  if (dados.nome !== undefined) { campos.push(`nome = $${idx++}`); valores.push(dados.nome); }
  if (dados.cidade !== undefined) { campos.push(`cidade = $${idx++}`); valores.push(dados.cidade); }
  if (dados.estado !== undefined) { campos.push(`estado = $${idx++}`); valores.push(dados.estado); }
  if (dados.tipo_regiao !== undefined) { campos.push(`tipo_regiao = $${idx++}`); valores.push(dados.tipo_regiao); }
  if (dados.ativa !== undefined) { campos.push(`ativa = $${idx++}`); valores.push(dados.ativa); }

  if (campos.length === 0) return null;

  campos.push(`atualizada_em = NOW()`);
  valores.push(id);

  const sql = `
    UPDATE mod_scraper.regioes
    SET ${campos.join(', ')}
    WHERE id = $${idx}
    RETURNING *
  `;

  const { rows } = await pool.query(sql, valores);
  return rows[0] || null;
}

async function alterarStatus(id, ativa) {
  const sql = `
    UPDATE mod_scraper.regioes
    SET ativa = $2, atualizada_em = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id, ativa]);
  return rows[0] || null;
}

module.exports = { listar, buscarPorId, criar, atualizar, alterarStatus };
