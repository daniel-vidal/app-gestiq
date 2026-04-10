import { api } from '../api.js';

let hoteis = [];
let regioesCache = [];

export async function renderHoteis(container) {
  container.innerHTML = '<p>Carregando hotéis...</p>';

  try {
    const [hData, rData] = await Promise.all([
      api('/hoteis'),
      api('/regioes'),
    ]);
    hoteis = hData.hoteis;
    regioesCache = rData.regioes;
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    return;
  }

  renderLista(container);
}

function renderLista(container) {
  if (!hoteis.length) {
    container.innerHTML = `
      <div class="page-header">
        <h2>Hotéis</h2>
        <button class="btn btn-primary" id="btn-novo-hotel">Novo Hotel</button>
      </div>
      <div class="empty-state"><p>Nenhum hotel cadastrado.</p></div>
    `;
    container.querySelector('#btn-novo-hotel').addEventListener('click', () => abrirModal(container));
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h2>Hotéis</h2>
      <button class="btn btn-primary" id="btn-novo-hotel">Novo Hotel</button>
    </div>
    <div class="filters-bar">
      <div class="form-group">
        <input type="text" id="filtro-busca-h" placeholder="Buscar por nome...">
      </div>
      <div class="form-group">
        <select id="filtro-regiao-h">
          <option value="">Todas as regiões</option>
          ${regioesCache.filter((r) => r.ativa).map((r) =>
            `<option value="${r.id}">${esc(r.nome)} - ${esc(r.cidade)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <select id="filtro-status-h">
          <option value="">Todos os status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Região</th>
            <th>Estrelas</th>
            <th>Perfil</th>
            <th>Prioridade</th>
            <th>Base</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-hoteis"></tbody>
      </table>
    </div>
  `;

  renderTabela();

  container.querySelector('#btn-novo-hotel').addEventListener('click', () => abrirModal(container));
  container.querySelector('#filtro-busca-h').addEventListener('input', debounce(() => filtrar(), 300));
  container.querySelector('#filtro-regiao-h').addEventListener('change', filtrar);
  container.querySelector('#filtro-status-h').addEventListener('change', filtrar);
}

function renderTabela(lista) {
  const dados = lista || hoteis;
  const tbody = document.getElementById('tabela-hoteis');

  tbody.innerHTML = dados.map((h) => `
    <tr>
      <td>${esc(h.nome)}</td>
      <td>${esc(h.regiao_nome || '-')}${h.regiao_cidade ? ` <small style="color:#888">(${esc(h.regiao_cidade)})</small>` : ''}</td>
      <td>${h.categoria_estrelas ? '★'.repeat(h.categoria_estrelas) : '-'}</td>
      <td>${esc(h.perfil_hotel || '-')}</td>
      <td>${h.prioridade_monitoramento ?? '-'}</td>
      <td>${h.hotel_base ? 'Sim' : 'Não'}</td>
      <td><span class="badge ${h.ativo ? 'badge-active' : 'badge-inactive'}">${h.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn btn-sm btn-secondary btn-editar-h" data-id="${h.id}">Editar</button>
        <button class="btn btn-sm ${h.ativo ? 'btn-danger' : 'btn-success'} btn-status-h" data-id="${h.id}" data-ativo="${h.ativo}">
          ${h.ativo ? 'Desativar' : 'Ativar'}
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar-h').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hotel = hoteis.find((h) => h.id === Number(btn.dataset.id));
      abrirModal(document.getElementById('app'), hotel);
    });
  });

  tbody.querySelectorAll('.btn-status-h').forEach((btn) => {
    btn.addEventListener('click', () => alterarStatus(btn.dataset.id, btn.dataset.ativo === 'true'));
  });
}

function filtrar() {
  const busca = document.getElementById('filtro-busca-h').value.trim().toLowerCase();
  const regiaoId = document.getElementById('filtro-regiao-h').value;
  const status = document.getElementById('filtro-status-h').value;

  let filtrados = hoteis;

  if (busca) {
    filtrados = filtrados.filter((h) => h.nome.toLowerCase().includes(busca));
  }

  if (regiaoId) {
    filtrados = filtrados.filter((h) => h.regiao_id === Number(regiaoId));
  }

  if (status !== '') {
    const ativo = status === 'true';
    filtrados = filtrados.filter((h) => h.ativo === ativo);
  }

  renderTabela(filtrados);
}

function abrirModal(container, hotel) {
  const editando = Boolean(hotel);
  const titulo = editando ? 'Editar Hotel' : 'Novo Hotel';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>${titulo}</h3>
      <div id="modal-erro-h" class="alert alert-error hidden"></div>
      <form id="form-hotel">
        <div class="form-group">
          <label for="h-nome">Nome</label>
          <input type="text" id="h-nome" required value="${esc(hotel?.nome || '')}">
        </div>
        <div class="form-group">
          <label for="h-regiao">Região</label>
          <select id="h-regiao" required>
            <option value="">— Selecione —</option>
            ${regioesCache.filter((r) => r.ativa).map((r) =>
              `<option value="${r.id}" ${hotel?.regiao_id === r.id ? 'selected' : ''}>${esc(r.nome)} - ${esc(r.cidade)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="h-url">URL Booking</label>
          <input type="url" id="h-url" required value="${esc(hotel?.url_booking || '')}" placeholder="https://booking.com/hotel/...">
        </div>
        <div class="form-group">
          <label for="h-estrelas">Categoria (estrelas)</label>
          <select id="h-estrelas">
            <option value="">—</option>
            ${[1,2,3,4,5].map((n) =>
              `<option value="${n}" ${hotel?.categoria_estrelas === n ? 'selected' : ''}>${'★'.repeat(n)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="h-perfil">Perfil</label>
          <select id="h-perfil">
            <option value="">—</option>
            ${['urbano', 'resort', 'pousada', 'hostel', 'apart-hotel'].map((p) =>
              `<option value="${p}" ${hotel?.perfil_hotel === p ? 'selected' : ''}>${p}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="h-prioridade">Prioridade (1=alta, 10=baixa)</label>
          <input type="number" id="h-prioridade" min="1" max="10" value="${hotel?.prioridade_monitoramento ?? 5}">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="h-base" ${hotel?.hotel_base ? 'checked' : ''}> Hotel base (referência)
          </label>
        </div>
        <div class="form-group">
          <label for="h-obs">Observações</label>
          <textarea id="h-obs" rows="3">${esc(hotel?.observacoes || '')}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="btn-cancelar-h">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-salvar-h">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#btn-cancelar-h').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#form-hotel').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroDiv = overlay.querySelector('#modal-erro-h');
    erroDiv.classList.add('hidden');

    const dados = {
      nome: document.getElementById('h-nome').value.trim(),
      regiao_id: Number(document.getElementById('h-regiao').value),
      url_booking: document.getElementById('h-url').value.trim(),
      categoria_estrelas: document.getElementById('h-estrelas').value ? Number(document.getElementById('h-estrelas').value) : null,
      perfil_hotel: document.getElementById('h-perfil').value || null,
      prioridade_monitoramento: Number(document.getElementById('h-prioridade').value || 5),
      hotel_base: document.getElementById('h-base').checked,
      observacoes: document.getElementById('h-obs').value.trim() || null,
    };

    try {
      if (editando) {
        await api(`/hoteis/${hotel.id}`, { method: 'PUT', body: dados });
      } else {
        await api('/hoteis', { method: 'POST', body: dados });
      }
      overlay.remove();
      await renderHoteis(container);
    } catch (err) {
      erroDiv.textContent = err.message;
      erroDiv.classList.remove('hidden');
    }
  });
}

async function alterarStatus(id, ativoAtual) {
  try {
    await api(`/hoteis/${id}/status`, {
      method: 'PATCH',
      body: { ativo: !ativoAtual },
    });
    await renderHoteis(document.getElementById('app'));
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
