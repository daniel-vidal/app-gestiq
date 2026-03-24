// Criar tarefas de monitoramento mensal para os próximos 90 dias, considerando os hotéis ativos e suas prioridades.
// Para rodar agora: `node mod-scraper/src/tarefas/gerar_tarefas_90_dias.js --debug`
// Para rodar agendado para uma data futura: `node mod-scraper/src/tarefas/gerar_tarefas_90_dias.js --debug --agendada-para="2026-03-24 06:00:00"`
// Para rodar para um hotel específico: `node mod-scraper/src/tarefas/gerar_tarefas_90_dias.js --hotel-id=1 --debug`

require('dotenv').config();

const pool = require('../db/pool');

function adicionarDias(data, dias) {
  const nova = new Date(data);
  nova.setHours(12, 0, 0, 0);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

function formatarDataISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function primeiroDiaDoMes(data) {
  return new Date(data.getFullYear(), data.getMonth(), 1, 12, 0, 0, 0);
}

function obterMesesNoIntervalo(dataInicio, quantidadeDias) {
  const meses = new Map();

  for (let i = 0; i < quantidadeDias; i++) {
    const data = adicionarDias(dataInicio, i);
    const inicioMes = primeiroDiaDoMes(data);
    const chave = formatarDataISO(inicioMes);

    if (!meses.has(chave)) {
      meses.set(chave, {
        mes_referencia: chave
      });
    }
  }

  return Array.from(meses.values()).sort((a, b) =>
    a.mes_referencia.localeCompare(b.mes_referencia)
  );
}

function obterArgumento(nome) {
  const prefixo = `${nome}=`;
  const arg = process.argv.find((item) => item.startsWith(prefixo));
  return arg ? arg.slice(prefixo.length) : null;
}

function agoraNormalizadoParaMinuto() {
  const data = new Date();
  data.setSeconds(0, 0);
  return data;
}

function normalizarAgendadaPara(valor) {
  if (!valor) return null;

  const texto = String(valor).trim();
  const ajustado = texto.includes(' ') ? texto.replace(' ', 'T') : texto;
  const data = new Date(ajustado);

  if (Number.isNaN(data.getTime())) {
    throw new Error(`Data inválida para --agendada-para: ${valor}`);
  }

  data.setSeconds(0, 0);
  return data;
}

function construirConsultaMes(dataMes, dataBase, quantidadeNoites) {
  const primeiroMes = primeiroDiaDoMes(dataMes);

  const base = new Date(dataBase);
  base.setHours(12, 0, 0, 0);

  const mesmoMesEAno =
    primeiroMes.getFullYear() === base.getFullYear() &&
    primeiroMes.getMonth() === base.getMonth();

  const checkinDate = mesmoMesEAno ? new Date(base) : new Date(primeiroMes);
  const checkoutDate = adicionarDias(checkinDate, quantidadeNoites);

  return {
    mes_referencia: formatarDataISO(primeiroMes),
    checkin_consulta: formatarDataISO(checkinDate),
    checkout_consulta: formatarDataISO(checkoutDate)
  };
}

async function buscarHoteisAtivos(client, hotelId = null) {
  let sql = `
    SELECT
      id,
      nome,
      regiao_id,
      prioridade_monitoramento,
      hotel_base,
      ativo
    FROM mod_scraper.hoteis_monitorados
    WHERE ativo = TRUE
  `;

  const params = [];

  if (hotelId) {
    sql += ` AND id = $1`;
    params.push(hotelId);
  }

  sql += `
    ORDER BY
      prioridade_monitoramento ASC,
      hotel_base DESC,
      id ASC
  `;

  const { rows } = await client.query(sql, params);
  return rows;
}

async function inserirTarefa(client, tarefa) {
  const sql = `
    INSERT INTO mod_scraper.scraping_tarefas (
      tipo_tarefa,
      tipo_coleta,
      hotel_id,
      regiao_id,
      mes_referencia,
      checkin_consulta,
      checkout_consulta,
      adultos,
      criancas,
      quantidade_noites,
      fonte,
      prioridade,
      status,
      agendada_para,
      payload
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5::date,
      $6::date,
      $7::date,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $15::jsonb
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `;

  const values = [
    tarefa.tipo_tarefa,
    tarefa.tipo_coleta,
    tarefa.hotel_id,
    tarefa.regiao_id,
    tarefa.mes_referencia,
    tarefa.checkin_consulta,
    tarefa.checkout_consulta,
    tarefa.adultos,
    tarefa.criancas,
    tarefa.quantidade_noites,
    tarefa.fonte,
    tarefa.prioridade,
    tarefa.status,
    tarefa.agendada_para,
    JSON.stringify(tarefa.payload || {})
  ];

  const { rows } = await client.query(sql, values);
  return rows[0] || null;
}

async function gerarTarefas90Dias(opcoes = {}) {
  const client = await pool.connect();

  const agendadaPara = opcoes.agendadaPara || agoraNormalizadoParaMinuto();

  const baseData = opcoes.dataBase
    ? new Date(opcoes.dataBase)
    : (opcoes.agendadaPara ? new Date(opcoes.agendadaPara) : new Date());

  baseData.setHours(12, 0, 0, 0);

  const quantidadeDias = Number(opcoes.quantidadeDias ?? 90);
  const adultos = Number(opcoes.adultos ?? 2);
  const criancas = Number(opcoes.criancas ?? 0);
  const quantidadeNoites = Number(opcoes.quantidadeNoites ?? 1);
  const fonte = opcoes.fonte || 'booking_mobile';
  const tipoTarefa = opcoes.tipoTarefa || 'monitoramento_mensal';
  const tipoColeta = opcoes.tipoColeta || 'calendario_mensal';
  const status = opcoes.status || 'pendente';
  const debug = Boolean(opcoes.debug);

  try {
    const hoteis = await buscarHoteisAtivos(client, opcoes.hotelId);
    const meses = obterMesesNoIntervalo(baseData, quantidadeDias);

    let totalTentadas = 0;
    let totalCriadas = 0;
    let totalIgnoradas = 0;

    const detalhes = [];

    if (debug) {
      console.log('[gerador] hotéis ativos:', hoteis.length);
      console.log('[gerador] meses:', meses);
      console.log('[gerador] agendadaPara:', agendadaPara.toISOString());
      console.log('[gerador] dataBase:', formatarDataISO(baseData));
      console.log('[gerador] hotelId filtro:', opcoes.hotelId || null);
    }

    for (const hotel of hoteis) {
      for (const mes of meses) {
        totalTentadas += 1;

        const dataMes = new Date(`${mes.mes_referencia}T12:00:00`);
        const consultaMes = construirConsultaMes(dataMes, baseData, quantidadeNoites);

        const prioridadeBase = Number(hotel.prioridade_monitoramento || 5);
        const prioridade = hotel.hotel_base
          ? Math.max(1, prioridadeBase - 1)
          : prioridadeBase;

        const tarefa = {
          tipo_tarefa: tipoTarefa,
          tipo_coleta: tipoColeta,
          hotel_id: hotel.id,
          regiao_id: hotel.regiao_id,
          mes_referencia: consultaMes.mes_referencia,
          checkin_consulta: consultaMes.checkin_consulta,
          checkout_consulta: consultaMes.checkout_consulta,
          adultos,
          criancas,
          quantidade_noites: quantidadeNoites,
          fonte,
          prioridade,
          status,
          agendada_para: agendadaPara,
          payload: {
            origem: 'gerar_tarefas_90_dias',
            versao: 6,
            hotel_nome: hotel.nome,
            hotel_base: Boolean(hotel.hotel_base),
            prioridade_hotel_original: prioridadeBase,
            periodo_dias: quantidadeDias,
            data_base: formatarDataISO(baseData),
            adultos,
            criancas,
            quantidade_noites: quantidadeNoites,
            fonte,
            agendada_para_normalizada: agendadaPara.toISOString()
          }
        };

        const inserida = await inserirTarefa(client, tarefa);

        if (inserida) {
          totalCriadas += 1;

          if (debug) {
            detalhes.push({
              acao: 'criada',
              tarefa_id: inserida.id,
              hotel_id: hotel.id,
              hotel_nome: hotel.nome,
              mes_referencia: tarefa.mes_referencia,
              checkin_consulta: tarefa.checkin_consulta,
              checkout_consulta: tarefa.checkout_consulta,
              prioridade: tarefa.prioridade,
              agendada_para: tarefa.agendada_para.toISOString()
            });
          }
        } else {
          totalIgnoradas += 1;

          if (debug) {
            detalhes.push({
              acao: 'ignorada_duplicada',
              hotel_id: hotel.id,
              hotel_nome: hotel.nome,
              mes_referencia: tarefa.mes_referencia,
              checkin_consulta: tarefa.checkin_consulta,
              checkout_consulta: tarefa.checkout_consulta,
              agendada_para: tarefa.agendada_para.toISOString()
            });
          }
        }
      }
    }

    return {
      ok: true,
      data_base: formatarDataISO(baseData),
      quantidade_dias: quantidadeDias,
      hoteis_ativos: hoteis.length,
      meses_processados: meses.length,
      agendada_para: agendadaPara.toISOString(),
      total_tentadas: totalTentadas,
      total_criadas: totalCriadas,
      total_ignoradas: totalIgnoradas,
      detalhes: debug ? detalhes : undefined
    };
  } finally {
    client.release();
  }
}

module.exports = {
  gerarTarefas90Dias
};

if (require.main === module) {
  (async () => {
    const debug = process.argv.includes('--debug');
    const agendadaParaArg = obterArgumento('--agendada-para');
    const agendadaPara = normalizarAgendadaPara(agendadaParaArg);
    const hotelIdArg = obterArgumento('--hotel-id');
    const hotelId = hotelIdArg ? Number(hotelIdArg) : null;

    const resultado = await gerarTarefas90Dias({
      debug,
      agendadaPara,
      hotelId
    });

    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.ok ? 0 : 1);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}