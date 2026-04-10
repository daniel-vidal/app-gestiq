// src/consulta/compararLoteTarifas.js
const { obterComparacaoTarifa } = require('./obterComparacaoTarifa');

async function compararLoteTarifas(pool, tarifas = []) {
  if (!pool) throw new Error('pool é obrigatório');
  if (!Array.isArray(tarifas)) throw new Error('tarifas deve ser um array');

  const resultado = {
    recebidas: tarifas.length,
    novas: [],
    alteradas: [],
    iguais: []
  };

  for (const t of tarifas) {
    const params = {
      hotel_id: t.hotel_id,
      checkin: t.checkin,
      checkout: t.checkout,
      adultos: t.adultos != null ? Number(t.adultos) : 2,
      criancas: t.criancas != null ? Number(t.criancas) : 0,
      fonte: t.fonte || 'booking_mobile'
    };

    const { atual, anterior, diff } = await obterComparacaoTarifa(pool, params);

    if (!anterior) {
      resultado.novas.push({ tarifa: t, comparacao: diff });
    } else if (diff && diff.mudou) {
      resultado.alteradas.push({
        tarifa: t,
        comparacao: {
          antes: diff.antes,
          agora: diff.agora,
          diferenca: diff.diferenca,
          direcao: diff.direcao
        }
      });
    } else {
      resultado.iguais.push({ tarifa: t });
    }
  }

  return resultado;
}

module.exports = { compararLoteTarifas };

// Exemplo de uso (para teste rápido):
// node -e "(async()=>{ const pool=require('../db/pool'); const { compararLoteTarifas } = require('./consulta/compararLoteTarifas'); const sample=[{hotel_id:123,checkin:'2026-05-01',checkout:'2026-05-02'}]; const res=await compararLoteTarifas(pool,sample); console.log(JSON.stringify(res,null,2)); await pool.end(); })()"
