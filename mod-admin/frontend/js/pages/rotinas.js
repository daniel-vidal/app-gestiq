import { api } from '../api.js';

let rotinas = [];

const FREQUENCIA_TIPOS = ['diaria', 'semanal', 'mensal'];
const FREQUENCIA_LABELS = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' };
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const SCRIPTS_GERADORES = [
  { valor: 'gerar_tarefas_90_dias',           label: 'Gerar Tarefas de Scraping (90 dias)' },
  { valor: 'gerar_Descoberta_JanelaVendaHotel', label: 'Descoberta de Janela de Venda' },
];

export async function renderRotinas(container) {
  container.innerHTML = '<p>Carregando rotinas...</p>';

  try {
    const data = await api('/rotinas');
    rotinas = data.rotinas;
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    return;
  }

  renderLista(container);
}

function renderLista(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Rotinas Agendadas</h2>
      <button class="btn btn-primary" id="btn-nova-rotina">Nova Rotina</button>
    </div>
    <div class="filters-bar">
      <div class="form-group">
        <select id="filtro-tipo-r">
          <option value="">Todos os tipos</option>
          ${FREQUENCIA_TIPOS.map((t) => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <select id="filtro-status-r">
          <option value="">Todos os status</option>
          <option value="true" selected>Ativas</option>
          <option value="false">Inativas</option>
        </select>
      </div>
    </div>
    ${rotinas.length === 0
      ? '<div class="empty-state"><p>Nenhuma rotina cadastrada.</p></div>'
      : `<div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nome / Script</th>
                <th>Agendamento</th>
                <th>Próxima Execução</th>
                <th>Última Execução</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody id="tabela-rotinas"></tbody>
          </table>
        </div>`
    }
  `;

  if (rotinas.length > 0) {
    filtrar();
  }

  container.querySelector('#btn-nova-rotina').addEventListener('click', () => abrirModal(container));
  container.querySelector('#filtro-tipo-r').addEventListener('change', filtrar);
  container.querySelector('#filtro-status-r').addEventListener('change', filtrar);
}

function renderTabela(lista) {
  const dados = lista || rotinas;
  const tbody = document.getElementById('tabela-rotinas');
  if (!tbody) return;

  tbody.innerHTML = dados.map((r) => `
    <tr>
      <td>
        <strong>${esc(r.nome)}</strong><br>
        <small style="color:#9ca3af">${esc(r.tipo_rotina)}</small>
      </td>
      <td><small>${formatarAgendamento(r)}</small></td>
      <td><small>${formatarData(r.proxima_execucao_em)}</small></td>
      <td><small>${formatarData(r.ultima_execucao_em)}</small></td>
      <td><span class="badge ${r.ativo ? 'badge-active' : 'badge-inactive'}">${r.ativo ? 'Ativa' : 'Inativa'}</span></td>
      <td>
        <button class="btn btn-sm btn-secondary btn-editar-r" data-id="${r.id}" title="Editar">Editar</button>
        <button class="btn btn-sm ${r.ativo ? 'btn-danger' : 'btn-success'} btn-toggle-r" data-id="${r.id}" data-ativo="${r.ativo}" title="${r.ativo ? 'Desativar' : 'Ativar'}">
          ${r.ativo ? 'Desativar' : 'Ativar'}
        </button>
        <button class="btn btn-sm btn-primary btn-executar-r" data-id="${r.id}" title="Forçar execução agora">▶ Agora</button>
        <button class="btn btn-sm btn-secondary btn-execucoes-r" data-id="${r.id}" title="Ver execuções">Execuções</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar-r').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rotina = rotinas.find((r) => String(r.id) === btn.dataset.id);
      abrirModal(document.getElementById('app'), rotina);
    });
  });

  tbody.querySelectorAll('.btn-toggle-r').forEach((btn) => {
    btn.addEventListener('click', () => alterarAtivo(btn.dataset.id, btn.dataset.ativo === 'true'));
  });

  tbody.querySelectorAll('.btn-executar-r').forEach((btn) => {
    btn.addEventListener('click', () => executarAgora(btn.dataset.id));
  });

  tbody.querySelectorAll('.btn-execucoes-r').forEach((btn) => {
    btn.addEventListener('click', () => abrirExecucoes(btn.dataset.id));
  });
}

function filtrar() {
  const tipo = document.getElementById('filtro-tipo-r').value;
  const status = document.getElementById('filtro-status-r').value;

  let filtradas = rotinas;

  if (tipo) {
    filtradas = filtradas.filter((r) => r.frequencia_tipo === tipo);
  }

  if (status !== '') {
    const ativo = status === 'true';
    filtradas = filtradas.filter((r) => r.ativo === ativo);
  }

  renderTabela(filtradas);
}

