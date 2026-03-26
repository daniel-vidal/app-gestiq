require('dotenv').config();

const path = require('path');
const { spawn } = require('child_process');
const pool = require('../db/pool');
const { calcularProximaExecucao } = require('./calcularProximaExecucao');

function montarCaminhoScript(scriptGerador) {
  if (!scriptGerador) {
    throw new Error('script_gerador não informado na rotina.');
  }

  return path.resolve(__dirname, '..', 'tarefas', `${scriptGerador}.js`);
}

function montarArgs(parametrosJson) {
  const args = [];
  const params = parametrosJson || {};

  for (const [chave, valor] of Object.entries(params)) {
    if (valor === null || valor === undefined || valor === false) {
      continue;
    }

    if (valor === true) {
      args.push(`--${chave}`);
      continue;
    }

    args.push(`--${chave}=${valor}`);
  }

  return args;
}

function executarScriptNode(scriptPath, args = [], opcoes = {}) {
  const debug = Boolean(opcoes.debug);

  return new Promise((resolve, reject) => {
    const processo = spawn('node', [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    processo.stdout.on('data', (chunk) => {
      const texto = chunk.toString();
      stdout += texto;

      if (debug && texto.trim()) {
        console.log(`[agendador][stdout] ${texto.trimEnd()}`);
      }
    });

    processo.stderr.on('data', (chunk) => {
      const texto = chunk.toString();
      stderr += texto;

      if (debug && texto.trim()) {
        console.error(`[agendador][stderr] ${texto.trimEnd()}`);
      }
    });

    processo.on('error', (err) => {
      reject(err);
    });

    processo.on('close', (code) => {
      if (code === 0) {
        resolve({
          code,
          stdout,
          stderr
        });
      } else {
        reject(
          new Error(
            `Script finalizou com código ${code}. STDERR: ${stderr || '(vazio)'}`
          )
        );
      }
    });
  });
}

function extrairTarefasGeradas(stdout) {
  if (!stdout || !stdout.trim()) {
    return 0;
  }

  const texto = stdout.trim();

  try {
    const json = JSON.parse(texto);

    if (Number.isFinite(Number(json?.tarefas_geradas))) {
      return Number(json.tarefas_geradas);
    }

    if (Number.isFinite(Number(json?.total_tarefas))) {
      return Number(json.total_tarefas);
    }

    return 0;
  } catch (_) {
    return 0;
  }
}

function resumirTexto(texto, limite = 4000) {
  if (!texto) return null;
  const txt = String(texto).trim();
  if (!txt) return null;
  return txt.length > limite ? txt.slice(0, limite) : txt;
}

function chaveDataLocal(valor) {
  const dt = new Date(valor);

  const ano = dt.getFullYear();
  const mes = String(dt.getMonth() + 1).padStart(2, '0');
  const dia = String(dt.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

function calcularNovoTotalDiasExecucao(rotina, agora = new Date()) {
  const totalAtual = Number(rotina.total_dias_execucao || 0);

  if (!rotina.ultima_execucao_em) {
    return totalAtual + 1;
  }

  const chaveAnterior = chaveDataLocal(rotina.ultima_execucao_em);
  const chaveAtual = chaveDataLocal(agora);

  return chaveAnterior === chaveAtual ? totalAtual : totalAtual + 1;
}

async function registrarExecucaoRotina(client, dados) {
  const sql = `
    INSERT INTO mod_scraper.rotinas_agendadas_execucoes (
      rotina_id,
      executada_em,
      status,
      mensagem,
      tarefas_geradas,
      duracao_ms,
      erro,
      criado_em
    )
    VALUES ($1, NOW(), $2, $3, $4, $5, $6, NOW())
  `;

  await client.query(sql, [
    dados.rotina_id,
    dados.status,
    dados.mensagem || null,
    Number(dados.tarefas_geradas || 0),
    dados.duracao_ms != null ? Number(dados.duracao_ms) : null,
    dados.erro || null
  ]);
}

async function atualizarRotinaPosExecucao(client, rotina, agora) {
  const proximaExecucao = calcularProximaExecucao(rotina, agora);
  const totalExecucoes = Number(rotina.total_execucoes || 0) + 1;
  const totalDiasExecucao = calcularNovoTotalDiasExecucao(rotina, agora);

  const sql = `
    UPDATE mod_scraper.rotinas_agendadas
       SET ultima_execucao_em = $2,
           proxima_execucao_em = $3,
           total_execucoes = $4,
           total_dias_execucao = $5,
           atualizada_em = NOW()
     WHERE id = $1
  `;

  await client.query(sql, [
    rotina.id,
    agora,
    proximaExecucao,
    totalExecucoes,
    totalDiasExecucao
  ]);

  return {
    proxima_execucao_em: proximaExecucao,
    total_execucoes: totalExecucoes,
    total_dias_execucao: totalDiasExecucao
  };
}

async function executarRotinaAgendada(rotina, opcoes = {}) {
  const debug = Boolean(opcoes.debug);
  const inicioMs = Date.now();
  const agora = new Date();
  const client = await pool.connect();

  try {
    if (!rotina) {
      throw new Error('Rotina não informada.');
    }

    if (!rotina.ativo) {
      await registrarExecucaoRotina(client, {
        rotina_id: rotina.id,
        status: 'ignorada',
        mensagem: 'Rotina inativa ignorada.',
        tarefas_geradas: 0,
        duracao_ms: Date.now() - inicioMs,
        erro: null
      });

      return {
        ok: false,
        rotina_id: rotina.id,
        nome: rotina.nome,
        ignorada: true,
        motivo: 'Rotina inativa'
      };
    }

    const scriptPath = montarCaminhoScript(rotina.script_gerador);
    const args = montarArgs(rotina.parametros_json);

    if (debug) {
      console.log(`[agendador] executando rotina ${rotina.id} - ${rotina.nome}`);
      console.log(`[agendador] script: ${scriptPath}`);
      console.log(`[agendador] args: ${JSON.stringify(args)}`);
    }

    const resultadoExecucao = await executarScriptNode(scriptPath, args, { debug });

    const tarefasGeradas = extrairTarefasGeradas(resultadoExecucao.stdout);
    const duracaoMs = Date.now() - inicioMs;

    const resumoAtualizacao = await atualizarRotinaPosExecucao(client, rotina, agora);

    await registrarExecucaoRotina(client, {
      rotina_id: rotina.id,
      status: 'sucesso',
      mensagem: resumirTexto(resultadoExecucao.stdout || 'Execução concluída com sucesso.'),
      tarefas_geradas: tarefasGeradas,
      duracao_ms: duracaoMs,
      erro: null
    });

    return {
      ok: true,
      rotina_id: rotina.id,
      nome: rotina.nome,
      script_gerador: rotina.script_gerador,
      tarefas_geradas: tarefasGeradas,
      duracao_ms: duracaoMs,
      proxima_execucao_em: resumoAtualizacao.proxima_execucao_em,
      total_execucoes: resumoAtualizacao.total_execucoes,
      total_dias_execucao: resumoAtualizacao.total_dias_execucao
    };
  } catch (err) {
    const duracaoMs = Date.now() - inicioMs;

    try {
      await registrarExecucaoRotina(client, {
        rotina_id: rotina?.id || null,
        status: 'erro',
        mensagem: null,
        tarefas_geradas: 0,
        duracao_ms: duracaoMs,
        erro: resumirTexto(err?.stack || err?.message || String(err))
      });
    } catch (erroLog) {
      console.error('[agendador] falha ao registrar erro da rotina:', erroLog);
    }

    return {
      ok: false,
      rotina_id: rotina?.id || null,
      nome: rotina?.nome || null,
      erro: err?.message || String(err),
      duracao_ms: duracaoMs
    };
  } finally {
    client.release();
  }
}

module.exports = { executarRotinaAgendada };