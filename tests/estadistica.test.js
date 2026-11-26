'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomInt } = require('node:crypto');
const Euro = require('../estadistica.js');
const rows = Euro.normalizar(require('../sorteos.json'));

test('calcula las probabilidades de una apuesta simple con 12 estrellas', () => {
  assert.equal(Euro.totalCombinaciones, 139_838_160);
  assert.equal(Math.round(Euro.probPremio * Euro.totalCombinaciones), 10_778_691);
});

test('genera apuestas válidas y distintas con números y estrellas', () => {
  const combinations = Euro.combinaciones(10, randomInt);
  assert.equal(new Set(combinations.map(row => JSON.stringify(row))).size, 10);
  const day = rows.at(-1).fecha;
  for (const row of combinations) assert.equal(Euro.normalizar([{ ...row, fecha: day }]).length, 1);
});

test('distingue los rangos históricos de estrellas', () => {
  assert.ok(rows.length >= 2001);
  assert.throws(() => Euro.normalizar([{ ...rows[0], estrellas: [1, 12] }]), /inválida/);
  const stats = Euro.frecuencias(rows);
  assert.equal(stats.numeros.reduce((total, row) => total + row.count, 0), rows.length * 5);
  assert.equal(stats.estrellas.reduce((total, row) => total + row.count, 0), stats.sorteosEstrellas * 2);
});

test('evalúa 957 sorteos y detecta una fecha ausente', () => {
  const frozen = rows.filter(row => row.fecha <= "2026-11-24");
  const result = Euro.evaluar(frozen);
  assert.equal(result.total, 957);
  assert.deepEqual(result.modelo, { numeros: 499, estrellas: 326, premios: 77 });
  assert.equal(result.combinacion.estrellas.length, 2);
  assert.throws(() => Euro.evaluar(rows.filter(row => row.fecha !== '2026-11-20')), /sin saltos/);
});

test('calcula la frecuencia marginal y condicional de las parejas', () => {
  const info = Euro.acompanantes(rows, 'numeros', 44);
  assert.equal(info.azar, .1);
  assert.equal(info.azarAcompanante, 4 / 49);
  assert.deepEqual(info.parejas[0], { value: 39, count: 29 });
  assert.equal(info.parejas.reduce((n, pair) => n + pair.count, 0), info.frecuencia * 4);
});

test('detecta una periodicidad sintética y descarta muestras demasiado cortas', () => {
  const repeated = Array.from({length: 120}, (_, index) => ({
    numeros: index % 6 === 0 ? [1, 2, 3, 4, 5] : [1, 6, 7, 8, 9],
  }));
  const result = Euro.cadencia(repeated, 'numeros', 1, 2);
  assert.equal(result.median, 6);
  assert.equal(result.scan.lag, 6);
  assert.ok(result.scan.p <= .01);
  assert.equal(Euro.cadencia(repeated.slice(0, 6), 'numeros', 1, 2).scan, null);
});
