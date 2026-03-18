// src/persistencia/persistirLoteTarifas.js

function normalizarDataChave(valor) {
  if (!valor) return '';

  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }

  const texto = String(valor).trim();

  if (!texto) return '';

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  // ISO datetime
  if (/^\d{4}-\d{2}-\d{2}T/.test(texto)) {
    return texto.slice(0, 10);
  }

  const dt = new Date(texto);
  if (!Number.isNaN(dt.getTime())) {
    return dt.toISOString().slice(0, 10);
  }

  return texto;
}

function montarChaveTarifa(t) {
  return [
    Number(t.hotel_id),
    normalizarDataChave(t.checkin),
    normalizarDataChave(t.checkout),
    Number(t.adultos),
    Number(t.criancas),
    String(t.fonte || '')
  ].join('|');
}

function normalizarTarifaParaBanco(tarifa) {
  return {
    hotel_id: Number(tarifa.hotel_id),
    regiao_id: tarifa.regiao_id != null ? Number(tarifa.regiao_id) : null,
    tarefa_id: tarifa.tarefa_id != null ? Number(tarifa.tarefa_id) : null,
    mes_referencia: tarifa.mes_referencia || null,
    checkin: normalizarDataChave(tarifa.checkin),
    checkout: normalizarDataChave(tarifa.checkout),
    periodo_estadia: Number(tarifa.periodo_estadia || 1),
    menor_preco: tarifa.menor_preco != null ? Number(tarifa.menor_preco) : null,
    moeda: tarifa.moeda || 'BRL',
    disponivel: !Boolean(tarifa.indisponivel),
    tipo_tarifa: tarifa.tipo_tarifa || 'menor_preco_calendario',
    adultos: Number(tarifa.adultos || 2),
    criancas: Number(tarifa.criancas || 0),
    ocupacao_total: Number(
      tarifa.ocupacao_total != null
        ? tarifa.ocupacao_total
        : (Number(tarifa.adultos || 2) + Number(tarifa.criancas || 0))
    ),
    fonte: tarifa.fonte || 'booking_mobile',
    url_coleta: tarifa.url_coleta || null,
    metadados: {
      ...(tarifa.metadados || {}),
      indisponivel_original: Boolean(tarifa.indisponivel)
    }
  };
}

function mesmaTarifa(atual, nova) {
  const precoAtual = atual.menor_preco != null ? Number(atual.menor_preco) : null;
  const precoNovo = nova.menor_preco != null ? Number(nova.menor_preco) : null;

  return (
    precoAtual === precoNovo &&
    Boolean(atual.disponivel) === Boolean(nova.disponivel) &&
    String(atual.moeda || '') === String(nova.moeda || '') &&
    String(atual.tipo_tarifa || '') === String(nova.tipo_tarifa || '')
  );
}

async function buscarTarifasAtuaisDoLote(client, tarifas) {
  if (!tarifas || tarifas.length === 0) return [];

  const base = tarifas[0];

  const checkinsOrdenados = tarifas
    .map((t) => normalizarDataChave(t.checkin))
    .filter(Boolean)
    .sort();

  const menorCheckin = checkinsOrdenados[0];
  const maiorCheckin = checkinsOrdenados[checkinsOrdenados.length - 1];

  const sql = `
    SELECT *
    FROM mod_scraper.tarifas_atuais
    WHERE hotel_id = $1
      AND adultos = $2
      AND criancas = $3
      AND fonte = $4
      AND checkin BETWEEN $5 AND $6
  `;

  const values = [
    Number(base.hotel_id),
    Number(base.adultos || 2),
    Number(base.criancas || 0),
    base.fonte || 'booking_mobile',
    menorCheckin,
    maiorCheckin
  ];

  const { rows } = await client.query(sql, values);
  return rows;
}

async function inserirHistorico(client, tarifa) {
  const sql = `
    INSERT INTO mod_scraper.tarifas_monitoradas (
      hotel_id,
      regiao_id,
      tarefa_id,
      mes_referencia,
      checkin,
      checkout,
      periodo_estadia,
      menor_preco,
      moeda,
      disponivel,
      tipo_tarifa,
      adultos,
      criancas,
      ocupacao_total,
      data_primeira_consulta,
      data_ultima_consulta,
      fonte,
      url_coleta,
      metadados
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,NOW(),NOW(),$15,$16,$17
    )
    RETURNING *
  `;

  const values = [
    tarifa.hotel_id,
    tarifa.regiao_id,
    tarifa.tarefa_id,
    tarifa.mes_referencia,
    tarifa.checkin,
    tarifa.checkout,
    tarifa.periodo_estadia,
    tarifa.menor_preco,
    tarifa.moeda,
    tarifa.disponivel,
    tarifa.tipo_tarifa,
    tarifa.adultos,
    tarifa.criancas,
    tarifa.ocupacao_total,
    tarifa.fonte,
    tarifa.url_coleta,
    tarifa.metadados ? JSON.stringify(tarifa.metadados) : null
  ];

  const { rows } = await client.query(sql, values);
  return rows[0];
}

