import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrdenFilters } from '../../src/utils/ordenFilters.js';
import { ORDEN_ESTADOS } from '../../src/utils/domainValidation.js';

test('activas e historial separan todas las órdenes sin perder las finalizadas pendientes de entrega', () => {
  const active = buildOrdenFilters({ scope: 'activas' })[0].estado.notIn;
  const closed = buildOrdenFilters({ scope: 'historial' })[0].estado.in;
  const activeStates = ORDEN_ESTADOS.filter((state) => !active.includes(state));
  assert.deepEqual(closed, ['ENTREGADO', 'CANCELADO']);
  assert.ok(activeStates.includes('FINALIZADO'));
  assert.ok(activeStates.includes('IRREPARABLE'));
  assert.equal(activeStates.length + closed.length, ORDEN_ESTADOS.length);
  assert.ok(activeStates.every((state) => !closed.includes(state)));
});

test('las consultas existentes sin filtros conservan su alcance', () => {
  assert.deepEqual(buildOrdenFilters(), []);
});

test('el filtro por estado se combina con la vista, sin sustituirla', () => {
  assert.deepEqual(buildOrdenFilters({ scope: 'historial', estado: 'ENTREGADO' }), [
    { estado: { in: ['ENTREGADO', 'CANCELADO'] } }, { estado: 'ENTREGADO' },
  ]);
});

test('el rango cubre el día completo de Managua con límite final exclusivo', () => {
  const [filter] = buildOrdenFilters({ desde: '2026-10-13', hasta: '2026-10-13' });
  assert.equal(filter.fecha_ingreso.gte.toISOString(), '2026-10-13T06:00:00.000Z');
  assert.equal(filter.fecha_ingreso.lt.toISOString(), '2026-10-14T06:00:00.000Z');
});

test('se permiten rangos abiertos', () => {
  assert.deepEqual(Object.keys(buildOrdenFilters({ desde: '2026-10-13' })[0].fecha_ingreso), ['gte']);
  assert.deepEqual(Object.keys(buildOrdenFilters({ hasta: '2026-10-13' })[0].fecha_ingreso), ['lt']);
});

test('se rechazan filtros desconocidos y fechas imposibles o invertidas', () => {
  for (const query of [
    { scope: 'cualquiera' }, { estado: 'DESCONOCIDO' },
    { desde: '2026-02-30' }, { hasta: '13/10/2026' },
    { desde: '2026-10-14', hasta: '2026-10-13' },
  ]) assert.throws(() => buildOrdenFilters(query), { statusCode: 400 });
});
