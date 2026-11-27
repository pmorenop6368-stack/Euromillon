'use strict';

const Euro = (() => {
  const eraActual = '2016-09-27';
  const inicio = '2004-02-13';
  const casos = (n, k) => {
    if (k < 0 || k > n) return 0;
    let value = 1;
    for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i;
    return Math.round(value);
  };
  const totalCombinaciones = casos(50, 5) * casos(12, 2);
  const premiada = (numeros, estrellas) => numeros >= 2 || numeros === 1 && estrellas === 2;
  let casosPremio = 0;
  for (let n = 0; n <= 5; n++) {
    for (let e = 0; e <= 2; e++) {
      if (premiada(n, e)) casosPremio += casos(5, n) * casos(45, 5 - n) * casos(2, e) * casos(10, 2 - e);
    }
  }
  const probPremio = casosPremio / totalCombinaciones;

  function normalizar(rows) {
    if (!Array.isArray(rows) || rows.length === 0) throw Error('El archivo debe contener al menos un sorteo.');
    const dates = new Map();
    for (const row of rows) {
      const { fecha, numeros, estrellas } = row ?? {};
      const date = new Date(fecha + 'T00:00:00Z');
      if (typeof fecha !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(fecha) ||
          !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== fecha ||
          fecha < inicio || ![2, 5].includes(date.getUTCDay()) ||
          date.getUTCDay() === 2 && fecha < '2011-05-10') {
        throw Error('Fecha de sorteo inválida: ' + (fecha ?? 'sin fecha'));
      }
      const maxEstrellas = fecha < '2011-05-10' ? 9 : fecha < eraActual ? 11 : 12;
      const valid = (list, length, max) => Array.isArray(list) && list.length === length &&
        new Set(list).size === length && list.every(value => Number.isInteger(value) && value >= 1 && value <= max);
      if (!valid(numeros, 5, 50) || !valid(estrellas, 2, maxEstrellas)) {
        throw Error('Combinación inválida en el sorteo del ' + fecha);
      }
      const sorted = { fecha, numeros: [...numeros].sort((a, b) => a - b), estrellas: [...estrellas].sort((a, b) => a - b) };
      if (dates.has(fecha) && JSON.stringify(dates.get(fecha)) !== JSON.stringify(sorted)) {
        throw Error('Hay dos resultados distintos para el ' + fecha);
      }
      dates.set(fecha, sorted);
    }
    return [...dates.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  function ranking(counts, size) {
    return Array.from({ length: size }, (_, i) => ({ value: i + 1, count: counts[i] }))
      .sort((a, b) => b.count - a.count || a.value - b.value);
  }

  function frecuencias(rows) {
    const n = Array(50).fill(0), e = Array(12).fill(0), pares = new Map();
    let sorteosEstrellas = 0;
    for (const row of rows) {
      for (const number of row.numeros) n[number - 1]++;
      if (row.fecha >= eraActual) {
        sorteosEstrellas++;
        for (const star of row.estrellas) e[star - 1]++;
      }
      for (const [i, number] of row.numeros.entries()) {
        for (const other of row.numeros.slice(i + 1)) {
          const key = number + ' + ' + other;
          pares.set(key, (pares.get(key) ?? 0) + 1);
        }
      }
    }
    return { numeros: ranking(n, 50), estrellas: ranking(e, 12), sorteosEstrellas,
      pares: [...pares].sort((a, b) => b[1] - a[1]).slice(0, 10) };
  }

  function aleatoria(cantidad, max, randomInt) {
    const values = new Set();
    while (values.size < cantidad) values.add(randomInt(max) + 1);
    return [...values].sort((a, b) => a - b);
  }

  function combinaciones(cantidad, randomInt) {
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 10) throw Error('Elige entre 1 y 10 combinaciones.');
    const rows = new Map();
    while (rows.size < cantidad) {
      const numeros = aleatoria(5, 50, randomInt), estrellas = aleatoria(2, 12, randomInt);
      rows.set(numeros.join(',') + '|' + estrellas.join(','), { numeros, estrellas });
    }
    return [...rows.values()];
  }

  // Regresión logística multietiqueta con actualización en línea y regularización.
  // Cada etiqueta recibe como entradas las bolas del sorteo anterior y un sesgo.
  function crearModelo() {
    const weights = Array.from({ length: 62 }, () => new Float64Array(63));
    const scores = (features) => weights.map((w, i) => {
      let score = i < 50 ? Math.log(1 / 9) : Math.log(1 / 5);
      for (const x of features) score += w[x];
      return 1 / (1 + Math.exp(-score));
    });
    const features = (row) => [62, ...etiquetas(row)];
    return {
      clasificar(row) {
        const output = scores(features(row));
        return {
          numeros: ranking(output.slice(0, 50), 50).map(item => item.value),
          estrellas: ranking(output.slice(50), 12).map(item => item.value),
        };
      },
      observar(previous, actual) {
        const input = features(previous);
        const labels = new Set(etiquetas(actual));
        const output = scores(input);
        for (const [i, row] of weights.entries()) {
          const error = (labels.has(i) ? 1 : 0) - output[i];
          for (const x of input) row[x] += 0.035 * (error - 0.025 * row[x]);
        }
      },
    };
  }

  function etiquetas(row) {
    return [...row.numeros.map(n => n - 1), ...row.estrellas.map(e => e + 49)];
  }

  function registrarParejas(matrix, values) {
    for (const a of values) {
      for (const b of values) {
        if (a !== b) matrix[a - 1][b - 1]++;
      }
    }
  }

  function matrizParejas(size) {
    return Array.from({ length: size }, () => new Uint32Array(size));
  }

  function acompanantes(rows, tipo, valor) {
    const estrellas = tipo === 'estrellas';
    const size = estrellas ? 12 : 50;
    if (!['numeros', 'estrellas'].includes(tipo) ||
        !Number.isInteger(valor) || valor < 1 || valor > size) {
      throw Error('Selecciona un número o una estrella válida.');
    }
    const counts = new Uint32Array(size);
    let total = 0, frecuencia = 0;
    for (const row of rows) {
      if (estrellas && row.fecha < eraActual) continue;
      total++;
      const values = row[tipo];
      if (!values.includes(valor)) continue;
      frecuencia++;
      for (const other of values) if (other !== valor) counts[other - 1]++;
    }
    return {
      total, frecuencia, azar: estrellas ? 2 / 12 : 5 / 50,
      azarAcompanante: estrellas ? 1 / 11 : 4 / 49,
      parejas: ranking(counts, size).filter(item => item.value !== valor),
    };
  }

  function cadencia(rows, tipo, a, b) {
    const group = acompanantes(rows, tipo, a);
    if (!group.parejas.some(item => item.value === b)) throw Error('El acompañante debe ser distinto.');
    const draws = tipo === 'estrellas' ? rows.filter(row => row.fecha >= eraActual) : rows;
    const positions = [];
    for (const [index, row] of draws.entries()) {
      if (row[tipo].includes(a) && row[tipo].includes(b)) positions.push(index);
    }
    const gaps = positions.slice(1).map((position, index) => position - positions[index]).sort((x, y) => x - y);
    const middle = Math.floor(gaps.length / 2);
    const median = !gaps.length ? null : gaps.length % 2 ? gaps[middle] :
      (gaps[middle - 1] + gaps[middle]) / 2;
    const results = { occurrences: positions.length, median, min: gaps[0], max: gaps.at(-1), scan: null };
    if (positions.length < 5 || draws.length < 20) return results;

    // Contrasta una concentración de recurrencias respecto de posiciones uniformes,
    // condicionada al número de apariciones. Busca el máximo también en cada simulación.
    const length = draws.length;
    const maxLag = Math.min(52, Math.floor(length / 4));
    const expectedAt = lag => (length - lag) * positions.length * (positions.length - 1) /
      (length * (length - 1));
    const strongest = (indices) => {
      const events = new Set(indices);
      let peak = { lag: 1, count: 0, score: -Infinity };
      for (let lag = 1; lag <= maxLag; lag++) {
        const count = indices.reduce((sum, index) => sum + Number(events.has(index + lag)), 0);
        const expected = expectedAt(lag);
        const score = (count - expected) / Math.sqrt(expected);
        if (score > peak.score) peak = { lag, count, score };
      }
      return peak;
    };
    const observed = strongest(positions);
    let randomState = 21874959;
    const randomInt = max => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return Math.floor(randomState / 2 ** 32 * max);
    };
    let equalOrLarger = 0;
    const simulations = 499;
    for (let i = 0; i < simulations; i++) {
      const sample = aleatoria(positions.length, length, randomInt).map(value => value - 1);
      if (strongest(sample).score >= observed.score) equalOrLarger++;
    }
    results.scan = { lag: observed.lag, count: observed.count, maxLag,
      p: (equalOrLarger + 1) / (simulations + 1) };
    return results;
  }

  function apostarPorParejas(counts, matrix, amount) {
    const { value: anchor } = ranking(counts, counts.length)[0];
    return [anchor, ...ranking(matrix[anchor - 1], counts.length)
      .filter(item => item.value !== anchor).slice(0, amount - 1).map(item => item.value)];
  }

  function reducir(ranked, n, e) {
    return {
      numeros: ranked.numeros.slice(0, n).sort((a, b) => a - b),
      estrellas: ranked.estrellas.slice(0, e).sort((a, b) => a - b),
    };
  }

  function coberturaTeorica(n, e) {
    if (!Number.isInteger(n) || n < 5 || n > 50 || !Number.isInteger(e) || e < 2 || e > 12) {
      throw Error('Elige entre 5 y 50 números y entre 2 y 12 estrellas.');
    }
    const opciones = casos(n, 5) * casos(e, 2);
    return {
      opciones,
      completa: opciones / totalCombinaciones,
      numeros: casos(n, 5) / casos(50, 5),
      estrellas: casos(e, 2) / casos(12, 2),
    };
  }

  function evaluar(rows, nCandidatos = 10, eCandidatas = 4) {
    const referencia = coberturaTeorica(nCandidatos, eCandidatas);
    const cobertura = { completa: 0, numeros: 0, estrellas: 0 };
    const draws = rows.filter(row => row.fecha >= eraActual);
    const calentamiento = 104;
    if (draws.length < calentamiento + 20) throw Error('Se requieren al menos 124 sorteos desde el 27/09/2016.');
    for (let i = 1; i < draws.length; i++) {
      const previous = new Date(draws[i - 1].fecha + 'T00:00:00Z');
      const expected = previous.getUTCDay() === 2 ? 3 : 4;
      if (Date.parse(draws[i].fecha) - previous.getTime() !== expected * 86_400_000) {
        throw Error('El laboratorio necesita un histórico sin saltos tras el 27/09/2016.');
      }
    }
    const model = crearModelo();
    const counts = { numeros: Array(50).fill(0), estrellas: Array(12).fill(0) };
    const parejas = { numeros: matrizParejas(50), estrellas: matrizParejas(12) };
    const totals = {
      parejas: { numeros: 0, estrellas: 0, premios: 0 },
      modelo: { numeros: 0, estrellas: 0, premios: 0 },
      frecuencia: { numeros: 0, estrellas: 0, premios: 0 },
    };
    function tally(method, estimate, draw) {
      const n = estimate.numeros.filter(value => draw.numeros.includes(value)).length;
      const e = estimate.estrellas.filter(value => draw.estrellas.includes(value)).length;
      totals[method].numeros += n;
      totals[method].estrellas += e;
      totals[method].premios += Number(premiada(n, e));
    }
    for (const [i, draw] of draws.entries()) {
      const previous = draws[i - 1];
      if (i >= calentamiento) {
        const ranked = model.clasificar(previous);
        tally('modelo', reducir(ranked, 5, 2), draw);
        const candidatos = reducir(ranked, nCandidatos, eCandidatas);
        const todosNumeros = draw.numeros.every(value => candidatos.numeros.includes(value));
        const todasEstrellas = draw.estrellas.every(value => candidatos.estrellas.includes(value));
        cobertura.numeros += Number(todosNumeros);
        cobertura.estrellas += Number(todasEstrellas);
        cobertura.completa += Number(todosNumeros && todasEstrellas);
        tally('frecuencia', {
          numeros: ranking(counts.numeros, 50).slice(0, 5).map(x => x.value),
          estrellas: ranking(counts.estrellas, 12).slice(0, 2).map(x => x.value),
        }, draw);
        tally('parejas', {
          numeros: apostarPorParejas(counts.numeros, parejas.numeros, 5),
          estrellas: apostarPorParejas(counts.estrellas, parejas.estrellas, 2),
        }, draw);
      }
      if (previous) model.observar(previous, draw);
      registrarParejas(parejas.numeros, draw.numeros);
      registrarParejas(parejas.estrellas, draw.estrellas);
      for (const n of draw.numeros) counts.numeros[n - 1]++;
      for (const e of draw.estrellas) counts.estrellas[e - 1]++;
    }
    const ultimaClasificacion = model.clasificar(draws.at(-1));
    return {
      total: draws.length - calentamiento, desde: draws[calentamiento].fecha, hasta: draws.at(-1).fecha,
      ...totals, combinacion: reducir(ultimaClasificacion, 5, 2),
      candidatos: reducir(ultimaClasificacion, nCandidatos, eCandidatas),
      cobertura, referencia,
    };
  }

  function intervaloPremios(yes, total) {
    const p = yes / total, z = 1.959963984540054;
    const adjusted = 1 + z * z / total;
    const center = (p + z * z / (2 * total)) / adjusted;
    const width = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / adjusted;
    return [Math.max(0, center - width), Math.min(1, center + width)];
  }

  return { normalizar, frecuencias, acompanantes, cadencia, combinaciones, coberturaTeorica, evaluar, intervaloPremios, totalCombinaciones, probPremio };
})();

if (typeof module !== 'undefined') module.exports = Euro;
