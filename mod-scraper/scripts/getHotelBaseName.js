#!/usr/bin/env node
// scripts/getHotelBaseName.js
const pool = require('../src/db/pool');

(async () => {
  try {
    const sql = `
      SELECT id, nome
      FROM mod_scraper.hoteis_monitorados
      WHERE hotel_base = TRUE AND ativo = TRUE
      ORDER BY prioridade_monitoramento ASC, id ASC
      LIMIT 1
    `;

    const { rows } = await pool.query(sql);
    if (!rows || rows.length === 0) {
      console.log('Nenhum hotel_base encontrado.');
    } else {
      const h = rows[0];
      console.log(JSON.stringify({ id: h.id, nome: h.nome }, null, 2));
    }
  } catch (err) {
    console.error('Erro ao buscar hotel_base:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
