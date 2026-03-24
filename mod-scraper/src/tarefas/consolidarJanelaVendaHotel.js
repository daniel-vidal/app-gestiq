require('dotenv').config();

const pool = require('../db/pool');

function obterArgumento(nome) {
  const prefixo = `${nome}=`;
  const arg = process.argv.find((item) => item.startsWith(prefixo));
  return arg ? arg.slice(prefixo.length) : null;
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
    SELECT
      id,
      nome,
      regiao_id,
      ativo
    FROM mod_scraper.hoteis_monitorados
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await client.query(sql, [hotelId]);
  return rows[0] || null;
}

async function buscarMesesDescobertaHotel(client, hotelId, horizonteMeses) {
  const sql = `
    WITH meses_descoberta AS (
      SELECT DISTINCT
        t.hotel_id,
        t.mes_referencia::date AS mes_referencia
      FROM mod_scraper.scraping_tarefas t
      WHERE t.hotel_id = $1
        AND t.tipo_tarefa = 'descoberta_janela_venda'
      ORDER BY t.mes_referencia
      LIMIT $2
    )
    SELECT
      md.hotel_id,
      md.mes_referencia,
      EXISTS (
        SELECT 1
        FROM mod_scraper.tarifas_monitoradas tm
        WHERE tm.hotel_id = md.hotel_id
          AND tm.mes_referencia = md.mes_referencia
          AND COALESCE(tm.disponivel, FALSE) = TRUE
          AND tm.menor_preco IS NOT NULL
          AND tm.menor_preco > 0
      ) AS tem_preco,
      (
        SELECT COUNT(*)
        FROM mod_scraper.tarifas_monitoradas tm
        WHERE tm.hotel_id = md.hotel_id
          AND tm.mes_referencia = md.mes_referencia
          AND COALESCE(tm.disponivel, FALSE) = TRUE
          AND tm.menor_preco IS NOT NULL
          AND tm.menor_preco > 0
      )::int AS qtd_tarifas_com_preco,
      (
        SELECT MAX(tm.data_ultima_consulta)
        FROM mod_scraper.tarifas_monitoradas tm
        WHERE tm.hotel_id = md.hotel_id
          AND tm.mes_referencia = md.mes_referencia
      ) AS ultima_consulta_mes
    FROM meses_descoberta md
    ORDER BY md.mes_referencia
  `;

  const { rows } = await client.query(sql, [hotelId, horizonteMeses]);
  return rows;
}

