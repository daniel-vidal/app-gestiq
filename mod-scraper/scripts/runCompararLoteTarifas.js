#!/usr/bin/env node
// scripts/runCompararLoteTarifas.js
// Busca as tarifas da última tarefa de scraping e executa compararLoteTarifas

const pool = require('../src/db/pool');
const { compararLoteTarifas } = require('../src/consulta/compararLoteTarifas');

async function buscarTarifasUltimaTarefa(client) {
  const qTarefa = `
    SELECT id
    FROM mod_scraper.scraping_tarefas
    WHERE finalizada_em IS NOT NULL
    ORDER BY finalizada_em DESC
    LIMIT 1
  `;

  const { rows: tarefas } = await client.query(qTarefa);
  if (tarefas.length > 0) {
    const tarefaId = tarefas[0].id;
    const qTarifas = `
      SELECT hotel_id, checkin::text AS checkin, checkout::text AS checkout, adultos, criancas, fonte
      FROM mod_scraper.tarifas_monitoradas
      WHERE tarefa_id = $1
    `;

    const { rows } = await client.query(qTarifas, [tarefaId]);
    if (rows.length > 0) return { tarifas: rows, fonte: 'tarefa', tarefaId };
  }

  // Fallback: pegar tarifas com data_ultima_consulta mais recente
  const qMax = `SELECT MAX(data_ultima_consulta) AS ts FROM mod_scraper.tarifas_monitoradas`;
  const { rows: rMax } = await client.query(qMax);
  const ts = rMax && rMax[0] && rMax[0].ts;
  if (!ts) return { tarifas: [], fonte: 'nenhuma' };

  const qTarifasTs = `
    SELECT hotel_id, checkin::text AS checkin, checkout::text AS checkout, adultos, criancas, fonte
    FROM mod_scraper.tarifas_monitoradas
    WHERE data_ultima_consulta = $1
  `;

  const { rows: rowsTs } = await client.query(qTarifasTs, [ts]);
  return { tarifas: rowsTs, fonte: 'timestamp', ts };
}

async function main() {
  try {
    const { tarifas, fonte, tarefaId, ts } = await buscarTarifasUltimaTarefa(pool);

    if (!tarifas || tarifas.length === 0) {
      console.log('Nenhuma tarifa encontrada para comparar.');
      return;
    }

    console.log(`Encontradas ${tarifas.length} tarifas (fonte=${fonte}${tarefaId ? ' tarefaId='+tarefaId : ''}${ts ? ' ts='+ts : ''})`);

    const res = await compararLoteTarifas(pool, tarifas);

    const resumo = {
      recebidas: res.recebidas,
      novas: res.novas.length,
      alteradas: res.alteradas.length,
      iguais: res.iguais.length
    };

    console.log('Resumo:');
    console.log(JSON.stringify(resumo, null, 2));

    if (res.alteradas.length > 0) {
      // Formatar saída principal: apenas alteradas com campos essenciais
      const alteradasFormatadas = res.alteradas.map((item) => {
        const tarifa = item.tarifa || {};
        const comp = item.comparacao || {};
        const antesObj = comp.antes || null;
        const agoraObj = comp.agora || null;

        const antesVal = antesObj && antesObj.menor_preco != null ? Number(antesObj.menor_preco) : null;
        const agoraVal = agoraObj && agoraObj.menor_preco != null ? Number(agoraObj.menor_preco) : null;

        return {
          hotel_id: tarifa.hotel_id,
          checkin: tarifa.checkin,
          antes: antesVal,
          agora: agoraVal,
          diferenca: comp.diferenca != null ? Number(comp.diferenca) : null,
          direcao: comp.direcao || null
        };
      });

      console.log('Alteradas:');
      console.log(JSON.stringify(alteradasFormatadas, null, 2));
    } else {
      console.log('Nenhuma tarifa alterada encontrada.');
    }

    // Novas aparecem apenas no resumo (contagem). Se quiser ver exemplos, use debug.

  } catch (err) {
    console.error('Erro:', err && err.stack ? err.stack : err);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
}

main();
