// node server.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// --- Configuração de portas ---
const ADMIN_PORT = Number(process.env.ADMIN_PORT || 3001);

// --- Registro de módulos ---
const modulos = [
  {
    nome: 'mod-admin',
    iniciar: () => require('./mod-admin/iniciarModAdmin').iniciar({ porta: ADMIN_PORT }),
    parar: require('./mod-admin/iniciarModAdmin').parar,
  },
  {
    nome: 'mod-scraper',
    iniciar: require('./mod-scraper/iniciarModScraper').iniciarModScraper,
    parar: require('./mod-scraper/iniciarModScraper').pararModScraper,
  },
];

// --- Inicialização ---
async function iniciarTudo() {
  console.log('[server] Iniciando GestiQ...');
  console.log(`[server] Módulos registrados: ${modulos.map((m) => m.nome).join(', ')}`);

  for (const mod of modulos) {
    try {
      await mod.iniciar();
      console.log(`[server] ${mod.nome} iniciado.`);
    } catch (err) {
      console.error(`[server] Falha ao iniciar ${mod.nome}:`, err);
      process.exit(1);
    }
  }

  console.log('[server] Todos os módulos iniciados.');
}

// --- Encerramento gracioso ---
function pararTudo() {
  console.log('[server] Encerrando módulos...');

  for (const mod of modulos) {
    try {
      mod.parar();
    } catch (err) {
      console.error(`[server] Erro ao parar ${mod.nome}:`, err);
    }
  }

  console.log('[server] Todos os módulos encerrados.');
}

function registrarEncerramento() {
  const encerrar = (sinal) => {
    console.log(`[server] Sinal recebido: ${sinal}`);
    pararTudo();
    process.exit(0);
  };

  process.on('SIGINT', () => encerrar('SIGINT'));
  process.on('SIGTERM', () => encerrar('SIGTERM'));
}

// --- Executar ---
registrarEncerramento();

iniciarTudo().catch((err) => {
  console.error('[server] Erro fatal:', err);
  process.exit(1);
});