function formatarMesCurto(valor) {
  const data = new Date(valor);
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

function calcularMetricas(meses) {
  const totalMeses = meses.length;
  const mesesComPreco = meses.filter((m) => m.tem_preco);
  const mesesSemPreco = meses.filter((m) => !m.tem_preco);

  const percentualMesesComPreco = totalMeses > 0
    ? Number(((mesesComPreco.length / totalMeses) * 100).toFixed(2))
    : 0;

  const primeiroMesComPreco = mesesComPreco[0]?.mes_referencia || null;
  const ultimoMesComPreco = mesesComPreco.length > 0
    ? mesesComPreco[mesesComPreco.length - 1].mes_referencia
    : null;

  let mesesAVendaEstimado = 0;
  if (mesesComPreco.length > 0) {
    const ultimoIndiceComPreco = meses.findLastIndex((m) => m.tem_preco);
    mesesAVendaEstimado = ultimoIndiceComPreco + 1;
  }

  let mesesAVendaConfirmado = 0;
  for (const mes of meses) {
    if (mes.tem_preco) {
      mesesAVendaConfirmado += 1;
    } else {
      break;
    }
  }

  let primeiroMesSemPreco = null;
  if (mesesAVendaConfirmado < meses.length) {
    primeiroMesSemPreco = meses[mesesAVendaConfirmado]?.mes_referencia || null;
  }

  const aparentaInativoBooking = mesesComPreco.length === 0;

  return {
    totalMeses,
    percentualMesesComPreco,
    primeiroMesComPreco,
    ultimoMesComPreco,
    primeiroMesSemPreco,
    mesesAVendaEstimado,
    mesesAVendaConfirmado,
    aparentaInativoBooking,
    mesesComPrecoCurto: mesesComPreco.map((m) => formatarMesCurto(m.mes_referencia)),
    mesesSemPrecoCurto: mesesSemPreco.map((m) => formatarMesCurto(m.mes_referencia))
  };
}

async function upsertJanelaVenda(client, payload) {
  const sql = `
    INSERT INTO mod_scraper.hoteis_janela_venda (
      hotel_id,
      meses_a_venda_estimado,
      meses_a_venda_confirmado,
      primeiro_mes_com_preco,
      ultimo_mes_com_preco,
      primeiro_mes_sem_preco,
      percentual_meses_com_preco,
      total_meses_analisados,
      aparenta_inativo_booking,
      ultima_analise_em,
      proxima_reanalise_em,
      dados_resumo,
      observacoes,
      atualizado_em
    )
    VALUES (
      $1,
      $2,
      $3,
      $4::date,
      $5::date,
      $6::date,
      $7,
      $8,
      $9,
      NOW(),
      $10,
      $11::jsonb,
      $12,
      NOW()
    )
    ON CONFLICT (hotel_id)
    DO UPDATE SET
      meses_a_venda_estimado = EXCLUDED.meses_a_venda_estimado,
      meses_a_venda_confirmado = EXCLUDED.meses_a_venda_confirmado,
      primeiro_mes_com_preco = EXCLUDED.primeiro_mes_com_preco,
      ultimo_mes_com_preco = EXCLUDED.ultimo_mes_com_preco,
      primeiro_mes_sem_preco = EXCLUDED.primeiro_mes_sem_preco,
      percentual_meses_com_preco = EXCLUDED.percentual_meses_com_preco,
      total_meses_analisados = EXCLUDED.total_meses_analisados,
      aparenta_inativo_booking = EXCLUDED.aparenta_inativo_booking,
      ultima_analise_em = NOW(),
      proxima_reanalise_em = EXCLUDED.proxima_reanalise_em,
      dados_resumo = EXCLUDED.dados_resumo,
      observacoes = EXCLUDED.observacoes,
      atualizado_em = NOW()
    RETURNING id, hotel_id
  `;

  const values = [
    payload.hotel_id,
    payload.meses_a_venda_estimado,
    payload.meses_a_venda_confirmado,
    payload.primeiro_mes_com_preco,
    payload.ultimo_mes_com_preco,
    payload.primeiro_mes_sem_preco,
    payload.percentual_meses_com_preco,
    payload.total_meses_analisados,
    payload.aparenta_inativo_booking,
    payload.proxima_reanalise_em,
    JSON.stringify(payload.dados_resumo || {}),
    payload.observacoes || null
  ];

  const { rows } = await client.query(sql, values);
  return rows[0] || null;
}

async function consolidarJanelaVendaHotel(opcoes = {}) {
  const client = await pool.connect();
  const hotelId = Number(opcoes.hotelId);
  const debug = Boolean(opcoes.debug);

  if (!hotelId || Number.isNaN(hotelId)) {
    throw new Error('Informe um hotel_id válido.');
  }

  try {
    const hotel = await buscarHotelPorId(client, hotelId);
    if (!hotel) {
      throw new Error(`Hotel ${hotelId} não encontrado.`);
    }

    const horizonteMeses = Number(
      await buscarConfiguracao(client, 'janela_venda_horizonte_meses', '18')
    );

    const reanaliseDias = Number(
      await buscarConfiguracao(client, 'janela_venda_reanalise_dias', '30')
    );

    const meses = await buscarMesesDescobertaHotel(client, hotelId, horizonteMeses);

    if (debug) {
      console.log('[consolidacao] hotel:', {
        id: hotel.id,
        nome: hotel.nome
      });
      console.log('[consolidacao] meses encontrados:', meses.length);
    }

    const metricas = calcularMetricas(meses);

    const proximaReanalise = new Date();
    proximaReanalise.setDate(proximaReanalise.getDate() + reanaliseDias);

    const dadosResumo = {
      origem: 'consolidar_janela_venda_hotel',
      versao: 1,
      hotel_nome: hotel.nome,
      horizonte_meses_configurado: horizonteMeses,
      meses_com_preco: metricas.mesesComPrecoCurto,
      meses_sem_preco: metricas.mesesSemPrecoCurto,
      meses_analisados: meses.map((m) => ({
        mes_referencia: formatarMesCurto(m.mes_referencia),
        tem_preco: m.tem_preco,
        qtd_tarifas_com_preco: m.qtd_tarifas_com_preco,
        ultima_consulta_mes: m.ultima_consulta_mes
      }))
    };

    const observacoes = metricas.aparentaInativoBooking
      ? 'Hotel aparenta estar sem venda na Booking dentro do horizonte consolidado.'
      : null;

    const upsert = await upsertJanelaVenda(client, {
      hotel_id: hotel.id,
      meses_a_venda_estimado: metricas.mesesAVendaEstimado,
      meses_a_venda_confirmado: metricas.mesesAVendaConfirmado,
      primeiro_mes_com_preco: metricas.primeiroMesComPreco,
      ultimo_mes_com_preco: metricas.ultimoMesComPreco,
      primeiro_mes_sem_preco: metricas.primeiroMesSemPreco,
      percentual_meses_com_preco: metricas.percentualMesesComPreco,
      total_meses_analisados: metricas.totalMeses,
      aparenta_inativo_booking: metricas.aparentaInativoBooking,
      proxima_reanalise_em: proximaReanalise,
      dados_resumo: dadosResumo,
      observacoes
    });

    return {
      ok: true,
      hotel_id: hotel.id,
      hotel_nome: hotel.nome,
      total_meses_analisados: metricas.totalMeses,
      meses_a_venda_estimado: metricas.mesesAVendaEstimado,
      meses_a_venda_confirmado: metricas.mesesAVendaConfirmado,
      primeiro_mes_com_preco: metricas.primeiroMesComPreco,
      ultimo_mes_com_preco: metricas.ultimoMesComPreco,
      primeiro_mes_sem_preco: metricas.primeiroMesSemPreco,
      percentual_meses_com_preco: metricas.percentualMesesComPreco,
      aparenta_inativo_booking: metricas.aparentaInativoBooking,
      proxima_reanalise_em: proximaReanalise.toISOString(),
      upsert,
      meses_analisados: debug ? meses : undefined
    };
  } finally {
    client.release();
  }
}

module.exports = {
  consolidarJanelaVendaHotel
};

if (require.main === module) {
  (async () => {
    const debug = process.argv.includes('--debug');
    const hotelId = obterArgumento('--hotel-id');

    const resultado = await consolidarJanelaVendaHotel({
      hotelId,
      debug
    });

    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.ok ? 0 : 1);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}