'use strict';

const $ = id => document.getElementById(id);
const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 });
const percent = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2 });
const twoDigits = number => String(number).padStart(2, '0');
const formatDate = date => date.split('-').reverse().join('/');
const storageKey = 'euromillones-historico-personal-v1';
let draws = [];

function node(tag, text, parent, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function ticket(row, parent) {
  const line = node('div', null, parent, 'ticket');
  for (const number of row.numeros) node('span', twoDigits(number), line, 'ball');
  for (const star of row.estrellas) node('span', '★' + twoDigits(star), line, 'ball star');
  line.setAttribute('aria-label', 'Números ' + row.numeros.join(', ') + '. Estrellas ' + row.estrellas.join(', '));
}

function randomInt(max) {
  const value = new Uint32Array(1);
  const limit = 2 ** 32 - (2 ** 32 % max);
  do { crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % max;
}

function generate(quantity) {
  const parent = $('generated');
  const rows = Euro.combinaciones(quantity, randomInt);
  parent.replaceChildren();
  for (const row of rows) ticket(row, parent);
}

function report(message) {
  $('source-status').textContent = message;
}

function replaceHistory(rows, message) {
  draws = Euro.normalizar(rows);
  $('evaluation').replaceChildren();
  const count = draws.length;
  const stats = Euro.frecuencias(draws);
  $('coverage').textContent = decimal.format(count) + ' sorteos · ' +
    formatDate(draws[0].fecha) + '–' + formatDate(draws.at(-1).fecha);
  $('star-coverage').textContent = decimal.format(stats.sorteosEstrellas) +
    ' sorteos con 12 estrellas posibles, desde el 27/09/2016.';
  const list = (id, items) => {
    const parent = $(id);
    parent.replaceChildren();
    for (const [label, value] of items) node('li', label + ' · ' + value, parent);
  };
  const counts = items => items.map(item => [twoDigits(item.value), item.count]);
  list('hotNumbers', counts(stats.numeros.slice(0, 10)));
  list('warmNumbers', counts(stats.numeros.slice(20, 30)));
  list('coldNumbers', counts(stats.numeros.slice(-10).reverse()));
  list('stars', stats.sorteosEstrellas ? counts(stats.estrellas) : []);
  list('pairs', stats.pares);
  const table = $('draws');
  table.replaceChildren();
  for (const row of draws.slice(-12).reverse()) {
    const line = node('tr', null, table);
    node('td', formatDate(row.fecha), line);
    node('td', row.numeros.map(twoDigits).join(' · '), line);
    node('td', row.estrellas.map(twoDigits).join(' · '), line);
  }
  $('evaluate').disabled = count === 0;
  $('export').disabled = count === 0;
  report(message);
}

function saveLocal(message) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(draws));
  } catch {
    report(message + ' No se pudo guardar la copia en el navegador. Puedes descargar el JSON.');
  }
}

let historyRequest = 0;
async function loadOfficial() {
  const request = ++historyRequest;
  try {
    const response = await fetch('sorteos.json', { cache: 'no-cache' });
    if (!response.ok) throw Error('No se pudo cargar sorteos.json.');
    const rows = await response.json();
    if (request !== historyRequest) return;
    replaceHistory(rows, 'Histórico oficial de Loterías y Apuestas del Estado.');
    try { localStorage.removeItem(storageKey); } catch {}
  } catch (error) {
    if (request === historyRequest) report(error.message);
  }
}

function spreadsheetDate(value, workbook) {
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value, { date1904: !!workbook.Workbook?.WBProps?.date1904 });
    if (!date) throw Error('Fecha de Excel inválida.');
    return [date.y, twoDigits(date.m), twoDigits(date.d)].join('-');
  }
  const text = String(value ?? '').trim();
  const parts = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return parts ? [parts[3], twoDigits(parts[2]), twoDigits(parts[1])].join('-') : text;
}

