require('dotenv').config();

const { runnerUmaTarefa } = require('./runnerUmaTarefa');

const INTERVALO_PADRAO_MS = Number(process.env.WORKER_INTERVALO_MS || 3000);
const WORKER_NOME_PADRAO = process.env.WORKER_NOME || 'worker-loop-1';

let workerAtivo = false;
let cicloEmExecucao = false;
let promiseLoop = null;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executarCicloWorker(opcoes = {}) {
  const debug = Boolean(opcoes.debug);
  const workerNome = opcoes.workerNome || WORKER_NOME_PADRAO;

  if (cicloEmExecucao) {
    if (debug) {
      console.log(`[worker] ciclo ignorado: execução anterior ainda em andamento (${workerNome})`);
    }
    return;
  }

  cicloEmExecucao = true;

  try {
    const resultado = await runnerUmaTarefa({
      debug,
      workerNome
    });

    if (resultado?.executou) {
      console.log(
        '[worker] tarefa executada:',
        JSON.stringify(
          {
            worker: workerNome,
            tarefa_id: resultado.tarefa_encontrada_id || null,
            ok: resultado.ok ?? null,
            persistencia: resultado.resultado?.persistencia || null
          },
          null,
          2
        )
      );
    } else if (debug) {
      console.log(`[worker] fila vazia (${workerNome})`);
    }

    return resultado;
  } catch (err) {
    console.error(`[worker] erro no ciclo (${workerNome}):`, err);
    throw err;
  } finally {
    cicloEmExecucao = false;
  }
}

async function loopWorker(opcoes = {}) {
  const intervaloMs = Number(opcoes.intervaloMs || INTERVALO_PADRAO_MS);
  const debug = Boolean(opcoes.debug);
  const workerNome = opcoes.workerNome || WORKER_NOME_PADRAO;

  console.log(`[worker] iniciado: ${workerNome} | intervalo=${intervaloMs}ms`);

  while (workerAtivo) {
    try {
      await executarCicloWorker({
        debug,
        workerNome
      });
    } catch (err) {
      console.error(`[worker] falha tratada no loop (${workerNome}):`, err.message);
    }

    if (!workerAtivo) break;

    await sleep(intervaloMs);
  }

  console.log(`[worker] finalizado: ${workerNome}`);
}

function iniciarWorkerLoop(opcoes = {}) {
  if (workerAtivo) {
    console.warn('[worker] loop já está em execução.');
    return promiseLoop;
  }

  workerAtivo = true;

  promiseLoop = loopWorker(opcoes).catch((err) => {
    console.error('[worker] erro fatal no loop:', err);
    workerAtivo = false;
    promiseLoop = null;
  });

  return promiseLoop;
}

function pararWorkerLoop() {
  if (!workerAtivo) {
    return;
  }

  workerAtivo = false;
}

function workerEstaAtivo() {
  return workerAtivo;
}

module.exports = {
  iniciarWorkerLoop,
  pararWorkerLoop,
  executarCicloWorker,
  workerEstaAtivo
};

if (require.main === module) {
  iniciarWorkerLoop({
    intervaloMs: INTERVALO_PADRAO_MS,
    debug: String(process.env.WORKER_DEBUG || 'false').toLowerCase() === 'true',
    workerNome: WORKER_NOME_PADRAO
  });
}