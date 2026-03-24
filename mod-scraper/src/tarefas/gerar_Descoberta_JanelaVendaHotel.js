require('dotenv').config();

const pool = require('../db/pool');

function obterArgumento(nome) {
  const prefixo = `${nome}=`;
  const arg = process.argv.find((item) => item.startsWith(prefixo));
  return arg ? arg.slice(prefixo.length) : null;
}

function adicionarMeses(data, meses) {
  const nova = new Date(data);
  nova.setDate(1);
  nova.setHours(12, 0, 0, 0);
  nova.setMonth(nova.getMonth() + meses);
  return nova;
}

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

function formatarMesISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

function primeiroDiaDoMes(data) {
  return new Date(data.getFullYear(), data.getMonth(), 1, 12, 0, 0, 0);
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

async function buscarConfiguracao(client, chave, valorPadrao = null) {
  const sql = `
    SELECT valor
    FROM mod_scraper.configuracoes
    WHERE chave = $1
    LIMIT 1
  `;
  const { rows } = await client.query(sql, [chave]);
  return rows[0]?.valor ?? valorPadrao;
}

async function buscarHotelPorId(client, hotelId) {
  const sql = `
    SELECT id, nome, regiao_id, ativo
    FROM mod_scraper.hoteis_monitorados
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await client.query(sql, [hotelId]);
  return rows[0] || null;
}

async function inserirTarefa(client, tarefa, debug = false) {
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
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pendente',NOW(),$13::jsonb
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
    JSON.stringify(tarefa.payload || {})
  ];

  const { rows } = await client.query(sql, values);

  if (rows.length === 0) {
    if (debug) console.log('[tarefa] ignorada (duplicada)');
    return { acao: 'ignorada_duplicada' };
  }

  return { acao: 'criada', id: rows[0].id };
}

async function gerarDescobertaJanelaVendaHotel({ hotelId, debug = false }) {
  const client = await pool.connect();

  try {
    const hotel = await buscarHotelPorId(client, hotelId);
    if (!hotel) {
      throw new Error(`Hotel ${hotelId} não encontrado`);
    }

    const horizonteMeses = Number(
      await buscarConfiguracao(client, 'janela_venda_horizonte_meses', '18')
    );

    const adultos = Number(
      await buscarConfiguracao(client, 'janela_venda_adultos', '2')
    );

    const criancas = Number(
      await buscarConfiguracao(client, 'janela_venda_criancas', '0')
    );

    const fonte = await buscarConfiguracao(
      client,
      'janela_venda_fonte',
      'booking_mobile'
    );

    const baseData = new Date();
    baseData.setHours(12, 0, 0, 0);

    const resultados = [];

    for (let i = 0; i < horizonteMeses; i++) {
      const dataMes = adicionarMeses(baseData, i);
      const consultaMes = construirConsultaMes(dataMes, baseData, 1);

      const tarefa = {
        tipo_tarefa: 'descoberta_janela_venda',
        tipo_coleta: 'calendario_mensal',
        hotel_id: hotel.id,
        regiao_id: hotel.regiao_id,
        mes_referencia: new Date(`${consultaMes.mes_referencia}T12:00:00`),
        checkin_consulta: new Date(`${consultaMes.checkin_consulta}T12:00:00`),
        checkout_consulta: new Date(`${consultaMes.checkout_consulta}T12:00:00`),
        adultos,
        criancas,
        quantidade_noites: 1,
        fonte,
        prioridade: 1,
        payload: {
          origem: 'descoberta_janela_venda',
          versao: 2,
          mes_ref: formatarMesISO(dataMes),
          data_base: formatarDataISO(baseData)
        }
      };

      const resultado = await inserirTarefa(client, tarefa, debug);

      resultados.push({
        mes: formatarMesISO(dataMes),
        mes_referencia: consultaMes.mes_referencia,
        checkin_consulta: consultaMes.checkin_consulta,
        checkout_consulta: consultaMes.checkout_consulta,
        ...resultado
      });
    }

    return {
      ok: true,
      hotel_id: hotel.id,
      hotel_nome: hotel.nome,
      horizonte_meses: horizonteMeses,
      resultados
    };
  } finally {
    client.release();
  }
}

module.exports = {
  gerarDescobertaJanelaVendaHotel
};

if (require.main === module) {
  (async () => {
    const debug = process.argv.includes('--debug');
    const hotelId = obterArgumento('--hotel-id');

    const resultado = await gerarDescobertaJanelaVendaHotel({
      hotelId,
      debug
    });

    console.log(JSON.stringify(resultado, null, 2));
    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}