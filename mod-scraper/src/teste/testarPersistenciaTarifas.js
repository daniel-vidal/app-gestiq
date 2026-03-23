// src/teste/testarPersistenciaTarifas.js

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const pool = require('../db/pool');
const { persistirLoteTarifas } = require('../persistencia/persistirLoteTarifas');

function carregarJson(caminhoArquivo) {
  if (!fs.existsSync(caminhoArquivo)) {
    throw new Error(`Arquivo não encontrado: ${caminhoArquivo}`);
  }

  const conteudo = fs.readFileSync(caminhoArquivo, 'utf8');
  return JSON.parse(conteudo);
}

async function mostrarAmostraBanco(client, tarifas) {
  if (!Array.isArray(tarifas) || tarifas.length === 0) {
    return;
  }

  const primeira = tarifas[0];

  const sql = `
    SELECT
      id,
      hotel_id,
      historico_id,
      checkin,
      checkout,
      menor_preco,
      disponivel,
      adultos,
      criancas,
      fonte,
      data_primeira_consulta,
      data_ultima_consulta
    FROM mod_scraper.tarifas_atuais
    WHERE hotel_id = $1
      AND adultos = $2
      AND criancas = $3
      AND fonte = $4
    ORDER BY checkin
    LIMIT 10
  `;

  const values = [
    Number(primeira.hotel_id),
    Number(primeira.adultos || 2),
    Number(primeira.criancas || 0),
    primeira.fonte || 'booking_mobile'
  ];

  const { rows } = await client.query(sql, values);

  console.log('\n=== AMOSTRA TARIFAS_ATUAIS ===\n');
  console.log(JSON.stringify(rows, null, 2));
}

(async () => {
  const client = await pool.connect();

  try {
    const caminhoJson = process.argv[2]
      ? path.resolve(process.argv[2])
      : path.resolve(__dirname, '../../debug/booking/tarifas_transformadas.json');

    console.log('\n=== TESTE PERSISTÊNCIA ===\n');
    console.log(`Arquivo de entrada: ${caminhoJson}`);

    const tarifasOriginais = carregarJson(caminhoJson);

    const HOTEL_ID_TESTE = 1;
    const REGIAO_ID_TESTE = null;

    const tarifas = tarifasOriginais.map((t) => ({
      ...t,
      hotel_id: HOTEL_ID_TESTE,
      regiao_id: REGIAO_ID_TESTE,
      tarefa_id: null
    }));

    if (!Array.isArray(tarifas) || tarifas.length === 0) {
      throw new Error('O JSON não contém tarifas válidas para persistência.');
    }

    console.log(`Tarifas carregadas: ${tarifas.length}`);

    const resumo = await persistirLoteTarifas(client, tarifas);

    console.log('\n=== RESUMO PERSISTÊNCIA ===\n');
    console.log(JSON.stringify(resumo, null, 2));

    await mostrarAmostraBanco(client, tarifas);

    console.log('\nTeste concluído com sucesso.\n');
  } catch (error) {
    console.error('\nErro no teste de persistência:\n');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();