async function readHistory(file) {
  if (/\.json$/i.test(file.name)) return JSON.parse(await file.text());
  if (!/\.xlsx?$/i.test(file.name)) throw Error('Selecciona un archivo Excel o JSON.');
  if (typeof XLSX === 'undefined') throw Error('El lector de Excel no está disponible. Usa JSON o recarga la página.');
  const workbook = XLSX.read(await file.arrayBuffer());
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet).map(raw => {
    const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.trim().toLowerCase(), value]));
    return {
      fecha: spreadsheetDate(row.fecha, workbook),
      numeros: [1, 2, 3, 4, 5].map(i => Number(row['n' + i] ?? row['numero' + i])),
      estrellas: [1, 2].map(i => Number(row['e' + i] ?? row['estrella' + i])),
    };
  });
}

function showEvaluation() {
  const parent = $('evaluation');
  parent.replaceChildren();
  try {
    const result = Euro.evaluar(draws);
    const count = result.total;
    node('p', decimal.format(count) + ' sorteos evaluados · ' + formatDate(result.desde) + '–' + formatDate(result.hasta), parent);
    const table = node('table', null, node('div', null, parent, 'table-wrap'));
    const headings = node('tr', null, node('thead', null, table));
    for (const label of ['Método', 'Números por sorteo', 'Estrellas por sorteo', 'Con premio']) {
      node('th', label, headings).scope = 'col';
    }
    const body = node('tbody', null, table);
    const add = (name, n, e, prize) => {
      const row = node('tr', null, body);
      for (const value of [name, decimal.format(n), decimal.format(e), prize]) node('td', value, row);
    };
    add('Azar (valor esperado)', .5, 1 / 3, percent.format(Euro.probPremio));
    for (const [name, data] of [['Frecuencias', result.frecuencia], ['Modelo de IA', result.modelo]]) {
      add(name, data.numeros / count, data.estrellas / count, percent.format(data.premios / count));
    }
    const [lower, upper] = Euro.intervaloPremios(result.modelo.premios, count);
    const within = lower <= Euro.probPremio && Euro.probPremio <= upper;
    node('p', 'Intervalo de confianza del 95 % para la tasa de premios del modelo: ' +
      percent.format(lower) + '–' + percent.format(upper) + '. ' +
      (within ? 'El resultado es compatible con el azar.' :
        'La diferencia observada requiere comprobarse con nuevos sorteos.'), parent);
    node('h3', 'Combinación experimental del modelo', parent);
    ticket(result.combinacion, parent);
  } catch (error) {
    node('p', error.message, parent);
  }
}

$('jackpot').textContent = '1 entre ' + decimal.format(Euro.totalCombinaciones);
$('any-prize').textContent = percent.format(Euro.probPremio) + ' de algún premio de Euromillones';
$('evaluate').disabled = true;
$('export').disabled = true;
$('generator').addEventListener('submit', event => {
  event.preventDefault();
  generate(Number($('quantity').value));
});
$('evaluate').addEventListener('click', showEvaluation);
$('official').addEventListener('click', () => {
  if (!draws.length || confirm('¿Cargar el histórico oficial? Esto sustituye el histórico personal.')) {
    loadOfficial();
  }
});
$('manual').addEventListener('submit', event => {
  event.preventDefault();
  const split = value => value.split(',').map(x => /^\d+$/.test(x.trim()) ? Number(x) : NaN);
  const fecha = $('date').value;
  if (fecha > new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date())) {
    report('La fecha es posterior a hoy.');
    return;
  }
  try {
    const message = 'Sorteo añadido al historial local.';
    replaceHistory([...draws, { fecha, numeros: split($('numbers').value),
      estrellas: split($('starInput').value) }], message);
    historyRequest++;
    saveLocal(message);
    event.target.reset();
  } catch (error) {
    report(error.message);
  }
});
$('fileInput').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  const request = ++historyRequest;
  try {
    const rows = await readHistory(file);
    if (request !== historyRequest) return;
    const message = 'Histórico importado desde ' + file.name + '.';
    replaceHistory(rows, message);
    saveLocal(message);
  } catch (error) {
    if (request === historyRequest) report(error.message);
  } finally {
    if (request === historyRequest) event.target.value = '';
  }
});
$('export').addEventListener('click', () => {
  if (!draws.length) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify([...draws].reverse(), null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'sorteos.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

generate(1);
try {
  const local = localStorage.getItem(storageKey);
  if (local) replaceHistory(JSON.parse(local), 'Histórico personal guardado en este navegador.');
} catch {}
if (!draws.length) loadOfficial();
