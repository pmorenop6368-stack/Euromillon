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
