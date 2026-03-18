// captura_tarifas_calendario_booking.js
// Captura o calendário de tarifas da Booking e retorna dados estruturados
//
// Exemplo:
// node mod-scraper/src/captura/captura_tarifas_calendario_booking.js "https://m.booking.com/hotel/br/verdemar-ltda.pt-br.html?checkin=2026-04-01&checkout=2026-04-02&group_adults=2&group_children=0"

let puppeteer;
try {
  const pptrExtra = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  pptrExtra.use(StealthPlugin());
  puppeteer = pptrExtra;
} catch (e) {
  puppeteer = require('puppeteer');
}

const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizarData(data) {
  if (!data) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;

  const parsed = new Date(data);
  if (isNaN(parsed)) return null;

  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

function calcularPeriodoEstadia(checkin, checkout) {
  if (!checkin || !checkout) return null;

  const dtCheckin = new Date(checkin);
  const dtCheckout = new Date(checkout);

  if (isNaN(dtCheckin) || isNaN(dtCheckout)) return null;

  const diffMs = dtCheckout - dtCheckin;
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return diffDias >= 0 ? diffDias : null;
}

function calcularAntecedenciaCompra(dataConsultaIso, checkin) {
  if (!dataConsultaIso || !checkin) return null;

  const dtConsulta = new Date(dataConsultaIso);
  const dtCheckin = new Date(checkin);

  if (isNaN(dtConsulta) || isNaN(dtCheckin)) return null;

  const consultaZeroHora = new Date(
    dtConsulta.getFullYear(),
    dtConsulta.getMonth(),
    dtConsulta.getDate()
  );

  const checkinZeroHora = new Date(
    dtCheckin.getFullYear(),
    dtCheckin.getMonth(),
    dtCheckin.getDate()
  );

  const diffMs = checkinZeroHora - consultaZeroHora;
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return diffDias;
}

async function salvarDebug(page, prefixo = 'debug') {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const arquivoHtml = path.join(__dirname, `${prefixo}-${ts}.html`);
    const arquivoPng = path.join(__dirname, `${prefixo}-${ts}.png`);

    const html = await page.content();
    fs.writeFileSync(arquivoHtml, html, 'utf8');

    try {
      await page.screenshot({ path: arquivoPng, fullPage: true });
    } catch (_) {}

    console.log('🛠️ Debug salvo em:', arquivoHtml);
  } catch (e) {
    console.warn('Falha ao salvar debug:', e.message);
  }
}

async function configurarBloqueioRecursos(page) {
  await page.setRequestInterception(true);

  page.on('request', (request) => {
    const resourceType = request.resourceType();
    const requestUrl = request.url();

    const bloquearTipos = ['image', 'font', 'media'];

    const bloquearDominios = [
      'googletagmanager.com',
      'google-analytics.com',
      'analytics.google.com',
      'doubleclick.net',
      'facebook.net',
      'facebook.com/tr',
      'connect.facebook.net',
      'hotjar.com',
      'clarity.ms'
    ];

    if (bloquearTipos.includes(resourceType)) {
      return request.abort();
    }

    if (bloquearDominios.some((dominio) => requestUrl.includes(dominio))) {
      return request.abort();
    }

    return request.continue();
  });
}

