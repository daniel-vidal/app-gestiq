require('dotenv').config();

const { buscarRotinasVencidas } = require('./buscarRotinasVencidas');
const { executarRotinaAgendada } = require('./executarRotinaAgendada');

const INTERVALO_PADRAO_MS = Number(process.env.AGENDADOR_INTERVALO_MS || 30000);

let agendadorAtivo = false;
let cicloEmExecucao = false;
let promiseLoop = null;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executarCicloAgendador(opcoes = {}) {
  const debug = Boolean(opcoes.debug);

  if (cicloEmExecucao) {
    if (debug) {
      console.log('[agendador] ciclo ignorado: execução anterior ainda em andamento.');
    }
    return;
  }

  cicloEmExecucao = true;

  try {
    const rotinas = await buscarRotinasVencidas();

    if (debug) {
      console.log(`[agendador] rotinas vencidas encontradas: ${rotinas.length}`);
    }

    for (const rotina of rotinas) {
      const resultado = await executarRotinaAgendada(rotina, { debug });

      if (debug) {
        console.log(
          '[agendador] resultado da rotina:',
          JSON.stringify(
            {
              rotina_id: resultado?.rotina_id || null,
              nome: resultado?.nome || rotina.nome,
              ok: resultado?.ok ?? null,
              duracao_ms: resultado?.duracao_ms ?? null,
              erro: resultado?.erro || null
            },
            null,
            2
          )
        );
      }
    }

    return {
      ok: true,
      total_rotinas: rotinas.length
    };
  } catch (err) {
    console.error('[agendador] erro no ciclo:', err);
    throw err;
  } finally {
    cicloEmExecucao = false;
  }
}

async function loopAgendador(opcoes = {}) {
  const intervaloMs = Number(opcoes.intervaloMs || INTERVALO_PADRAO_MS);
  const debug = Boolean(opcoes.debug);

  console.log(`[agendador] iniciado | intervalo=${intervaloMs}ms`);

  while (agendadorAtivo) {
    try {
      await executarCicloAgendador({ debug });
    } catch (err) {
      console.error('[agendador] falha tratada no loop:', err.message);
    }

    if (!agendadorAtivo) break;

    await sleep(intervaloMs);
  }

  console.log('[agendador] finalizado');
}

function iniciarLoopAgendador(opcoes = {}) {
  if (agendadorAtivo) {
    console.warn('[agendador] loop já está em execução.');
    return promiseLoop;
  }

  agendadorAtivo = true;

  promiseLoop = loopAgendador(opcoes).catch((err) => {
    console.error('[agendador] erro fatal no loop:', err);
    agendadorAtivo = false;
    promiseLoop = null;
  });

  return promiseLoop;
}

function pararLoopAgendador() {
  if (!agendadorAtivo) {
    return;
  }

  agendadorAtivo = false;
}

function agendadorEstaAtivo() {
  return agendadorAtivo;
}

module.exports = {
  iniciarLoopAgendador,
  pararLoopAgendador,
  executarCicloAgendador,
  agendadorEstaAtivo
};

if (require.main === module) {
  iniciarLoopAgendador({
    intervaloMs: INTERVALO_PADRAO_MS,
    debug: String(process.env.AGENDADOR_DEBUG || 'false').toLowerCase() === 'true'
  });
}