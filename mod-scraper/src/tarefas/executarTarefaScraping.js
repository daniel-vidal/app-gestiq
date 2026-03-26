require('dotenv').config();

// node mod-scraper/src/tarefas/executarTarefaScraping.js <id> --debug
// para rodar basta criar uma tarefa válida na tabela mod_scraper.scraping_tarefas e passar o id aqui como argumento

const pool = require('../db/pool');

const {
  capturarTarifasCalendarioBooking
} = require('../captura/captura_tarifas_calendario_booking');

const {
  transformarCapturaBookingEmTarifas
} = require('../parser/transformarCapturaBookingEmTarifas');

const {
  persistirLoteTarifas
} = require('../persistencia/persistirLoteTarifas');

const STATUS = {
  PENDENTE: 'pendente',
  PROCESSANDO: 'processando',
  CONCLUIDA: 'concluida',
  ERRO: 'erro'
};

function resumirErro(err, limite = 2000) {
  const texto = err?.stack || err?.message || String(err);
  return texto.length > limite ? texto.slice(0, limite) : texto;
}

function formatarDataPartes(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function formatarDataISO(valor) {
  if (!valor) return null;

  if (typeof valor === 'string') {
    const texto = valor.trim();

    const matchIsoCurta = texto.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matchIsoCurta) {
      return matchIsoCurta[1];
    }
  }

  if (valor instanceof Date) {
    return formatarDataPartes(
      valor.getFullYear(),
      valor.getMonth() + 1,
      valor.getDate()
    );
  }

  const texto = String(valor).trim();
  const dt = new Date(texto);

  if (!Number.isNaN(dt.getTime())) {
    return formatarDataPartes(
      dt.getFullYear(),
      dt.getMonth() + 1,
      dt.getDate()
    );
  }

  return null;
}

function montarUrlConsultaBooking(urlBase, tarefa) {
  if (!urlBase) {
    throw new Error('Hotel sem url_booking cadastrada.');
  }

  const checkin = formatarDataISO(tarefa.checkin_consulta);
  const checkout = formatarDataISO(tarefa.checkout_consulta);

  if (!checkin || !checkout) {
    throw new Error(`Tarefa ${tarefa.id} com checkin/checkout inválidos.`);
  }

  const url = new URL(urlBase);

  url.searchParams.set('checkin', checkin);
  url.searchParams.set('checkout', checkout);
  url.searchParams.set('group_adults', String(tarefa.adultos ?? 2));
  url.searchParams.set('group_children', String(tarefa.criancas ?? 0));
  url.searchParams.set('no_rooms', '1');

  return url.toString();
}

async function buscarTarefaPorId(client, tarefaId) {
  const sql = `
    SELECT *
    FROM mod_scraper.scraping_tarefas
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await client.query(sql, [tarefaId]);
  return rows[0] || null;
}

async function buscarHotelPorId(client, hotelId) {
  const sql = `
    SELECT *
    FROM mod_scraper.hoteis_monitorados
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await client.query(sql, [hotelId]);
  return rows[0] || null;
}

async function marcarComoProcessando(client, tarefaId, workerNome) {
  const sql = `
    UPDATE mod_scraper.scraping_tarefas
       SET status = $2,
           iniciada_em = NOW(),
           finalizada_em = NULL,
           erro_resumo = NULL,
           tentativas = COALESCE(tentativas, 0) + 1,
           worker_nome = $3,
           atualizada_em = NOW()
     WHERE id = $1
  `;
  await client.query(sql, [tarefaId, STATUS.PROCESSANDO, workerNome || null]);
}

async function marcarComoConcluida(client, tarefaId) {
  const sql = `
    UPDATE mod_scraper.scraping_tarefas
       SET status = $2,
           finalizada_em = NOW(),
           erro_resumo = NULL,
           atualizada_em = NOW()
     WHERE id = $1
  `;
  await client.query(sql, [tarefaId, STATUS.CONCLUIDA]);
}

async function marcarComoErro(client, tarefaId, erro) {
  const sql = `
    UPDATE mod_scraper.scraping_tarefas
       SET status = $2,
           finalizada_em = NOW(),
           erro_resumo = $3,
           atualizada_em = NOW()
     WHERE id = $1
  `;
  await client.query(sql, [tarefaId, STATUS.ERRO, resumirErro(erro)]);
}

