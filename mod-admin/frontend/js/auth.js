import { api } from './api.js';

export function estaAutenticado() {
  return Boolean(localStorage.getItem('token'));
}

export function getUsuario() {
  try {
    return JSON.parse(localStorage.getItem('usuario'));
  } catch {
    return null;
  }
}

export async function login(email, senha) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: { email, senha },
  });

  localStorage.setItem('token', data.token);
  localStorage.setItem('usuario', JSON.stringify(data.usuario));

  return data.usuario;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.hash = '#/login';
}
