// node mod-scraper/iniciarModScraper.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { iniciarLoopAgendador, pararLoopAgendador } = require('./src/agendamento/loopAgendador');
const { iniciarWorkerLoop, pararWorkerLoop } = require('./src/tarefas/workerLoop');

let sistemaIniciado = false;

function obterConfiguracao() {
  return {
    agendador: {
      intervaloMs: Number(process.env.AGENDADOR_INTERVALO_MS || 30000),
      debug: String(process.env.AGENDADOR_DEBUG || 'false').toLowerCase() === 'true'
    },
    worker: {
      intervaloMs: Number(process.env.WORKER_INTERVALO_MS || 3000),
      debug: String(process.env.WORKER_DEBUG || 'false').toLowerCase() === 'true',
      workerNome: process.env.WORKER_NOME || 'worker-loop-1'
    }
  };
}

async function iniciarModScraper(opcoes = {}) {
  if (sistemaIniciado) {
    console.warn('[mod-scraper] sistema já está em execução.');
    return;
  }

  const configPadrao = obterConfiguracao();

  const config = {
    agendador: {
      ...configPadrao.agendador,
      ...(opcoes.agendador || {})
    },
    worker: {
      ...configPadrao.worker,
      ...(opcoes.worker || {})
    }
  };

  console.log('[mod-scraper] iniciando módulo...');
  console.log('[mod-scraper] configuração carregada:', JSON.stringify(config, null, 2));

  iniciarLoopAgendador(config.agendador);
  iniciarWorkerLoop(config.worker);

  sistemaIniciado = true;

  console.log('[mod-scraper] serviços iniciados com sucesso.');
}

function pararModScraper() {
  if (!sistemaIniciado) {
    console.warn('[mod-scraper] sistema não está em execução.');
    return;
  }

  console.log('[mod-scraper] encerrando serviços...');

  pararLoopAgendador();
  pararWorkerLoop();

  sistemaIniciado = false;

  console.log('[mod-scraper] serviços encerrados.');
}

function registrarEncerramento() {
  const encerrar = (sinal) => {
    console.log(`[mod-scraper] sinal recebido: ${sinal}`);
    pararModScraper();
    process.exit(0);
  };

  process.on('SIGINT', () => encerrar('SIGINT'));
  process.on('SIGTERM', () => encerrar('SIGTERM'));
}

if (require.main === module) {
  registrarEncerramento();

  iniciarModScraper().catch((err) => {
    console.error('[mod-scraper] erro fatal ao iniciar:', err);
    process.exit(1);
  });
}

module.exports = {
  iniciarModScraper,
  pararModScraper
};