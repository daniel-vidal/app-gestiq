const pool = require('../db/pool');

async function buscarProximaTarefaPendente(clientExterno = null) {
  const client = clientExterno || await pool.connect();

  try {
    const sql = `
      SELECT
        t.*,
        h.nome AS hotel_nome,
        h.url_booking,
        h.ativo AS hotel_ativo
      FROM mod_scraper.scraping_tarefas t
      INNER JOIN mod_scraper.hoteis_monitorados h
        ON h.id = t.hotel_id
      WHERE t.status = 'pendente'
        AND COALESCE(t.agendada_para, NOW()) <= NOW()
        AND COALESCE(t.tentativas, 0) < COALESCE(t.max_tentativas, 3)
        AND h.ativo = TRUE
      ORDER BY
        t.prioridade ASC,
        t.agendada_para ASC,
        t.id ASC
      LIMIT 1
    `;

    const { rows } = await client.query(sql);
    return rows[0] || null;
  } finally {
    if (!clientExterno) {
      client.release();
    }
  }
}

module.exports = {
  buscarProximaTarefaPendente
};

if (require.main === module) {
  (async () => {
    const tarefa = await buscarProximaTarefaPendente();
    console.log(JSON.stringify(tarefa, null, 2));
    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}