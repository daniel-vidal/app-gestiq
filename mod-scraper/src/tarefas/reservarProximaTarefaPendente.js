require('dotenv').config();

const pool = require('../db/pool');

async function reservarProximaTarefaPendente(opcoes = {}) {
  const client = await pool.connect();
  const workerNome = opcoes.workerNome || 'worker-sem-nome';

  try {
    await client.query('BEGIN');

    const sql = `
      WITH proxima AS (
        SELECT t.id
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
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE mod_scraper.scraping_tarefas t
      SET
        status = 'processando',
        tentativas = COALESCE(t.tentativas, 0) + 1,
        iniciada_em = NOW(),
        finalizada_em = NULL,
        worker_nome = $1,
        erro_resumo = NULL,
        atualizada_em = NOW()
      FROM proxima
      WHERE t.id = proxima.id
      RETURNING t.*;
    `;

    const { rows } = await client.query(sql, [workerNome]);

    if (rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const tarefa = rows[0];

    const sqlHotel = `
      SELECT
        h.nome AS hotel_nome,
        h.url_booking,
        h.ativo AS hotel_ativo
      FROM mod_scraper.hoteis_monitorados h
      WHERE h.id = $1
      LIMIT 1
    `;

    const { rows: hotelRows } = await client.query(sqlHotel, [tarefa.hotel_id]);
    const hotel = hotelRows[0] || {};

    await client.query('COMMIT');

    return {
      ...tarefa,
      hotel_nome: hotel.hotel_nome || null,
      url_booking: hotel.url_booking || null,
      hotel_ativo: hotel.hotel_ativo ?? null
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  reservarProximaTarefaPendente
};

if (require.main === module) {
  (async () => {
    const tarefa = await reservarProximaTarefaPendente({
      workerNome: 'reserva-manual'
    });

    console.log(JSON.stringify(tarefa, null, 2));
    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}