async function executarTarefaScraping(tarefaId, opcoes = {}) {
  const debug = Boolean(opcoes.debug);
  const workerNome = opcoes.workerNome || 'execucao-manual';
  const tarefaJaReservada = Boolean(opcoes.tarefaJaReservada);
  const client = await pool.connect();

  try {
    const tarefa = await buscarTarefaPorId(client, tarefaId);
    if (!tarefa) {
      throw new Error(`Tarefa ${tarefaId} não encontrada.`);
    }

    if (tarefa.status === STATUS.PROCESSANDO && !tarefaJaReservada) {
      throw new Error(`Tarefa ${tarefaId} já está em processamento.`);
    }

    if (tarefa.status === STATUS.CONCLUIDA) {
      throw new Error(`Tarefa ${tarefaId} já está concluída.`);
    }

    if (
      tarefa.max_tentativas != null &&
      tarefa.tentativas != null &&
      tarefa.tentativas > tarefa.max_tentativas
    ) {
      throw new Error(
        `Tarefa ${tarefaId} excedeu o limite de tentativas (${tarefa.max_tentativas}).`
      );
    }

    const hotel = await buscarHotelPorId(client, tarefa.hotel_id);
    if (!hotel) {
      throw new Error(`Hotel ${tarefa.hotel_id} não encontrado.`);
    }

    if (!tarefaJaReservada) {
      await marcarComoProcessando(client, tarefa.id, workerNome);
    }

    const urlConsulta = montarUrlConsultaBooking(hotel.url_booking, tarefa);

    if (debug) {
      console.log('\n[executor] Tarefa carregada:', {
        id: tarefa.id,
        hotel_id: tarefa.hotel_id,
        hotel: hotel.nome,
        regiao_id: tarefa.regiao_id,
        mes_referencia: tarefa.mes_referencia,
        checkin_consulta: tarefa.checkin_consulta,
        checkout_consulta: tarefa.checkout_consulta,
        adultos: tarefa.adultos,
        criancas: tarefa.criancas,
        quantidade_noites: tarefa.quantidade_noites,
        fonte: tarefa.fonte,
        status: tarefa.status,
        tarefaJaReservada
      });

      console.log('[executor] URL final:', urlConsulta);
    }

    const resultadoCaptura = await capturarTarifasCalendarioBooking(urlConsulta, {
      debug
    });

    if (debug) {
      console.log('[executor] status captura:', resultadoCaptura?.status);
      console.log(
        '[executor] itens calendário:',
        Array.isArray(resultadoCaptura?.calendario)
          ? resultadoCaptura.calendario.length
          : 0
      );
      console.log('[executor] meta captura:', resultadoCaptura?.meta || null);
      console.log(
        '[executor] primeira data calendário:',
        Array.isArray(resultadoCaptura?.calendario) && resultadoCaptura.calendario.length
          ? resultadoCaptura.calendario[0]
          : null
      );
      console.log(
        '[executor] última data calendário:',
        Array.isArray(resultadoCaptura?.calendario) && resultadoCaptura.calendario.length
          ? resultadoCaptura.calendario[resultadoCaptura.calendario.length - 1]
          : null
      );
    }

    if (!resultadoCaptura || resultadoCaptura.status === 'error') {
      throw new Error(
        `Falha na captura: ${resultadoCaptura?.erro || 'retorno inválido'}`
      );
    }

    const tarifas = transformarCapturaBookingEmTarifas({
      tarefa,
      resultadoCaptura
    });

    if (!Array.isArray(tarifas)) {
      throw new Error('Parser retornou um valor inválido.');
    }

    if (debug) {
      console.log('[executor] tarifas transformadas:', tarifas.length);
      console.log('[executor] amostra tarifa:', tarifas[0] || null);
    }

    const resumoPersistencia = await persistirLoteTarifas(client, tarifas);

    if (debug) {
      console.log('[executor] resumo persistência:', resumoPersistencia);
    }

    await marcarComoConcluida(client, tarefa.id);

    return {
      ok: true,
      tarefa_id: tarefa.id,
      hotel_id: tarefa.hotel_id,
      hotel_nome: hotel.nome,
      url_consulta: urlConsulta,
      captura_status: resultadoCaptura.status,
      tarifas_transformadas: tarifas.length,
      persistencia: resumoPersistencia
    };
  } catch (err) {
    try {
      await marcarComoErro(client, tarefaId, err);
    } catch (erroMarcacao) {
      console.error('[executor] Falha ao marcar tarefa como erro:', erroMarcacao);
    }

    return {
      ok: false,
      tarefa_id: tarefaId,
      erro: resumirErro(err, 4000)
    };
  } finally {
    client.release();
  }
}

module.exports = {
  executarTarefaScraping
};

if (require.main === module) {
  (async () => {
    const tarefaId = Number(process.argv[2]);
    const debug = process.argv.includes('--debug');

    if (!tarefaId || Number.isNaN(tarefaId)) {
      console.error(
        'Uso: node mod-scraper/src/tarefas/executarTarefaScraping.js <tarefaId> [--debug]'
      );
      process.exit(1);
    }

    const resultado = await executarTarefaScraping(tarefaId, {
      debug,
      workerNome: 'execucao-manual'
    });

    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.ok ? 0 : 1);
  })();
}