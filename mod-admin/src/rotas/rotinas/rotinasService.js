const pool = require('../../db/pool');

async function listar(filtros = {}) {
  const condicoes = [];
  const valores = [];
  let idx = 1;

  if (filtros.ativo !== undefined) {
    condicoes.push(`ativo = $${idx++}`);
    valores.push(filtros.ativo);
  }

  if (filtros.tipo_rotina) {
    condicoes.push(`tipo_rotina = $${idx++}`);
    valores.push(filtros.tipo_rotina);
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';

  const sql = `
    SELECT *
    FROM mod_scraper.rotinas_agendadas
    ${where}
    ORDER BY prioridade ASC, nome ASC
  `;

  const { rows } = await pool.query(sql, valores);
  return rows;
}

async function buscarPorId(id) {
  const sql = `
    SELECT *
    FROM mod_scraper.rotinas_agendadas
    WHERE id = $1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

async function criar(dados) {
  const sql = `
    INSERT INTO mod_scraper.rotinas_agendadas (
      nome, tipo_rotina, ativo, script_gerador, parametros_json,
      frequencia_tipo, frequencia_valor, hora_inicio, hora_fim,
      dias_semana, prioridade
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;
  const valores = [
    dados.nome,
    dados.tipo_rotina,
    dados.ativo !== undefined ? dados.ativo : true,
    dados.script_gerador,
    dados.parametros_json !== undefined ? dados.parametros_json : {},
    dados.frequencia_tipo,
    dados.frequencia_valor !== undefined ? dados.frequencia_valor : 1,
    dados.hora_inicio || null,
    dados.hora_fim || null,
    dados.dias_semana || null,
    dados.prioridade !== undefined ? dados.prioridade : 5,
  ];
  const { rows } = await pool.query(sql, valores);
  return rows[0];
}

async function atualizar(id, dados) {
  const campos = [];
  const valores = [];
  let idx = 1;

  if (dados.nome !== undefined)            { campos.push(`nome = $${idx++}`);             valores.push(dados.nome); }
  if (dados.tipo_rotina !== undefined)     { campos.push(`tipo_rotina = $${idx++}`);      valores.push(dados.tipo_rotina); }
  if (dados.script_gerador !== undefined)  { campos.push(`script_gerador = $${idx++}`);   valores.push(dados.script_gerador); }
  if (dados.parametros_json !== undefined) { campos.push(`parametros_json = $${idx++}`);  valores.push(dados.parametros_json); }
  if (dados.frequencia_tipo !== undefined) { campos.push(`frequencia_tipo = $${idx++}`);  valores.push(dados.frequencia_tipo); }
  if (dados.frequencia_valor !== undefined){ campos.push(`frequencia_valor = $${idx++}`); valores.push(dados.frequencia_valor); }
  if (dados.hora_inicio !== undefined)     { campos.push(`hora_inicio = $${idx++}`);      valores.push(dados.hora_inicio); }
  if (dados.hora_fim !== undefined)        { campos.push(`hora_fim = $${idx++}`);         valores.push(dados.hora_fim); }
  if (dados.dias_semana !== undefined)     { campos.push(`dias_semana = $${idx++}`);      valores.push(dados.dias_semana); }
  if (dados.prioridade !== undefined)      { campos.push(`prioridade = $${idx++}`);       valores.push(dados.prioridade); }
  if (dados.ativo !== undefined)           { campos.push(`ativo = $${idx++}`);            valores.push(dados.ativo); }

  if (campos.length === 0) return null;

  campos.push(`atualizada_em = NOW()`);
  valores.push(id);

  const sql = `
    UPDATE mod_scraper.rotinas_agendadas
    SET ${campos.join(', ')}
    WHERE id = $${idx}
    RETURNING *
  `;

  const { rows } = await pool.query(sql, valores);
  return rows[0] || null;
}

async function alterarAtivo(id, ativo) {
  const sql = `
    UPDATE mod_scraper.rotinas_agendadas
    SET ativo = $2, atualizada_em = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id, ativo]);
  return rows[0] || null;
}

async function executarAgora(id) {
  const sql = `
    UPDATE mod_scraper.rotinas_agendadas
    SET proxima_execucao_em = NOW(), atualizada_em = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

async function listarExecucoes(id, limite = 20) {
  const sql = `
    SELECT *
    FROM mod_scraper.rotinas_agendadas_execucoes
    WHERE rotina_id = $1
    ORDER BY executada_em DESC
    LIMIT $2
  `;
  const { rows } = await pool.query(sql, [id, limite]);
  return rows;
}

module.exports = { listar, buscarPorId, criar, atualizar, alterarAtivo, executarAgora, listarExecucoes };
