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
  renderCompanions();
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

function populateCompanionValues() {
  const select = $('companion-value');
  const previous = Number(select.value) || 1;
  const max = $('companion-type').value === 'estrellas' ? 12 : 50;
  select.replaceChildren();
  for (let value = 1; value <= max; value++) node('option', twoDigits(value), select).value = value;
  select.value = Math.min(previous, max);
}

function renderCompanions() {
  if (!draws.length) return;
  const type = $('companion-type').value;
  const value = Number($('companion-value').value);
  const data = Euro.acompanantes(draws, type, value);
  const parent = $('companion-results');
  parent.replaceChildren();
  if (!data.total) {
    node('p', 'Para analizar estrellas se necesitan sorteos del formato de 12 estrellas.', parent);
    return;
  }
  node('p', twoDigits(value) + ' salió en ' + decimal.format(data.frecuencia) + ' de ' +
    decimal.format(data.total) + ' sorteos (' + percent.format(data.frecuencia / data.total) +
    '). Referencia en un sorteo justo: ' + percent.format(data.azar) + '.', parent);
  if (type === 'estrellas') node('p', 'Se usan los sorteos desde el 27/09/2016.', parent);
  if (!data.frecuencia) return;
  node('p', 'Si sale ' + twoDigits(value) + ', la probabilidad teórica de que lo acompañe otro valor concreto es ' +
    percent.format(data.azarAcompanante) + '. La tabla muestra la proporción observada en el histórico.', parent);
  const table = node('table', null, node('div', null, parent, 'table-wrap'));
  const header = node('tr', null, node('thead', null, table));
  for (const text of ['Acompañante', 'Veces juntos', 'Frecuencia si salió ' + twoDigits(value)]) {
    node('th', text, header).scope = 'col';
  }
  const body = node('tbody', null, table);
  for (const item of data.parejas.slice(0, 5)) {
    const row = node('tr', null, body);
    node('td', twoDigits(item.value), row);
    node('td', decimal.format(item.count), row);
    node('td', percent.format(item.count / data.frecuencia), row);
  }

  node('h3', 'Cadencia de una pareja', parent);
  const controls = node('div', null, parent, 'row');
  const label = node('label', 'Acompañante', controls);
  label.htmlFor = 'cadence-partner';
  const partner = node('select', null, controls);
  partner.id = 'cadence-partner';
  for (const item of data.parejas) node('option', twoDigits(item.value), partner).value = item.value;
  const button = node('button', 'Analizar cadencia', controls);
  button.type = 'button';
  const output = node('div', null, parent, 'cadence-output');
  output.setAttribute('aria-live', 'polite');
  partner.addEventListener('change', () => output.replaceChildren());
  button.addEventListener('click', () => {
    const result = Euro.cadencia(draws, type, value, Number(partner.value));
    output.replaceChildren();
    node('p', 'Apariciones conjuntas: ' + decimal.format(result.occurrences) + '.', output);
    if (result.median != null) {
      node('p', 'Intervalo mediano: ' + decimal.format(result.median) +
        ' sorteos registrados. Mínimo: ' + result.min + ' · Máximo: ' + result.max + '.', output);
    }
    if (!result.scan) {
      node('p', 'Hay pocas apariciones para evaluar una cadencia.', output);
      return;
    }
    const { scan } = result;
    node('p', 'La separación que más destacó fue de ' + scan.lag + ' sorteos (' +
      scan.count + ' recurrencias). Se buscaron separaciones de 1 a ' + scan.maxLag +
      ' sorteos y se repitió la misma búsqueda en 499 simulaciones aleatorias.', output);
    node('p', 'Proporción simulada con un resultado igual o más extremo: ' + percent.format(scan.p) +
      '. ' + (scan.p < .05
        ? 'El patrón observado requiere validación con otros sorteos. También influye cuántas parejas se exploren.'
        : 'La cadencia observada es compatible con el azar.'), output);
  });
}

function showEvaluation() {
  const parent = $('evaluation');
  parent.replaceChildren();
  try {
    const result = Euro.evaluar(draws, Number($('candidate-numbers').value),
      Number($('candidate-stars').value));
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
    for (const [name, data] of [['Frecuencias', result.frecuencia], ['Parejas históricas', result.parejas], ['Modelo de IA', result.modelo]]) {
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
    node('h3', 'Recorte experimental de candidatos', parent, 'shortlist-title');
    node('p', decimal.format(result.referencia.opciones) + ' combinaciones completas dentro del recorte. ' +
      'Con un sorteo justo, su cobertura teórica es ' +
      (result.referencia.completa < .0001
        ? '1 entre ' + decimal.format(1 / result.referencia.completa)
        : percent.format(result.referencia.completa)) + '.', parent);
    ticket(result.candidatos, parent);
    const coverage = node('table', null, node('div', null, parent, 'table-wrap'));
    const coverageHeaders = node('tr', null, node('thead', null, coverage));
    for (const label of ['El recorte contiene', 'Sorteos observados', 'Sorteos esperados por azar']) {
      node('th', label, coverageHeaders).scope = 'col';
    }
    const coverageBody = node('tbody', null, coverage);
    for (const [key, label] of [['numeros', 'Los cinco números'], ['estrellas', 'Las dos estrellas'],
      ['completa', 'La combinación completa']]) {
      const row = node('tr', null, coverageBody);
      node('td', label, row);
      node('td', decimal.format(result.cobertura[key]) + ' de ' + decimal.format(count), row);
      node('td', decimal.format(result.referencia[key] * count) + ' de ' + decimal.format(count), row);
    }
    node('p', 'Un recorte más pequeño deja fuera más combinaciones. Si pruebas varios tamaños, ' +
      'confirma los resultados con sorteos nuevos antes de atribuirles capacidad predictiva.', parent);

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
$('candidate-form').addEventListener('submit', event => {
  event.preventDefault();
  showEvaluation();
});
$('candidate-form').addEventListener('input', () => $('evaluation').replaceChildren());
$('companion-type').addEventListener('change', () => {
  populateCompanionValues();
  renderCompanions();
});
$('companion-value').addEventListener('change', renderCompanions);
populateCompanionValues();
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
