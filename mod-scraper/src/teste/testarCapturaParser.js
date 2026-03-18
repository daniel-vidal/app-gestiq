// src/teste/testarCapturaParser.js
// node src/teste/testarCapturaParser.js "https://m.booking.com/hotel/br/b.pt-br.html?checkin=2026-04-01&checkout=2026-04-02&group_adults=2&group_children=0"

const { capturarTarifasCalendarioBooking } = require('../captura/captura_tarifas_calendario_booking');
const { transformarCapturaBookingEmTarifas } = require('../parser/transformarCapturaBookingEmTarifas');

function montarTarefaFake(resultadoCaptura) {
  const meta = resultadoCaptura?.meta || {};

  return {
    id: 1,
    hotel_id: 1,
    regiao_id: 1,
    mes_referencia: meta.checkin_ref
      ? `${meta.checkin_ref.slice(0, 7)}-01`
      : null,
    adultos: meta.adultos ?? 2,
    criancas: meta.criancas ?? 0,
    quantidade_noites: meta.periodo_estadia ?? 1,
    fonte: meta.fonte || 'booking_mobile'
  };
}

(async () => {
  try {
    const url = process.argv[2];

    if (!url) {
      console.log('Uso: node src/teste/testarCapturaParser.js "<URL_DA_BOOKING>"');
      process.exit(1);
    }

    const resultadoCaptura = await capturarTarifasCalendarioBooking(url, {
      debug: false
      // headless: false,
      // bloquearRecursos: false
    });

    console.log('\n=== RESULTADO BRUTO DA CAPTURA ===\n');
    console.log(JSON.stringify(resultadoCaptura, null, 2));

    const tarefa = montarTarefaFake(resultadoCaptura);

    console.log('\n=== TAREFA FAKE USADA NO TESTE ===\n');
    console.log(JSON.stringify(tarefa, null, 2));

    const tarifas = transformarCapturaBookingEmTarifas({
      tarefa,
      resultadoCaptura
    });

    console.log('\n=== TARIFAS TRANSFORMADAS ===\n');
    console.log(JSON.stringify(tarifas, null, 2));

    console.log('\n=== RESUMO ===\n');
    console.log(`Status captura: ${resultadoCaptura.status}`);
    console.log(`Qtde dias no calendário: ${resultadoCaptura.calendario?.length || 0}`);
    console.log(`Qtde tarifas transformadas: ${tarifas.length}`);

    if (tarifas.length > 0) {
      console.log('\n=== AMOSTRA PRIMEIRA TARIFA ===\n');
      console.log(JSON.stringify(tarifas[0], null, 2));
    }
  } catch (error) {
    console.error('\nErro no teste captura -> parser:\n');
    console.error(error);
    process.exit(1);
  }
})();