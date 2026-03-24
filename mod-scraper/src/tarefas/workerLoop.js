// node mod-scraper/src/tarefas/workerLoop.js

require('dotenv').config();

const { runnerUmaTarefa } = require('./runnerUmaTarefa');

const INTERVALO_MS = 3000;
const WORKER_NOME = process.env.WORKER_NOME || 'worker-loop-1';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loop() {
  console.log(`[worker] iniciado: ${WORKER_NOME}`);

  while (true) {
    try {
      const resultado = await runnerUmaTarefa({
        debug: false,
        workerNome: WORKER_NOME
      });

      if (resultado.executou) {
        console.log('\n[worker] tarefa executada:', JSON.stringify({
          tarefa_id: resultado.tarefa_encontrada_id,
          ok: resultado.ok,
          persistencia: resultado.resultado?.persistencia
        }, null, 2));
      } else {
        // opcional: comentar se quiser silêncio total
        console.log('[worker] fila vazia...');
      }

    } catch (err) {
      console.error('[worker] erro:', err);
    }

    await sleep(INTERVALO_MS);
  }
}

loop();