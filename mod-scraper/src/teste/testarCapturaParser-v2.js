// src/teste/testarCapturaParser-v2.js
// node src/teste/testarCapturaParser-v2.js "https://m.booking.com/hotel/br/b.pt-br.html?checkin=2026-04-01&checkout=2026-04-02&group_adults=2&group_children=0"

const fs = require('fs');
const path = require('path');

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

function garantirDiretorio(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function salvarJson(caminhoArquivo, dados) {
  fs.writeFileSync(caminhoArquivo, JSON.stringify(dados, null, 2), 'utf8');
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
    });

    const tarefa = montarTarefaFake(resultadoCaptura);

    const tarifas = transformarCapturaBookingEmTarifas({
      tarefa,
      resultadoCaptura
    });

    const pastaDebug = path.resolve(__dirname, '../../debug/booking');
    garantirDiretorio(pastaDebug);

    const arquivoCaptura = path.join(pastaDebug, 'resultado_captura.json');
    const arquivoTarefa = path.join(pastaDebug, 'tarefa_fake.json');
    const arquivoTarifas = path.join(pastaDebug, 'tarifas_transformadas.json');

    salvarJson(arquivoCaptura, resultadoCaptura);
    salvarJson(arquivoTarefa, tarefa);
    salvarJson(arquivoTarifas, tarifas);

    console.log('\n=== TESTE CAPTURA -> PARSER OK ===\n');
    console.log(`Status captura: ${resultadoCaptura.status}`);
    console.log(`Qtde dias no calendário: ${resultadoCaptura.calendario?.length || 0}`);
    console.log(`Qtde tarifas transformadas: ${tarifas.length}`);

    console.log('\nArquivos gerados:');
    console.log(`- ${arquivoCaptura}`);
    console.log(`- ${arquivoTarefa}`);
    console.log(`- ${arquivoTarifas}`);

    if (tarifas.length > 0) {
      console.log('\n=== PRIMEIRA TARIFA ===\n');
      console.log(JSON.stringify(tarifas[0], null, 2));
    }
  } catch (error) {
    console.error('\nErro no teste captura -> parser:\n');
    console.error(error);
    process.exit(1);
  }
})();