async function abrirCalendarioComRetry(page, tentativas = 5, debug = false) {
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      if (debug) {
        console.log(`Tentativa de abrir calendário: ${tentativa}/${tentativas}`);
      }

      await page.waitForSelector('#ci_date', { timeout: 10000 });

      await page.$eval('#ci_date', (el) => {
        el.scrollIntoView({ block: 'center', inline: 'center' });
      });

      await sleep(500);

      let clicou = false;

      try {
        const alvo = await page.$('#ci_date .bar--container');
        if (alvo) {
          await alvo.hover();
          await sleep(300);
          await alvo.click();
          clicou = true;
        }
      } catch (_) {}

      if (!clicou) {
        try {
          const alvo = await page.$('#ci_date');
          if (alvo) {
            await alvo.hover();
            await sleep(300);
            await alvo.click();
            clicou = true;
          }
        } catch (_) {}
      }

      if (!clicou) {
        await page.evaluate(() => {
          document.querySelector('#ci_date .bar--container')?.click()
            || document.querySelector('#ci_date')?.click();
        });
      }

      await sleep(2500);

      await page.waitForSelector('.bui-calendar', { timeout: 15000 });
      await page.waitForSelector('.bui-calendar__content', { timeout: 15000 });

      await page.waitForFunction(() => {
        const el = document.querySelector('.bui-calendar__content');
        return el && el.innerHTML.includes('calendar-day__price');
      }, { timeout: 15000 });

      await page.waitForFunction(() => {
        const precos = Array.from(document.querySelectorAll('.bui-calendar .calendar-day__price'));
        return precos.some((el) => {
          const txt = (el.textContent || '').replace(/\u00A0/g, ' ').trim();
          return txt && txt !== '—';
        });
      }, { timeout: 20000 });

      await sleep(1000);

      if (debug) {
        console.log('Calendário abriu e hidratou com sucesso.');
      }

      return true;
    } catch (e) {
      if (debug) {
        console.warn(`Falha na tentativa ${tentativa}: ${e.message}`);
      }

      if (tentativa < tentativas) {
        await sleep(1500);
      }
    }
  }

  return false;
}