// ── Modal criar/editar ─────────────────────────────────────────────────────────

async function abrirModal(container, rotina) {
  const editando = Boolean(rotina);
  const titulo = editando ? 'Editar Rotina' : 'Nova Rotina';

  const diasSelecionados = rotina?.dias_semana || [];

  // Buscar lista de hotéis para os parâmetros de busca
  let listaHoteis = [];
  try {
    const dataH = await api('/hoteis?ativo=true&limit=200');
    listaHoteis = dataH.hoteis || [];
  } catch { /* lista vazia se falhar */ }

  // Pre-popular campos gerenciados de parametros_json
  const scriptAtual = rotina?.script_gerador || '';
  const mostrarParamsBusca = scriptAtual === 'gerar_tarefas_90_dias';
  const jsonParams = rotina?.parametros_json || {};

  const hotelIdsSelecionados = jsonParams['hotel-id']
    ? String(jsonParams['hotel-id']).split(',').map(Number).filter(Boolean)
    : [];
  const todosInicialmente = hotelIdsSelecionados.length === 0;
  const adultosVal = jsonParams.adultos ?? 2;
  const criancasVal = jsonParams.criancas ?? 0;
  const noitesVal = jsonParams['quantidade-noites'] ?? 1;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px">
      <h3>${titulo}</h3>
      <div id="modal-erro-r" class="alert alert-error hidden"></div>
      <form id="form-rotina">
        <div class="form-group">
          <label for="r-nome">Nome</label>
          <input type="text" id="r-nome" required value="${esc(rotina?.nome || '')}">
        </div>
        <div class="form-group">
          <label for="r-tipo">Tipo de Rotina</label>
          <input type="text" id="r-tipo" required value="${esc(rotina?.tipo_rotina || '')}" placeholder="ex: geracao_tarefas_90_dias">
        </div>
        <div class="form-group">
          <label for="r-script">Script Gerador</label>
          <select id="r-script" required>
            <option value="">— Selecione —</option>
            ${SCRIPTS_GERADORES.map((s) =>
              `<option value="${s.valor}" ${rotina?.script_gerador === s.valor ? 'selected' : ''}>${esc(s.label)}</option>`
            ).join('')}
          </select>
        </div>
        <div id="secao-params-busca" style="${mostrarParamsBusca ? '' : 'display:none'}">
          <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb">
          <p style="font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:12px">Parâmetros da Busca</p>
          <div class="form-group">
            <label>Hotéis</label>
            <div class="multiselect" id="ms-hoteis">
              <button type="button" class="multiselect-trigger" id="ms-hoteis-trigger">
                <span id="ms-hoteis-label">${todosInicialmente ? 'Todos os Hotéis Ativos' : `${hotelIdsSelecionados.length} hotel(s) selecionado(s)`}</span>
                <span style="margin-left:auto">&#x25BE;</span>
              </button>
              <div class="multiselect-panel" id="ms-hoteis-panel" style="display:none">
                <div class="multiselect-search">
                  <input type="text" id="r-filtro-hotel" placeholder="Buscar hotel..." autocomplete="off">
                </div>
                <div class="multiselect-options" id="lista-hoteis-busca">
                  <label class="multiselect-option multiselect-option-mestre">
                    <input type="checkbox" id="r-todos-hoteis" ${todosInicialmente ? 'checked' : ''}>
                    <strong>Todos os Hotéis Ativos</strong>
                  </label>
                  <div class="multiselect-divider"></div>
                  ${listaHoteis.length === 0
                    ? '<p style="color:#9ca3af;font-size:13px;padding:6px 10px">Nenhum hotel encontrado.</p>'
                    : listaHoteis.map((h) =>
                        `<label class="multiselect-option" data-nome="${esc(h.nome.toLowerCase())}">
                          <input type="checkbox" name="hotel_busca" value="${h.id}" ${todosInicialmente || hotelIdsSelecionados.includes(h.id) ? 'checked' : ''}> ${esc(h.nome)}
                        </label>`
                      ).join('')
                  }
                </div>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="r-adultos">Adultos</label>
              <input type="number" id="r-adultos" min="1" max="9" value="${adultosVal}">
            </div>
            <div class="form-group">
              <label for="r-criancas">Crianças</label>
              <input type="number" id="r-criancas" min="0" max="9" value="${criancasVal}">
            </div>
            <div class="form-group">
              <label for="r-noites">Noites</label>
              <input type="number" id="r-noites" min="1" max="30" value="${noitesVal}">
            </div>
          </div>
        </div>
        <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb">
        <p style="font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:12px">Agendamento</p>
        <div class="form-row">
          <div class="form-group">
            <label for="r-freq-tipo">Frequência</label>
            <select id="r-freq-tipo" required>
              ${FREQUENCIA_TIPOS.map((t) =>
                `<option value="${t}" ${rotina?.frequencia_tipo === t ? 'selected' : ''}>${FREQUENCIA_LABELS[t]}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group" id="grupo-dia-mes" style="${rotina?.frequencia_tipo === 'mensal' ? '' : 'display:none'}">
            <label for="r-dia-mes">Dia do mês</label>
            <input type="number" id="r-dia-mes" min="1" max="31" value="${rotina?.parametros_json?.dia_do_mes ?? ''}" placeholder="1–31">
          </div>
          <div class="form-group">
            <label for="r-prioridade">Prioridade</label>
            <input type="number" id="r-prioridade" min="0" value="${rotina?.prioridade ?? 5}" title="0=máxima, 10=mínima">
          </div>
        </div>
        <small id="hint-dia-mes" style="color:#9ca3af;display:${rotina?.frequencia_tipo === 'mensal' ? 'block' : 'none'};white-space:normal;word-break:break-word;margin-top:-8px;margin-bottom:12px">Em meses com menos dias (ex: fevereiro), a rotina roda no último dia do mês.</small>
        <div class="form-row">
          <div class="form-group">
            <label for="r-hora-inicio">Horário de início</label>
            <input type="time" id="r-hora-inicio" value="${rotina?.hora_inicio ? rotina.hora_inicio.substring(0,5) : ''}">
          </div>
          <div class="form-group">
            <label for="r-hora-fim">Horário limite</label>
            <input type="time" id="r-hora-fim" value="${rotina?.hora_fim ? rotina.hora_fim.substring(0,5) : ''}">
          </div>
        </div>
        <div class="form-group">
          <label>Dias permitidos <small style="color:#9ca3af">(vazio = todos os dias)</small></label>
          <div class="dias-semana-group">
            ${DIAS_SEMANA.map((d, i) => `
              <label class="checkbox-inline">
                <input type="checkbox" name="dias_semana" value="${i}" ${diasSelecionados.includes(i) ? 'checked' : ''}> ${d}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="modal-actions" style="justify-content:space-between;align-items:center">
          <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin:0">
            <input type="checkbox" id="r-ativo" ${editando ? (rotina?.ativo ? 'checked' : '') : 'checked'}>
            <span id="r-ativo-label">${editando ? (rotina?.ativo ? 'Desativar Rotina' : 'Ativar Rotina') : 'Desativar Rotina'}</span>
          </label>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn btn-secondary" id="btn-cancelar-r">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  // show/hide campo dia_do_mes conforme frequência
  const selectFreq = overlay.querySelector('#r-freq-tipo');
  const grupoDiaMes = overlay.querySelector('#grupo-dia-mes');
  const hintDiaMes = overlay.querySelector('#hint-dia-mes');
  selectFreq.addEventListener('change', () => {
    const isMensal = selectFreq.value === 'mensal';
    grupoDiaMes.style.display = isMensal ? '' : 'none';
    hintDiaMes.style.display = isMensal ? 'block' : 'none';
    if (!isMensal) overlay.querySelector('#r-dia-mes').value = '';
  });

  // show/hide seção de parâmetros de busca conforme script selecionado
  const selectScript = overlay.querySelector('#r-script');
  const secaoParams = overlay.querySelector('#secao-params-busca');
  selectScript.addEventListener('change', () => {
    secaoParams.style.display = selectScript.value === 'gerar_tarefas_90_dias' ? '' : 'none';
  });

  // dropdown multiselect de hotéis
  const msTrigger = overlay.querySelector('#ms-hoteis-trigger');
  const msPanel = overlay.querySelector('#ms-hoteis-panel');
  const msLabel = overlay.querySelector('#ms-hoteis-label');
  const checkTodosHoteis = overlay.querySelector('#r-todos-hoteis');
  const checkboxesHoteis = () => [...overlay.querySelectorAll('input[name="hotel_busca"]')];

  function atualizarLabel() {
    const marcados = checkboxesHoteis().filter((cb) => cb.checked);
    msLabel.textContent = checkTodosHoteis.checked || marcados.length === checkboxesHoteis().length
      ? 'Todos os Hotéis Ativos'
      : marcados.length === 0
        ? 'Nenhum hotel selecionado'
        : `${marcados.length} hotel(s) selecionado(s)`;
  }

  msTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    const aberto = msPanel.style.display !== 'none';
    msPanel.style.display = aberto ? 'none' : 'block';
    if (!aberto) overlay.querySelector('#r-filtro-hotel')?.focus();
  });

  document.addEventListener('click', function fecharMs(e) {
    if (!overlay.querySelector('#ms-hoteis')?.contains(e.target)) {
      msPanel.style.display = 'none';
    }
    if (!document.body.contains(overlay)) {
      document.removeEventListener('click', fecharMs);
    }
  });

  // mestre marca/desmarca todos
  checkTodosHoteis?.addEventListener('change', () => {
    checkboxesHoteis().forEach((cb) => { cb.checked = checkTodosHoteis.checked; });
    atualizarLabel();
  });

  // individual sincroniza mestre
  overlay.querySelector('#lista-hoteis-busca')?.addEventListener('change', (e) => {
    if (e.target.name !== 'hotel_busca') return;
    const todos = checkboxesHoteis();
    checkTodosHoteis.checked = todos.every((cb) => cb.checked);
    checkTodosHoteis.indeterminate = !checkTodosHoteis.checked && todos.some((cb) => cb.checked);
    atualizarLabel();
  });

  // filtro por nome
  overlay.querySelector('#r-filtro-hotel')?.addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    overlay.querySelector('#lista-hoteis-busca')?.querySelectorAll('label[data-nome]').forEach((lbl) => {
      lbl.style.display = lbl.dataset.nome.includes(termo) ? '' : 'none';
    });
  });

  overlay.querySelector('#btn-cancelar-r').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // atualiza label do checkbox ativo/inativo
  const checkAtivo = overlay.querySelector('#r-ativo');
  const labelAtivo = overlay.querySelector('#r-ativo-label');
  checkAtivo.addEventListener('change', () => {
    labelAtivo.textContent = checkAtivo.checked ? 'Desativar Rotina' : 'Ativar Rotina';
  });

  overlay.querySelector('#form-rotina').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroDiv = overlay.querySelector('#modal-erro-r');
    erroDiv.classList.add('hidden');

    const diasMarcados = [...overlay.querySelectorAll('input[name="dias_semana"]:checked')]
      .map((cb) => Number(cb.value));

    let parametros_json = {};

    // dia_do_mes para rotinas mensais
    const freqTipo = document.getElementById('r-freq-tipo').value;
    const diaMesVal = document.getElementById('r-dia-mes')?.value;
    if (freqTipo === 'mensal' && diaMesVal) {
      const diaMes = Number(diaMesVal);
      if (!Number.isInteger(diaMes) || diaMes < 1 || diaMes > 31) {
        erroDiv.textContent = 'Dia do mês deve ser entre 1 e 31.';
        erroDiv.classList.remove('hidden');
        return;
      }
      parametros_json = { ...parametros_json, dia_do_mes: diaMes };
    } else {
      // remove dia_do_mes se frequência mudou para não-mensal
      delete parametros_json.dia_do_mes;
    }

    // parâmetros de busca para gerar_tarefas_90_dias
    const scriptSelecionado = document.getElementById('r-script').value;
    if (scriptSelecionado === 'gerar_tarefas_90_dias') {
      const todosAtivos = overlay.querySelector('#r-todos-hoteis')?.checked;
      if (todosAtivos) {
        delete parametros_json['hotel-id'];
      } else {
        const hotelIds = [...overlay.querySelectorAll('input[name="hotel_busca"]:checked')]
          .map((cb) => cb.value);
        if (hotelIds.length > 0) {
          parametros_json['hotel-id'] = hotelIds.join(',');
        } else {
          delete parametros_json['hotel-id'];
        }
      }
      parametros_json.adultos = Number(document.getElementById('r-adultos').value) || 2;
      parametros_json.criancas = Number(document.getElementById('r-criancas').value) || 0;
      parametros_json['quantidade-noites'] = Number(document.getElementById('r-noites').value) || 1;
    } else {
      delete parametros_json['hotel-id'];
      delete parametros_json.adultos;
      delete parametros_json.criancas;
      delete parametros_json['quantidade-noites'];
    }

    const dados = {
      nome: document.getElementById('r-nome').value.trim(),
      tipo_rotina: document.getElementById('r-tipo').value.trim(),
      script_gerador: document.getElementById('r-script').value.trim(),
      frequencia_tipo: document.getElementById('r-freq-tipo').value,
      frequencia_valor: 1,
      prioridade: Number(document.getElementById('r-prioridade').value ?? 5),
      hora_inicio: document.getElementById('r-hora-inicio').value || null,
      hora_fim: document.getElementById('r-hora-fim').value || null,
      dias_semana: diasMarcados.length > 0 ? diasMarcados : null,
      parametros_json,
      ativo: document.getElementById('r-ativo').checked,
    };

    try {
      if (editando) {
        await api(`/rotinas/${rotina.id}`, { method: 'PUT', body: dados });
      } else {
        await api('/rotinas', { method: 'POST', body: dados });
      }
      overlay.remove();
      await renderRotinas(container);
    } catch (err) {
      erroDiv.textContent = err.message;
      erroDiv.classList.remove('hidden');
    }
  });
}

