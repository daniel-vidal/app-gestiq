#!/usr/bin/env node
// scripts/testObterComparacaoTarifa.js
// Uso: node scripts/testObterComparacaoTarifa.js <hotel_id> <checkin> <checkout> [adultos] [criancas] [fonte]
// node mod-scraper/scripts/testObterComparacaoTarifa.js 123 2026-05-01 2026-05-02 2 0 booking_mobile

const pool = require('../src/db/pool');
const { obterComparacaoTarifa } = require('../src/consulta/obterComparacaoTarifa');

async function main() {
  const [, , hotelId, checkin, checkout, adultos = '2', criancas = '0', fonte = 'booking_mobile'] = process.argv;

  if (!hotelId || !checkin || !checkout) {
    console.log('Uso: node scripts/testObterComparacaoTarifa.js <hotel_id> <checkin> <checkout> [adultos] [criancas] [fonte]');
    process.exit(1);
  }

  try {
    const result = await obterComparacaoTarifa(pool, {
      hotel_id: hotelId,
      checkin,
      checkout,
      adultos: Number(adultos),
      criancas: Number(criancas),
      fonte
    });

    console.log('Resultado:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Erro ao executar teste:', err && err.message ? err.message : err);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
}

main();
