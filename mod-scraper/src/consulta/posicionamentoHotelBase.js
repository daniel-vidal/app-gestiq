// src/consulta/posicionamentoHotelBase.js
async function buscarTarifasComparaveis(pool, { checkin, adultos = 2, criancas = 0, fonte = 'booking_mobile', incluirIndisponiveis = false, hotelBaseId = null } = {}) {
  if (!pool) throw new Error('pool é obrigatório');
  if (!checkin) throw new Error('checkin é obrigatório');

  // If hotelBaseId not provided, try to find the hotel with `hotel_base = true`
  if (hotelBaseId == null) {
    const qBase = `
      SELECT id, nome
      FROM mod_scraper.hoteis_monitorados
      WHERE hotel_base = TRUE AND ativo = TRUE
      ORDER BY prioridade_monitoramento ASC, id ASC
    `;

    const { rows: baseRows } = await pool.query(qBase);

    if (!baseRows || baseRows.length === 0) {
      throw new Error('Regra de negócio: não existe nenhum hotel com hotel_base = true (ativo)');
    }

    if (baseRows.length > 1) {
      throw new Error(`Regra de negócio: existem ${baseRows.length} hotéis com hotel_base = true (ativo); deve haver exatamente 1`);
    }

    hotelBaseId = baseRows[0].id;
  }

  const params = [String(checkin), Number(adultos), Number(criancas), fonte || 'booking_mobile'];

  let sql = `
    SELECT hotel_id, menor_preco, moeda, disponivel
    FROM mod_scraper.tarifas_atuais
    WHERE checkin = $1
      AND adultos = $2
      AND criancas = $3
      AND fonte = $4
      AND menor_preco IS NOT NULL
  `;

  // include checkout in the result for reporting
  sql = sql.replace('SELECT hotel_id, menor_preco, moeda, disponivel', 'SELECT hotel_id, menor_preco, moeda, disponivel, checkout');

  if (!incluirIndisponiveis) {
    sql += ` AND disponivel = TRUE`;
  }

  sql += ` ORDER BY menor_preco ASC`;

  const { rows } = await pool.query(sql, params);

  // Normalize numeric prices
  const tarifas = rows.map(r => ({
    hotel_id: Number(r.hotel_id),
    menor_preco: r.menor_preco != null ? Number(r.menor_preco) : null,
    moeda: r.moeda,
    disponivel: Boolean(r.disponivel)
  }));
  // attach checkout if present
  for (let i = 0; i < tarifas.length; i++) {
    const ck = rows[i] && rows[i].checkout;
    if (!ck) {
      tarifas[i].checkout = null;
    } else if (ck instanceof Date) {
      tarifas[i].checkout = ck.toISOString().slice(0,10);
    } else {
      // try to parse ISO-like strings, fallback to first 10 chars
      const s = String(ck).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        tarifas[i].checkout = s.slice(0,10);
      } else {
        tarifas[i].checkout = s.slice(0,10);
      }
    }
  }

  let base = null;
  if (hotelBaseId != null) {
    base = tarifas.find(t => Number(t.hotel_id) === Number(hotelBaseId)) || null;
  }

  const comparaveis = tarifas.filter(t => !(hotelBaseId != null && Number(t.hotel_id) === Number(hotelBaseId)));

  return { comparaveis, base };
}

function calcularIndicadoresPosicionamento(comparaveis = [], base = null) {
  const numeros = comparaveis
    .map(t => t.menor_preco)
    .filter(p => p != null && Number.isFinite(p))
    .sort((a, b) => a - b);

  const qtd = numeros.length;

  const mercado = {
    media: null,
    mediana: null,
    menor_preco: null,
    maior_preco: null,
    qtd_hoteis: qtd
  };

  if (qtd > 0) {
    const soma = numeros.reduce((s, v) => s + v, 0);
    const media = soma / qtd;
    mercado.media = Number(media.toFixed(2));

    // mediana
    const meio = Math.floor(qtd / 2);
    if (qtd % 2 === 1) {
      mercado.mediana = Number(numeros[meio].toFixed(2));
    } else {
      mercado.mediana = Number(((numeros[meio - 1] + numeros[meio]) / 2).toFixed(2));
    }

    mercado.menor_preco = Number(numeros[0].toFixed(2));
    mercado.maior_preco = Number(numeros[qtd - 1].toFixed(2));
  }

  const hotel = {
    hotel_id: base ? Number(base.hotel_id) : null,
    preco: base && base.menor_preco != null ? Number(base.menor_preco) : null,
    diferenca_media: null,
    diferenca_percentual_media: null,
    posicao_no_ranking: null
  };

  if (hotel.preco != null && mercado.media != null) {
    const diff = Number((hotel.preco - mercado.media).toFixed(2));
    hotel.diferenca_media = diff;
    hotel.diferenca_percentual_media = Number(((diff / mercado.media) * 100).toFixed(2));
  }

  // Ranking: include base among comparaveis for ranking
  if (hotel.preco != null) {
    const lista = comparaveis.slice();
    lista.push({ hotel_id: hotel.hotel_id, menor_preco: hotel.preco });
    lista.sort((a, b) => (a.menor_preco || 0) - (b.menor_preco || 0));

    const idx = lista.findIndex(item => Number(item.hotel_id) === Number(hotel.hotel_id));
    if (idx >= 0) hotel.posicao_no_ranking = idx + 1;
  }

  return { mercado, hotel };
}

module.exports = { buscarTarifasComparaveis, calcularIndicadoresPosicionamento };
