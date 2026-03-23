require('dotenv').config();

const pool = require('../db/pool');

function adicionarDias(data, dias) {
  const nova = new Date(data);
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
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

function obterMesesNoIntervalo(dataInicio, quantidadeDias) {
  const meses = new Map();

  for (let i = 0; i < quantidadeDias; i++) {
    const data = adicionarDias(dataInicio, i);
    const primeiroDia = primeiroDiaDoMes(data);
    const chave = formatarDataISO(primeiroDia);

    if (!meses.has(chave)) {
      meses.set(chave, {
        mes_referencia: chave,
        checkin_consulta: formatarDataISO(primeiroDia),
        checkout_consulta: formatarDataISO(adicionarDias(primeiroDia, 1))
      });
    }
  }

  return Array.from(meses.values()).sort((a, b) =>
    a.mes_referencia.localeCompare(b.mes_referencia)
  );
}

async function buscarHoteisAtivos(client) {
  const sql = `
    SELECT
      id,
      nome,
      regiao_id,
      prioridade_monitoramento,
      hotel_base,
      ativo
    FROM mod_scraper.hoteis_monitorados
    WHERE ativo = TRUE
    ORDER BY
      prioridade_monitoramento ASC,
      hotel_base DESC,
      id ASC
  `;

  const { rows } = await client.query(sql);
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
      $1, $2, $3, $4, $5::date, $6::date, $7::date,
      $8, $9, $10, $11, $12, $13, $14, $15::jsonb
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
    JSON.stringify(tarefa.payload)
  ];

  const { rows } = await client.query(sql, values);
  return rows[0] || null;
}

async function gerarTarefas90Dias(opcoes = {}) {
  const client = await pool.connect();

  const hoje = opcoes.dataBase ? new Date(opcoes.dataBase) : new Date();
  const quantidadeDias = Number(opcoes.quantidadeDias || 90);

  const adultos = Number(opcoes.adultos ?? 2);
  const criancas = Number(opcoes.criancas ?? 0);
  const quantidadeNoites = Number(opcoes.quantidadeNoites ?? 1);
  const fonte = opcoes.fonte || 'booking_mobile';
  const tipoTarefa = opcoes.tipoTarefa || 'monitoramento_mensal';
  const tipoColeta = opcoes.tipoColeta || 'calendario_mensal';
  const status = opcoes.status || 'pendente';
  const debug = Boolean(opcoes.debug);

  try {
    const hoteis = await buscarHoteisAtivos(client);
    const meses = obterMesesNoIntervalo(hoje, quantidadeDias);

    let totalTentadas = 0;
    let totalCriadas = 0;
    let totalIgnoradas = 0;

    const detalhes = [];

    if (debug) {
      console.log('[gerador] Hotéis ativos:', hoteis.length);
      console.log('[gerador] Meses encontrados:', meses);
    }

    for (const hotel of hoteis) {
      for (const mes of meses) {
        totalTentadas += 1;

        const prioridadeBase = Number(hotel.prioridade_monitoramento || 5);
        const prioridade = hotel.hotel_base
          ? Math.max(1, prioridadeBase - 1)
          : prioridadeBase;

        const tarefa = {
          tipo_tarefa: tipoTarefa,
          tipo_coleta: tipoColeta,
          hotel_id: hotel.id,
          regiao_id: hotel.regiao_id,
          mes_referencia: mes.mes_referencia,
          checkin_consulta: mes.checkin_consulta,
          checkout_consulta: formatarDataISO(
            adicionarDias(new Date(mes.checkin_consulta), quantidadeNoites)
          ),
          adultos,
          criancas,
          quantidade_noites: quantidadeNoites,
          fonte,
          prioridade,
          status,
          agendada_para: new Date().toISOString(),
          payload: {
            origem: 'gerar_tarefas_90_dias',
            hotel_nome: hotel.nome,
            periodo_dias: quantidadeDias,
            data_base: formatarDataISO(hoje),
            hotel_base: Boolean(hotel.hotel_base)
          }
        };

        const inserida = await inserirTarefa(client, tarefa);

        if (inserida) {
          totalCriadas += 1;
          detalhes.push({
            acao: 'criada',
            tarefa_id: inserida.id,
            hotel_id: hotel.id,
            hotel_nome: hotel.nome,
            mes_referencia: mes.mes_referencia
          });
        } else {
          totalIgnoradas += 1;
          detalhes.push({
            acao: 'ignorada_duplicada',
            hotel_id: hotel.id,
            hotel_nome: hotel.nome,
            mes_referencia: mes.mes_referencia
          });
        }
      }
    }

    return {
      ok: true,
      data_base: formatarDataISO(hoje),
      quantidade_dias: quantidadeDias,
      hoteis_ativos: hoteis.length,
      meses_processados: meses.length,
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

    const resultado = await gerarTarefas90Dias({
      debug
    });

    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.ok ? 0 : 1);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}