async function capturarTarifasCalendarioBooking(url, opts = {}) {
  const headless = opts.headless !== undefined ? opts.headless : true;
  const debug = !!opts.debug;
  const bloquearRecursos = opts.bloquearRecursos !== undefined ? opts.bloquearRecursos : true;

  const launchArgs = opts.launchArgs || [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ];

  let browser;
  let page;

  try {
    browser = await puppeteer.launch({
      headless,
      args: launchArgs
    });

    page = await browser.newPage();

    if (bloquearRecursos) {
      await configurarBloqueioRecursos(page);
    }

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.bringToFront();
    await sleep(1500);

    const calendarioCarregado = await abrirCalendarioComRetry(page, 5, debug);

    if (!calendarioCarregado) {
      throw new Error('Não foi possível abrir/hidratar o calendário com preços');
    }

    await page.waitForSelector(
      '.bui-calendar td[data-bui-ref="calendar-date"][data-date]',
      { timeout: 20000 }
    );

    if (debug) {
      const diagnostico = await page.evaluate(() => ({
        urlAtual: location.href,
        titulo: document.title,
        temCalendario: !!document.querySelector('.bui-calendar'),
        qtdDatas: document.querySelectorAll('.bui-calendar td[data-bui-ref="calendar-date"][data-date]').length,
        qtdPrecos: document.querySelectorAll('.bui-calendar .calendar-day__price').length
      }));

      console.log('Diagnóstico:', JSON.stringify(diagnostico, null, 2));
    }

    const meta = await page.evaluate(() => {
      const form = document.querySelector('form#form_search') || document.querySelector('form');

      const getVal = (name) => {
        const fromForm = form?.querySelector(`[name="${name}"]`);
        if (fromForm) return fromForm.value;

        const globalEl = document.querySelector(`[name="${name}"]`);
        if (globalEl) return globalEl.value;

        return null;
      };

      const tituloChangeDates = document.querySelector('h2.change-dates-title')?.innerText?.trim() || null;
      const tituloHotelH1 = document.querySelector('h1')?.innerText?.trim() || null;
      const tituloPagina = document.title || null;

      return {
        titulo_hotel: tituloHotelH1 || tituloChangeDates || tituloPagina,
        checkin_ref: getVal('checkin'),
        checkout_ref: getVal('checkout'),
        adultos: getVal('group_adults'),
        criancas: getVal('group_children'),
        quartos: getVal('no_rooms'),
        info_precos: document.querySelector('.calendar-dates-prices-info-message')?.innerText?.trim() || null
      };
    });

    if (debug) {
      try {
        const amostraTd = await page.$eval(
          '.bui-calendar td[data-bui-ref="calendar-date"][data-date]',
          (td) => ({
            outerHTML: td.outerHTML,
            dia: td.querySelector('.calendar-day__number')?.textContent || null,
            valor: td.querySelector('.calendar-day__price')?.textContent || null
          })
        );
        console.log('Amostra TD real:', JSON.stringify(amostraTd, null, 2));
      } catch (e) {
        console.warn('Falha ao obter amostra TD real:', e.message);
      }
    }

    // Extrair dados do calendário
    const calendario = await page.$$eval(
      '.bui-calendar td[data-bui-ref="calendar-date"][data-date]',
      (tds) => {
        return tds.map((td) => {

          const data = td.getAttribute('data-date') || null;

          const diaRaw =
            td.querySelector('.calendar-day__number')?.textContent || '';

          const valorRaw =
            td.querySelector('.calendar-day__price')?.textContent || '';

          const dia = parseInt(diaRaw.replace(/[^\d]/g, ''), 10);

          const valorTexto = valorRaw
            .replace(/\u00A0/g, ' ')
            .trim();

          const valorNumero = valorTexto
            ? parseInt(valorTexto.replace(/[^\d]/g, ''), 10)
            : null;

          const temPreco = Number.isFinite(valorNumero);

          const disabled = td.classList.contains('bui-calendar__date--disabled');

          return {
            data,
            dia: Number.isFinite(dia) ? dia : null,
            valor: temPreco ? valorNumero : null,
            indisponivel: disabled || !temPreco
          };
        });
      }
    );

    if (debug) {
      console.log('Amostra calendario:', JSON.stringify(calendario.slice(0, 20), null, 2));
    }

    if (debug) {
      await salvarDebug(page, 'debug');
    }

    const dataConsulta = new Date().toISOString();

    if (meta) {
      meta.adultos = meta.adultos ? parseInt(meta.adultos, 10) : null;
      meta.criancas = meta.criancas ? parseInt(meta.criancas, 10) : null;
      meta.quartos = meta.quartos ? parseInt(meta.quartos, 10) : null;
      meta.checkin_ref = normalizarData(meta.checkin_ref);
      meta.checkout_ref = normalizarData(meta.checkout_ref);

      meta.ocupacao = (meta.adultos || 0) + (meta.criancas || 0);
      meta.periodo_estadia = calcularPeriodoEstadia(
        meta.checkin_ref,
        meta.checkout_ref
      );
      meta.antecedencia_compra = calcularAntecedenciaCompra(
        dataConsulta,
        meta.checkin_ref
      );
      meta.fonte = 'booking_mobile';
    }

    const calendarioFiltrado = Array.isArray(calendario)
      ? calendario
          .filter(item => item.data)
          .filter(item => !meta?.checkin_ref || item.data >= meta.checkin_ref)
          .sort((a, b) => a.data.localeCompare(b.data))
      : [];

    let status = 'success';

    const haValor = calendarioFiltrado.some(item => item.valor != null);
    if (!calendarioFiltrado.length || !haValor) {
      status = 'empty';
    }

    return {
      status,
      url,
      data_consulta: dataConsulta,
      meta,
      calendario: calendarioFiltrado,
      erro: null
    };
  } catch (e) {
    const dataConsulta = new Date().toISOString();

    if (debug && page) {
      await salvarDebug(page, 'debug-erro');
    }

    return {
      status: 'error',
      url,
      data_consulta: dataConsulta,
      meta: null,
      calendario: [],
      erro: e.message
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

if (require.main === module) {
  (async () => {
    const url = process.argv[2];

    if (!url) {
      console.log('Uso: node captura_tarifas_calendario_booking.js <URL_DA_PAGINA_DO_HOTEL>');
      process.exit(1);
    }

    const resultado = await capturarTarifasCalendarioBooking(url, {
      // Uso normal
      debug: false
      // Uso em Debug
      // debug: true
      //headless: false,
      // bloquearRecursos: false
    });

    console.log(JSON.stringify(resultado, null, 2));
  })();
}

module.exports = { capturarTarifasCalendarioBooking };