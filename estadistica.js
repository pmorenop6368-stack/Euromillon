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
      predecir(row) {
        const output = scores(features(row));
        const top = (values, count) => ranking(values, values.length).slice(0, count)
          .map(item => item.value).sort((a, b) => a - b);
        return { numeros: top(output.slice(0, 50), 5), estrellas: top(output.slice(50), 2) };
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

  function evaluar(rows) {
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
    const totals = {
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
        tally('modelo', model.predecir(previous), draw);
        tally('frecuencia', {
          numeros: ranking(counts.numeros, 50).slice(0, 5).map(x => x.value),
          estrellas: ranking(counts.estrellas, 12).slice(0, 2).map(x => x.value),
        }, draw);
      }
      if (previous) model.observar(previous, draw);
      for (const n of draw.numeros) counts.numeros[n - 1]++;
      for (const e of draw.estrellas) counts.estrellas[e - 1]++;
    }
    return {
      total: draws.length - calentamiento, desde: draws[calentamiento].fecha, hasta: draws.at(-1).fecha,
      ...totals, combinacion: model.predecir(draws.at(-1)),
    };
  }

  function intervaloPremios(yes, total) {
    const p = yes / total, z = 1.959963984540054;
    const adjusted = 1 + z * z / total;
    const center = (p + z * z / (2 * total)) / adjusted;
    const width = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / adjusted;
    return [Math.max(0, center - width), Math.min(1, center + width)];
  }

  return { normalizar, frecuencias, combinaciones, evaluar, intervaloPremios, totalCombinaciones, probPremio };
})();

if (typeof module !== 'undefined') module.exports = Euro;