// ── Modal execuções ────────────────────────────────────────────────────────────

async function abrirExecucoes(id) {
  const rotina = rotinas.find((r) => String(r.id) === String(id));
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:700px">
      <h3>Execuções — ${esc(rotina?.nome || id)}</h3>
      <div id="exec-conteudo"><p>Carregando...</p></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="btn-fechar-exec">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#btn-fechar-exec').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  try {
    const data = await api(`/rotinas/${id}/execucoes?limite=20`);
    const execucoes = data.execucoes;
    const conteudo = overlay.querySelector('#exec-conteudo');

    if (!execucoes.length) {
      conteudo.innerHTML = '<div class="empty-state"><p>Nenhuma execução registrada.</p></div>';
      return;
    }

    conteudo.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Status</th>
              <th>Tarefas geradas</th>
              <th>Duração</th>
              <th>Mensagem / Erro</th>
            </tr>
          </thead>
          <tbody>
            ${execucoes.map((e) => `
              <tr>
                <td><small>${formatarData(e.executada_em)}</small></td>
                <td><span class="badge ${badgeExecucao(e.status)}">${esc(e.status)}</span></td>
                <td>${e.tarefas_geradas ?? '-'}</td>
                <td>${e.duracao_ms != null ? `${e.duracao_ms} ms` : '-'}</td>
                <td><small style="color:#888">${esc(e.erro || e.mensagem || '-')}</small></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    overlay.querySelector('#exec-conteudo').innerHTML =
      `<div class="alert alert-error">${err.message}</div>`;
  }
}

// ── Ações ──────────────────────────────────────────────────────────────────────

async function alterarAtivo(id, ativoAtual) {
  try {
    await api(`/rotinas/${id}/ativo`, { method: 'PATCH', body: { ativo: !ativoAtual } });
    await renderRotinas(document.getElementById('app'));
  } catch (err) {
    alert(err.message);
  }
}

async function executarAgora(id) {
  const rotina = rotinas.find((r) => String(r.id) === String(id));
  if (!confirm(`Forçar execução de "${rotina?.nome}"?`)) return;

  try {
    await api(`/rotinas/${id}/executar`, { method: 'POST' });
    await renderRotinas(document.getElementById('app'));
  } catch (err) {
    alert(err.message);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatarAgendamento(r) {
  if (!r.frequencia_tipo) return '-';

  const label = FREQUENCIA_LABELS[r.frequencia_tipo] || r.frequencia_tipo;

  let texto;
  if (r.frequencia_tipo === 'minutos') {
    texto = `A cada ${r.frequencia_valor ?? 1} min`;
  } else if (r.frequencia_tipo === 'horas') {
    texto = `A cada ${r.frequencia_valor ?? 1}h`;
  } else if (r.frequencia_tipo === 'mensal') {
    const dia = r.parametros_json?.dia_do_mes;
    texto = dia ? `${label} — dia ${dia}` : label;
  } else {
    texto = label;
  }

  const horaInicio = r.hora_inicio ? r.hora_inicio.substring(0, 5) : null;
  const horaFim = r.hora_fim ? r.hora_fim.substring(0, 5) : null;
  if (horaInicio) {
    texto += ` | ${horaInicio}${horaFim ? '–' + horaFim : ''}`;
  }

  if (r.dias_semana?.length) {
    texto += `<br><span style="color:#6b7280">${r.dias_semana.map(d => DIAS_SEMANA[d]).join(', ')}</span>`;
  }

  return texto;
}

function formatarData(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function badgeExecucao(status) {
  if (status === 'sucesso') return 'badge-active';
  if (status === 'erro') return 'badge-inactive';
  return 'badge-pending';
}

function esc(str) {
  if (!str) return '';
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}
