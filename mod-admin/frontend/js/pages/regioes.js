import { api } from '../api.js';

let regioes = [];

export async function renderRegioes(container) {
  container.innerHTML = '<p>Carregando regiões...</p>';

  try {
    const data = await api('/regioes');
    regioes = data.regioes;
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    return;
  }

  renderLista(container);
}

function renderLista(container) {
  if (!regioes.length) {
    container.innerHTML = `
      <div class="page-header">
        <h2>Regiões</h2>
        <button class="btn btn-primary" id="btn-nova-regiao">Nova Região</button>
      </div>
      <div class="empty-state"><p>Nenhuma região cadastrada.</p></div>
    `;
    container.querySelector('#btn-nova-regiao').addEventListener('click', () => abrirModal(container));
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h2>Regiões</h2>
      <button class="btn btn-primary" id="btn-nova-regiao">Nova Região</button>
    </div>
    <div class="filters-bar">
      <div class="form-group">
        <input type="text" id="filtro-busca" placeholder="Buscar por nome ou cidade...">
      </div>
      <div class="form-group">
        <select id="filtro-status">
          <option value="">Todos os status</option>
          <option value="true">Ativas</option>
          <option value="false">Inativas</option>
        </select>
      </div>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Cidade</th>
            <th>UF</th>
            <th>Tipo</th>
            <th>Hotéis</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-regioes"></tbody>
      </table>
    </div>
  `;

  renderTabela();

  container.querySelector('#btn-nova-regiao').addEventListener('click', () => abrirModal(container));
  container.querySelector('#filtro-busca').addEventListener('input', debounce(() => filtrar(container), 300));
  container.querySelector('#filtro-status').addEventListener('change', () => filtrar(container));
}

function renderTabela(lista) {
  const dados = lista || regioes;
  const tbody = document.getElementById('tabela-regioes');

  tbody.innerHTML = dados.map((r) => `
    <tr>
      <td>${esc(r.nome)}</td>
      <td>${esc(r.cidade)}</td>
      <td>${esc(r.estado)}</td>
      <td>${esc(r.tipo_regiao || '-')}</td>
      <td>${r.total_hoteis ?? 0}</td>
      <td><span class="badge ${r.ativa ? 'badge-active' : 'badge-inactive'}">${r.ativa ? 'Ativa' : 'Inativa'}</span></td>
      <td>
        <button class="btn btn-sm btn-secondary btn-editar" data-id="${r.id}">Editar</button>
        <button class="btn btn-sm ${r.ativa ? 'btn-danger' : 'btn-success'} btn-status" data-id="${r.id}" data-ativa="${r.ativa}">
          ${r.ativa ? 'Desativar' : 'Ativar'}
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => {
      const regiao = regioes.find((r) => r.id === Number(btn.dataset.id));
      abrirModal(document.getElementById('app'), regiao);
    });
  });

  tbody.querySelectorAll('.btn-status').forEach((btn) => {
    btn.addEventListener('click', () => alterarStatus(btn.dataset.id, btn.dataset.ativa === 'true'));
  });
}

async function filtrar(container) {
  const busca = document.getElementById('filtro-busca').value.trim().toLowerCase();
  const status = document.getElementById('filtro-status').value;

  let filtradas = regioes;

  if (busca) {
    filtradas = filtradas.filter((r) =>
      r.nome.toLowerCase().includes(busca) || r.cidade.toLowerCase().includes(busca)
    );
  }

  if (status !== '') {
    const ativa = status === 'true';
    filtradas = filtradas.filter((r) => r.ativa === ativa);
  }

  renderTabela(filtradas);
}

function abrirModal(container, regiao) {
  const editando = Boolean(regiao);
  const titulo = editando ? 'Editar Região' : 'Nova Região';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>${titulo}</h3>
      <div id="modal-erro" class="alert alert-error hidden"></div>
      <form id="form-regiao">
        <div class="form-group">
          <label for="r-nome">Nome</label>
          <input type="text" id="r-nome" required value="${esc(regiao?.nome || '')}">
        </div>
        <div class="form-group">
          <label for="r-cidade">Cidade</label>
          <input type="text" id="r-cidade" required value="${esc(regiao?.cidade || '')}">
        </div>
        <div class="form-group">
          <label for="r-estado">UF (2 letras)</label>
          <input type="text" id="r-estado" required maxlength="2" value="${esc(regiao?.estado || '')}">
        </div>
        <div class="form-group">
          <label for="r-tipo">Tipo de região</label>
          <select id="r-tipo">
            <option value="">— Selecione —</option>
            ${['bairro', 'litoral', 'ilha', 'centro', 'rural'].map((t) =>
              `<option value="${t}" ${regiao?.tipo_regiao === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-salvar">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#btn-cancelar').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#form-regiao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroDiv = overlay.querySelector('#modal-erro');
    erroDiv.classList.add('hidden');

    const dados = {
      nome: document.getElementById('r-nome').value.trim(),
      cidade: document.getElementById('r-cidade').value.trim(),
      estado: document.getElementById('r-estado').value.trim().toUpperCase(),
      tipo_regiao: document.getElementById('r-tipo').value || null,
    };

    try {
      if (editando) {
        await api(`/regioes/${regiao.id}`, { method: 'PUT', body: dados });
      } else {
        await api('/regioes', { method: 'POST', body: dados });
      }
      overlay.remove();
      await renderRegioes(container);
    } catch (err) {
      erroDiv.textContent = err.message;
      erroDiv.classList.remove('hidden');
    }
  });
}

async function alterarStatus(id, ativaAtual) {
  try {
    await api(`/regioes/${id}/status`, {
      method: 'PATCH',
      body: { ativa: !ativaAtual },
    });
    await renderRegioes(document.getElementById('app'));
  } catch (err) {
    alert(err.message);
  }
}

function esc(str) {
  if (!str) return '';
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
