// src/parser/transformarCapturaBookingEmTarifas.js

function somarDias(dataIso, dias) {
  if (!dataIso || !Number.isFinite(dias)) return null;

  const dt = new Date(`${dataIso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;

  dt.setDate(dt.getDate() + dias);

  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

function transformarCapturaBookingEmTarifas({ tarefa, resultadoCaptura }) {
  if (!resultadoCaptura || resultadoCaptura.status === 'error') {
    return [];
  }

  const meta = resultadoCaptura.meta || {};
  const calendario = Array.isArray(resultadoCaptura.calendario)
    ? resultadoCaptura.calendario
    : [];

  const adultos = Number(tarefa?.adultos ?? meta.adultos ?? 2);
  const criancas = Number(tarefa?.criancas ?? meta.criancas ?? 0);
  const periodoEstadia = Number(
    tarefa?.quantidade_noites ?? meta.periodo_estadia ?? 1
  );

  const fonte = tarefa?.fonte || meta.fonte || 'booking_mobile';

  return calendario
    .filter((item) => item?.data)
    .map((item) => ({
      hotel_id: Number(tarefa.hotel_id),
      regiao_id: tarefa.regiao_id != null ? Number(tarefa.regiao_id) : null,
      tarefa_id: tarefa.id != null ? Number(tarefa.id) : null,
      mes_referencia: tarefa.mes_referencia || null,

      checkin: item.data,
      checkout: somarDias(item.data, periodoEstadia),
      periodo_estadia: periodoEstadia,

      menor_preco: item.valor != null ? Number(item.valor) : null,
      moeda: 'BRL',
      indisponivel: Boolean(item.indisponivel),
      tipo_tarifa: 'menor_preco_calendario',

      adultos,
      criancas,
      ocupacao_total: adultos + criancas,

      fonte,
      url_coleta: resultadoCaptura.url || null,

      metadados: {
        origem: 'calendario_booking',
        data_consulta: resultadoCaptura.data_consulta || null,
        dia_calendario: item.dia ?? null,
        titulo_hotel: meta.titulo_hotel || null,
        info_precos: meta.info_precos || null,
        checkin_ref: meta.checkin_ref || null,
        checkout_ref: meta.checkout_ref || null,
        antecedencia_compra: meta.antecedencia_compra ?? null
      }
    }));
}

module.exports = { transformarCapturaBookingEmTarifas };