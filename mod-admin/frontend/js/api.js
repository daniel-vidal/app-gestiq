const BASE_URL = '/api/admin';

export async function api(endpoint, opcoes = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers,
    ...opcoes,
    ...(opcoes.body ? { body: JSON.stringify(opcoes.body) } : {}),
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.hash = '#/login';
    throw new Error('Sessão expirada');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.erro || `Erro ${res.status}`);
  }

  return data;
}