async function atualizarHistoricoVigente(client, historicoId, tarifa) {
  const sql = `
    UPDATE mod_scraper.tarifas_monitoradas
    SET
      regiao_id = $2,
      tarefa_id = $3,
      mes_referencia = $4,
      data_ultima_consulta = NOW(),
      url_coleta = $5,
      metadados = $6
    WHERE id = $1
    RETURNING *
  `;

  const values = [
    historicoId,
    tarifa.regiao_id,
    tarifa.tarefa_id,
    tarifa.mes_referencia,
    tarifa.url_coleta,
    tarifa.metadados ? JSON.stringify(tarifa.metadados) : null
  ];

  const { rows } = await client.query(sql, values);
  return rows[0];
}

async function inserirTarifaAtual(client, tarifa, historico) {
  const sql = `
    INSERT INTO mod_scraper.tarifas_atuais (
      hotel_id,
      regiao_id,
      historico_id,
      tarefa_id,
      mes_referencia,
      checkin,
      checkout,
      periodo_estadia,
      menor_preco,
      moeda,
      disponivel,
      tipo_tarifa,
      adultos,
      criancas,
      ocupacao_total,
      data_primeira_consulta,
      data_ultima_consulta,
      fonte,
      url_coleta,
      metadados
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
    )
    RETURNING *
  `;

  const values = [
    tarifa.hotel_id,
    tarifa.regiao_id,
    historico.id,
    tarifa.tarefa_id,
    tarifa.mes_referencia,
    tarifa.checkin,
    tarifa.checkout,
    tarifa.periodo_estadia,
    tarifa.menor_preco,
    tarifa.moeda,
    tarifa.disponivel,
    tarifa.tipo_tarifa,
    tarifa.adultos,
    tarifa.criancas,
    tarifa.ocupacao_total,
    historico.data_primeira_consulta,
    historico.data_ultima_consulta,
    tarifa.fonte,
    tarifa.url_coleta,
    tarifa.metadados ? JSON.stringify(tarifa.metadados) : null
  ];

  const { rows } = await client.query(sql, values);
  return rows[0];
}

async function atualizarTarifaAtual(client, atualId, tarifa, historico) {
  const sql = `
    UPDATE mod_scraper.tarifas_atuais
    SET
      regiao_id = $2,
      historico_id = $3,
      tarefa_id = $4,
      mes_referencia = $5,
      periodo_estadia = $6,
      menor_preco = $7,
      moeda = $8,
      disponivel = $9,
      tipo_tarifa = $10,
      ocupacao_total = $11,
      data_primeira_consulta = $12,
      data_ultima_consulta = $13,
      url_coleta = $14,
      metadados = $15,
      atualizada_em = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const values = [
    atualId,
    tarifa.regiao_id,
    historico.id,
    tarifa.tarefa_id,
    tarifa.mes_referencia,
    tarifa.periodo_estadia,
    tarifa.menor_preco,
    tarifa.moeda,
    tarifa.disponivel,
    tarifa.tipo_tarifa,
    tarifa.ocupacao_total,
    historico.data_primeira_consulta,
    historico.data_ultima_consulta,
    tarifa.url_coleta,
    tarifa.metadados ? JSON.stringify(tarifa.metadados) : null
  ];

  const { rows } = await client.query(sql, values);
  return rows[0];
}

async function persistirLoteTarifas(client, tarifas) {
  if (!client) {
    throw new Error('client é obrigatório');
  }

  if (!Array.isArray(tarifas) || tarifas.length === 0) {
    return {
      recebidas: 0,
      novas: 0,
      iguais: 0,
      alteradas: 0
    };
  }

  const tarifasNormalizadas = tarifas.map(normalizarTarifaParaBanco);
  const atuais = await buscarTarifasAtuaisDoLote(client, tarifasNormalizadas);

  const mapaAtuais = new Map();
  for (const atual of atuais) {
    mapaAtuais.set(montarChaveTarifa(atual), atual);
  }

  const resumo = {
    recebidas: tarifasNormalizadas.length,
    novas: 0,
    iguais: 0,
    alteradas: 0
  };

  await client.query('BEGIN');

  try {
    for (const tarifa of tarifasNormalizadas) {
      const chave = montarChaveTarifa(tarifa);
      const atual = mapaAtuais.get(chave);

      if (!atual) {
        const historico = await inserirHistorico(client, tarifa);
        const atualInserida = await inserirTarifaAtual(client, tarifa, historico);

        mapaAtuais.set(chave, atualInserida);
        resumo.novas += 1;
        continue;
      }

      if (mesmaTarifa(atual, tarifa)) {
        const historicoAtualizado = await atualizarHistoricoVigente(
          client,
          atual.historico_id,
          tarifa
        );

        const atualAtualizada = await atualizarTarifaAtual(
          client,
          atual.id,
          tarifa,
          historicoAtualizado
        );

        mapaAtuais.set(chave, atualAtualizada);
        resumo.iguais += 1;
        continue;
      }

      const novoHistorico = await inserirHistorico(client, tarifa);
      const atualAtualizada = await atualizarTarifaAtual(
        client,
        atual.id,
        tarifa,
        novoHistorico
      );

      mapaAtuais.set(chave, atualAtualizada);
      resumo.alteradas += 1;
    }

    await client.query('COMMIT');
    return resumo;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

module.exports = {
  persistirLoteTarifas,
  montarChaveTarifa,
  normalizarTarifaParaBanco,
  mesmaTarifa
};