// src/consulta/obterComparacaoTarifa.js
async function obterComparacaoTarifa(client, { hotel_id, checkin, checkout, adultos = 2, criancas = 0, fonte = 'booking_mobile' }) {
  if (!client) throw new Error('client é obrigatório');

  const sql = `
    SELECT *
    FROM mod_scraper.tarifas_monitoradas
    WHERE hotel_id = $1
      AND checkin = $2
      AND checkout = $3
      AND adultos = $4
      AND criancas = $5
      AND fonte = $6
    ORDER BY data_ultima_consulta DESC
    LIMIT 2
  `;

  const values = [Number(hotel_id), String(checkin), String(checkout), Number(adultos), Number(criancas), fonte || 'booking_mobile'];

  const { rows } = await client.query(sql, values);

  const atual = rows[0] || null;
  const anterior = rows[1] || null;

  function calcularDiff(antes, agora) {
    if (!antes && !agora) return null;

    // Caso primeira ocorrência (não existe registro anterior)
    if (!antes && agora) {
      return {
        antes: null,
        agora: agora || null,
        diferenca: null,
        mudou: false,
        direcao: 'nova',
        status: 'nova'
      };
    }

    const antesPreco = antes && antes.menor_preco != null ? Number(antes.menor_preco) : null;
    const agoraPreco = agora && agora.menor_preco != null ? Number(agora.menor_preco) : null;

    // Só considera mudança se existir registro anterior
    const mudou = Boolean(
      (antesPreco !== agoraPreco) ||
      ((antes && antes.disponivel) !== (agora && agora.disponivel)) ||
      String((antes && antes.moeda) || '') !== String((agora && agora.moeda) || '') ||
      String((antes && antes.tipo_tarifa) || '') !== String((agora && agora.tipo_tarifa) || '')
    );

    let direcao = 'igual';
    if (antesPreco != null && agoraPreco != null && antesPreco !== agoraPreco) {
      direcao = agoraPreco > antesPreco ? 'subiu' : 'desceu';
    }

    const diferenca = (agoraPreco != null && antesPreco != null) ? (agoraPreco - antesPreco) : null;

    return {
      antes: antes || null,
      agora: agora || null,
      diferenca,
      mudou: mudou,
      direcao
    };
  }

  const diff = calcularDiff(anterior, atual);

  return { atual, anterior, diff };
}

module.exports = { obterComparacaoTarifa };
