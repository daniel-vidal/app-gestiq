require('dotenv').config();

const pool = require('../db/pool');

async function buscarRotinasVencidas(opcoes = {}) {
  const debug = Boolean(opcoes.debug);

  const sql = `
    SELECT
      id,
      nome,
      tipo_rotina,
      ativo,
      script_gerador,
      parametros_json,
      frequencia_tipo,
      frequencia_valor,
      hora_inicio,
      hora_fim,
      dias_semana,
      prioridade,
      ultima_execucao_em,
      proxima_execucao_em,
      total_execucoes,
      total_dias_execucao,
      criado_em,
      atualizada_em
    FROM mod_scraper.rotinas_agendadas
    WHERE ativo = TRUE
      AND (
        proxima_execucao_em IS NULL
        OR proxima_execucao_em <= NOW()
      )
    ORDER BY prioridade ASC, id ASC
  `;

  const { rows } = await pool.query(sql);

  if (debug) {
    console.log(`[agendador] buscarRotinasVencidas -> ${rows.length} rotina(s) encontrada(s)`);
  }

  return rows;
}

module.exports = { buscarRotinasVencidas };