import { login } from '../auth.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-box">
      <h2>GestiQ</h2>
      <p class="subtitle">Acesso ao painel administrativo</p>
      <div id="login-erro" class="alert alert-error hidden"></div>
      <form id="form-login">
        <div class="form-group">
          <label for="email">E-mail</label>
          <input type="email" id="email" required autocomplete="username" placeholder="admin@gestiq.local">
        </div>
        <div class="form-group">
          <label for="senha">Senha</label>
          <input type="password" id="senha" required autocomplete="current-password" placeholder="••••••••">
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="btn-login">Entrar</button>
      </form>
    </div>
  `;

  const form = document.getElementById('form-login');
  const erroDiv = document.getElementById('login-erro');
  const btnLogin = document.getElementById('btn-login');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroDiv.classList.add('hidden');
    btnLogin.disabled = true;
    btnLogin.textContent = 'Entrando...';

    try {
      const email = document.getElementById('email').value.trim();
      const senha = document.getElementById('senha').value;

      await login(email, senha);
      window.dispatchEvent(new Event('auth:login'));
    } catch (err) {
      erroDiv.textContent = err.message || 'Erro ao realizar login.';
      erroDiv.classList.remove('hidden');
      btnLogin.disabled = false;
      btnLogin.textContent = 'Entrar';
    }
  });
}
