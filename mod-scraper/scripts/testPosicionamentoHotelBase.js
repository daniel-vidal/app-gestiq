#!/usr/bin/env node
// scripts/testPosicionamentoHotelBase.js
const pool = require('../src/db/pool');
const { buscarTarifasComparaveis, calcularIndicadoresPosicionamento } = require('../src/consulta/posicionamentoHotelBase');

(async () => {
  try {
    const checkin = '2026-06-01';
    // Do not force hotelBaseId here; buscarTarifasComparaveis will find the hotel_base if present
    const { comparaveis, base } = await buscarTarifasComparaveis(pool, {
      checkin,
      adultos: 2,
      criancas: 0,
      fonte: 'booking_mobile'
    });

    const indicadores = calcularIndicadoresPosicionamento(comparaveis, base);
    console.log('Resultado posicionamento:');
    console.log(JSON.stringify({ checkin, hotelBaseId: base ? base.hotel_id : null, indicadores, comparaveis_count: comparaveis.length, base_present: !!base }, null, 2));
  } catch (err) {
    console.error('Erro no teste de posicionamento:', err && err.stack ? err.stack : err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
