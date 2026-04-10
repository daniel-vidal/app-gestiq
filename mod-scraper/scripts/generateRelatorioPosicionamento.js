#!/usr/bin/env node
// scripts/generateRelatorioPosicionamento.js
// node mod-scraper/scripts/generateRelatorioPosicionamento.js --checkin=2026-04-03 --fonte=booking_mobile

const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');
const {
  buscarTarifasComparaveis,
  calcularIndicadoresPosicionamento
} = require('../src/consulta/posicionamentoHotelBase');

function obterArgumento(nome, defaultValue) {
  const prefix = `${nome}=`;
  const arg = process.argv.find(a => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : defaultValue;
}

async function carregarNomes(pool, ids) {
  if (!ids || ids.length === 0) return {};
  const sql = `
    SELECT id, nome
    FROM mod_scraper.hoteis_monitorados
    WHERE id = ANY($1::int[])
  `;
  const { rows } = await pool.query(sql, [ids]);
  const mapa = {};
  for (const r of rows) mapa[Number(r.id)] = r.nome;
  return mapa;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!isNaN(d)) {
    return d.toISOString().slice(0, 10);
  }
  return value;
}

function fmtMoeda(v) {
  if (v == null) return '';
  const n = Number(v);
  if (isNaN(n)) return '';
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

function fmtMoedaSigned(v) {
  if (v == null) return '';
  const n = Number(v);
  if (isNaN(n)) return '';
  if (n === 0) return 'R$ 0,00';
  return `${n > 0 ? '+' : '-'} R$ ${Math.abs(n).toFixed(2).replace('.', ',')}`;
}

function fmtPercent(v) {
  if (v == null) return '';
  const n = Number(v);
  if (isNaN(n)) return '';
  return `${n > 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}%`;
}

function statusBase(preco, base) {
  if (preco < base) return 'mais_barato';
  if (preco > base) return 'mais_caro';
  return 'igual';
}

function statusMedia(preco, media) {
  if (preco < media) return 'abaixo_media';
  if (preco > media) return 'acima_media';
  return 'na_media';
}

function csvRow(arr) {
  return arr.map(v => `"${v ?? ''}"`).join(';');
}

function gerarRecomendacao(ind) {
  const preco = ind.hotel.preco;
  const media = ind.mercado.media;
  const diff = ((preco - media) / media) * 100;

  if (diff < -20) {
    return {
      acao: 'subir',
      perc: '10% a 15%',
      texto: 'Preço muito abaixo do mercado. Há espaço para aumento.'
    };
  }

  if (diff < -10) {
    return {
      acao: 'subir',
      perc: '5% a 10%',
      texto: 'Abaixo da média. Pode subir moderadamente.'
    };
  }

  if (diff > 15) {
    return {
      acao: 'descer',
      perc: '5% a 10%',
      texto: 'Muito acima da média. Risco de perder competitividade.'
    };
  }

  return {
    acao: 'manter',
    perc: '0%',
    texto: 'Posicionamento equilibrado.'
  };
}

async function main() {
  const checkin = obterArgumento('--checkin', '2026-06-01');
  const fonte = obterArgumento('--fonte', 'booking_mobile');

  const { comparaveis, base } = await buscarTarifasComparaveis(pool, {
    checkin,
    adultos: 2,
    criancas: 0,
    fonte
  });

  const indicadores = calcularIndicadoresPosicionamento(comparaveis, base);
  const recomendacao = gerarRecomendacao(indicadores);

  const listaOrdenada = comparaveis.sort((a, b) => a.menor_preco - b.menor_preco);
  const lista = [base, ...listaOrdenada];

  const nomes = await carregarNomes(pool, lista.map(h => h.hotel_id));

  const media = indicadores.mercado.media;
  const mediana = indicadores.mercado.mediana;
  const menor = indicadores.mercado.menor_preco;
  const maior = indicadores.mercado.maior_preco;
  const basePreco = base.menor_preco;

  const linhas = [];

  linhas.push(csvRow([
    'hotel_id','nome','checkin','checkout','preco','posicao','hotel_base',
    'diferenca_base','%_base','diferenca_media','%_media','status_base','status_media'
  ]));

  linhas.push(csvRow(['','MENOR','','',fmtMoeda(menor)]));
  linhas.push(csvRow(['','MÉDIA','','',fmtMoeda(media)]));
  linhas.push(csvRow(['','MEDIANA','','',fmtMoeda(mediana)]));
  linhas.push(csvRow(['','MAIOR','','',fmtMoeda(maior)]));

  lista.forEach((h, i) => {
    const isBase = h.hotel_id === base.hotel_id;
    const preco = h.menor_preco;
    const nome = (nomes[h.hotel_id] || '') + (isBase ? ' (BASE)' : '');

    const diffBase = preco - basePreco;
    const diffMedia = preco - media;

    linhas.push(csvRow([
      h.hotel_id,
      nome,
      checkin,
      formatDate(h.checkout),
      fmtMoeda(preco),
      i + 1,
      isBase ? 'TRUE' : 'FALSE',
      fmtMoedaSigned(diffBase),
      fmtPercent((diffBase / basePreco) * 100),
      fmtMoedaSigned(diffMedia),
      fmtPercent((diffMedia / media) * 100),
      statusBase(preco, basePreco),
      statusMedia(preco, media)
    ]));
  });

  linhas.push('');
  linhas.push(csvRow(['RECOMENDAÇÃO']));
  linhas.push(csvRow(['ação', recomendacao.acao]));
  linhas.push(csvRow(['percentual', recomendacao.perc]));
  linhas.push(csvRow(['análise', recomendacao.texto]));

  const file = path.join(__dirname, '..', 'outputs', `posicionamento_${checkin.replace(/-/g,'')}.csv`);
  fs.writeFileSync(file, linhas.join('\n'));

  console.log('CSV gerado:', file);
}

main();