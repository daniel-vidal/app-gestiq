import { estaAutenticado, getUsuario, logout } from './auth.js';
import { renderLogin } from './pages/login.js';
import { renderRegioes } from './pages/regioes.js';
import { renderHoteis } from './pages/hoteis.js';
import { renderRotinas } from './pages/rotinas.js';

const paginas = {
  '/regioes': renderRegioes,
  '/hoteis': renderHoteis,
  '/rotinas': renderRotinas,
};

const loginContainer = document.getElementById('login-container');
const adminLayout = document.getElementById('admin-layout');
const appContainer = document.getElementById('app');
const usuarioNome = document.getElementById('usuario-nome');
const navLinks = document.querySelectorAll('#sidebar-nav a');

function mostrarLayout(autenticado) {
  loginContainer.classList.toggle('hidden', autenticado);
  adminLayout.classList.toggle('hidden', !autenticado);
}

function atualizarNavAtivo(hash) {
  navLinks.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === hash);
  });
}

function atualizarUsuario() {
  const u = getUsuario();
  if (u) usuarioNome.textContent = u.nome;
}

async function navegar() {
  const hash = window.location.hash || '#/regioes';

  if (!estaAutenticado()) {
    mostrarLayout(false);
    renderLogin(loginContainer);
    return;
  }

  mostrarLayout(true);
  atualizarUsuario();
  atualizarNavAtivo(hash);

  const rota = hash.replace('#', '');
  const renderPagina = paginas[rota];

  if (renderPagina) {
    await renderPagina(appContainer);
  } else {
    window.location.hash = '#/regioes';
  }
}

// Evento de navegação
window.addEventListener('hashchange', navegar);

// Logout
document.getElementById('btn-logout').addEventListener('click', logout);

// Evento global para renavegar após login
window.addEventListener('auth:login', () => {
  window.location.hash = '#/regioes';
  navegar();
});

// Inicializar
navegar();
