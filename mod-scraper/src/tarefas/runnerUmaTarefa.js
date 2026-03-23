require('dotenv').config();

const { reservarProximaTarefaPendente } = require('./reservarProximaTarefaPendente');
const { executarTarefaScraping } = require('./executarTarefaScraping');

async function runnerUmaTarefa(opcoes = {}) {
  const debug = Boolean(opcoes.debug);
  const workerNome = opcoes.workerNome || 'runner-uma-tarefa';

  try {
    const tarefa = await reservarProximaTarefaPendente({ workerNome });

    if (!tarefa) {
      return {
        ok: true,
        executou: false,
        worker_nome: workerNome,
        mensagem: 'Nenhuma tarefa pendente encontrada para reserva.'
      };
    }

    if (debug) {
      console.log('[runner] Tarefa reservada:', {
        id: tarefa.id,
        hotel_id: tarefa.hotel_id,
        hotel_nome: tarefa.hotel_nome,
        prioridade: tarefa.prioridade,
        agendada_para: tarefa.agendada_para,
        tentativas: tarefa.tentativas,
        max_tentativas: tarefa.max_tentativas,
        status: tarefa.status,
        worker_nome: tarefa.worker_nome
      });
    }

    const resultado = await executarTarefaScraping(tarefa.id, {
      debug,
      workerNome,
      tarefaJaReservada: true
    });

    return {
      ok: resultado.ok,
      executou: true,
      worker_nome: workerNome,
      tarefa_encontrada_id: tarefa.id,
      hotel_id: tarefa.hotel_id,
      tarefa_encontrada_status: tarefa.status,
      resultado
    };
  } catch (err) {
    return {
      ok: false,
      executou: false,
      worker_nome: workerNome,
      erro: err?.stack || err?.message || String(err)
    };
  }
}

module.exports = {
  runnerUmaTarefa
};

if (require.main === module) {
  (async () => {
    const debug = process.argv.includes('--debug');

    const resultado = await runnerUmaTarefa({
      debug,
      workerNome: 'runner-manual'
    });

    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.ok ? 0 : 1);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}