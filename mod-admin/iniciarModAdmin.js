const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const express = require('express');
const authRoutes = require('./src/auth/authRoutes');
const regioesRoutes = require('./src/rotas/regioes/regioesRoutes');
const hoteisRoutes = require('./src/rotas/hoteis/hoteisRoutes');
const rotinasRoutes = require('./src/rotas/rotinas/rotinasRoutes');

const app = express();

app.use(express.json());

// --- Rotas ---
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/regioes', regioesRoutes);
app.use('/api/admin/hoteis', hoteisRoutes);
app.use('/api/admin/rotinas', rotinasRoutes);

// Health check
app.get('/api/admin/health', (req, res) => {
  res.json({ status: 'ok', modulo: 'mod-admin' });
});

// Error handler global — sempre responde JSON
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[mod-admin] erro não tratado:', err);
  res.status(err.status || 500).json({ erro: err.message || 'Erro interno do servidor.' });
});

// --- Frontend ---
app.use('/admin', express.static(path.join(__dirname, 'frontend')));
app.get('/admin/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// --- Inicialização ---
let servidor = null;

async function iniciar(opcoes = {}) {
  const porta = opcoes.porta || Number(process.env.ADMIN_PORT || 3001);
  return new Promise((resolve) => {
    servidor = app.listen(porta, () => {
      console.log(`[mod-admin] Servidor rodando na porta ${porta}`);
      resolve();
    });
  });
}

function parar() {
  if (servidor) {
    servidor.close();
    servidor = null;
    console.log('[mod-admin] Servidor encerrado.');
  }
}

if (require.main === module) {
  iniciar().catch((err) => {
    console.error('[mod-admin] erro fatal ao iniciar:', err);
    process.exit(1);
  });
}

module.exports = { app, iniciar, parar };
