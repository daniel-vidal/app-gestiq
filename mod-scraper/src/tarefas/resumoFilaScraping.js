require('dotenv').config();

const pool = require('../db/pool');

async function buscarResumoPorStatus() {
  const sql = `
    SELECT
      status,
      COUNT(*)::int AS quantidade
    FROM mod_scraper.scraping_tarefas
    GROUP BY status
    ORDER BY status
  `;

  const { rows } = await pool.query(sql);
  return rows;
}

async function buscarQuantidadeElegiveisAgora() {
  const sql = `
    SELECT COUNT(*)::int AS quantidade
    FROM mod_scraper.scraping_tarefas t
    JOIN mod_scraper.hoteis_monitorados h
      ON h.id = t.hotel_id
    WHERE t.status = 'pendente'
      AND COALESCE(t.agendada_para, NOW()) <= NOW()
      AND COALESCE(t.tentativas, 0) < COALESCE(t.max_tentativas, 3)
      AND h.ativo = TRUE
  `;

  const { rows } = await pool.query(sql);
  return rows[0]?.quantidade ?? 0;
}

async function buscarUltimasTarefasCriadas(limite = 10) {
  const sql = `
    SELECT
      t.id,
      t.status,
      t.hotel_id,
      h.nome AS hotel_nome,
      t.mes_referencia,
      t.agendada_para,
      t.tentativas,
      t.max_tentativas,
      t.criada_em
    FROM mod_scraper.scraping_tarefas t
    JOIN mod_scraper.hoteis_monitorados h
      ON h.id = t.hotel_id
    ORDER BY t.criada_em DESC, t.id DESC
    LIMIT $1
  `;

  const { rows } = await pool.query(sql, [limite]);
  return rows;
}

async function buscarUltimasFinalizadas(limite = 10) {
  const sql = `
    SELECT
      t.id,
      t.status,
      t.hotel_id,
      h.nome AS hotel_nome,
      t.mes_referencia,
      t.agendada_para,
      t.iniciada_em,
      t.finalizada_em,
      t.worker_nome,
      t.tentativas
    FROM mod_scraper.scraping_tarefas t
    JOIN mod_scraper.hoteis_monitorados h
      ON h.id = t.hotel_id
    WHERE t.finalizada_em IS NOT NULL
    ORDER BY t.finalizada_em DESC, t.id DESC
    LIMIT $1
  `;

  const { rows } = await pool.query(sql, [limite]);
  return rows;
}

async function buscarUltimosErros(limite = 10) {
  const sql = `
    SELECT
      t.id,
      t.status,
      t.hotel_id,
      h.nome AS hotel_nome,
      t.mes_referencia,
      t.agendada_para,
      t.finalizada_em,
      t.worker_nome,
      t.erro_resumo
    FROM mod_scraper.scraping_tarefas t
    JOIN mod_scraper.hoteis_monitorados h
      ON h.id = t.hotel_id
    WHERE t.status = 'erro'
    ORDER BY t.finalizada_em DESC NULLS LAST, t.id DESC
    LIMIT $1
  `;

  const { rows } = await pool.query(sql, [limite]);
  return rows;
}

async function buscarPendentesMaisAntigas(limite = 10) {
  const sql = `
    SELECT
      t.id,
      t.hotel_id,
      h.nome AS hotel_nome,
      t.mes_referencia,
      t.agendada_para,
      t.prioridade,
      t.tentativas,
      t.max_tentativas,
      t.criada_em
    FROM mod_scraper.scraping_tarefas t
    JOIN mod_scraper.hoteis_monitorados h
      ON h.id = t.hotel_id
    WHERE t.status = 'pendente'
    ORDER BY
      t.agendada_para ASC,
      t.prioridade ASC,
      t.id ASC
    LIMIT $1
  `;

  const { rows } = await pool.query(sql, [limite]);
  return rows;
}

async function resumoFilaScraping(opcoes = {}) {
  const limite = Number(opcoes.limite ?? 10);

  const [
    resumoStatus,
    elegiveisAgora,
    ultimasCriadas,
    ultimasFinalizadas,
    ultimosErros,
    pendentesMaisAntigas
  ] = await Promise.all([
    buscarResumoPorStatus(),
    buscarQuantidadeElegiveisAgora(),
    buscarUltimasTarefasCriadas(limite),
    buscarUltimasFinalizadas(limite),
    buscarUltimosErros(limite),
    buscarPendentesMaisAntigas(limite)
  ]);

  return {
    ok: true,
    gerado_em: new Date().toISOString(),
    elegiveis_agora: elegiveisAgora,
    por_status: resumoStatus,
    pendentes_mais_antigas: pendentesMaisAntigas,
    ultimas_criadas: ultimasCriadas,
    ultimas_finalizadas: ultimasFinalizadas,
    ultimos_erros: ultimosErros
  };
}

module.exports = {
  resumoFilaScraping
};

if (require.main === module) {
  (async () => {
    const resultado = await resumoFilaScraping({
      limite: 10
    });

    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.ok ? 0 : 1);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}