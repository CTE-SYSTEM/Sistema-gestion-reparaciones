import test from 'node:test';
import assert from 'node:assert/strict';
import { getReceptionProfile } from '../../src/utils/receptionRequirements.js';
import { buildPaginationMeta, parsePagination } from '../../src/utils/pagination.js';
import { assertInList, normalizeOptionalText, parseNonNegativeMoney, parsePositiveId, RECEPCION_OPCIONES } from '../../src/utils/domainValidation.js';

test('recepción reconoce etiquetas antiguas y tipos con tildes sin modificarlos', () => {
  const cases = [
    ['Laptop', true, true], ['COMPUTADORA PORTÁTIL', true, true],
    ['Teléfono móvil', true, true], ['iPad', true, true], ['Consola portátil', true, true],
    ['Monitor LED', false, false], ['Pantalla OLED', false, false], ['TV', false, false],
    ['Proyector', false, false], ['Impresora multifuncional', false, false], ['Escáner', false, false],
    ['No-break', false, false], ['Router', false, true], ['PlayStation', false, true],
    ['PC de escritorio', false, true], ['Electrónico desconocido', true, true], [null, true, true],
  ];
  for (const [type, charger, access] of cases) {
    assert.deepEqual(getReceptionProfile(type), { charger, access }, String(type));
  }
});

test('no confunde una palabra contenida con el tipo monitor', () => {
  assert.deepEqual(getReceptionProfile('Monitoreador experimental'), { charger: true, access: true });
});

test('paginación inicia con 20 registros y calcula las siguientes páginas', () => {
  assert.deepEqual(parsePagination(), { page: 1, pageSize: 20, offset: 0 });
  assert.deepEqual(parsePagination({ page: '3', pageSize: '20' }), { page: 3, pageSize: 20, offset: 40 });
  assert.deepEqual(parsePagination({ page: '2', limit: '10' }), { page: 2, pageSize: 10, offset: 10 });
});

test('paginación limita solicitudes grandes y recupera valores inválidos', () => {
  assert.equal(parsePagination({ pageSize: '9999' }).pageSize, 100);
  assert.deepEqual(parsePagination({ page: '-1', pageSize: 'no-numérico' }), { page: 1, pageSize: 20, offset: 0 });
  assert.equal(buildPaginationMeta({ page: 1, pageSize: 20, total: 21 }).hasMore, true);
  assert.equal(buildPaginationMeta({ page: 2, pageSize: 20, total: 21 }).hasMore, false);
  assert.equal(buildPaginationMeta({ page: 1, pageSize: 20, total: 20 }).hasMore, false);
});

test('los textos opcionales vacíos se guardan como null', () => {
  for (const value of [undefined, null, '', ' \n\t ']) assert.equal(normalizeOptionalText(value), null);
  assert.equal(normalizeOptionalText('  Cable HDMI  '), 'Cable HDMI');
});

test('los identificadores deben ser enteros positivos', () => {
  assert.equal(parsePositiveId('42'), 42);
  for (const value of ['', undefined, null, 0, -1, 'abc', 1.5, Infinity]) assert.equal(parsePositiveId(value), null);
});

test('los importes aceptan cero, normalizan centavos y rechazan negativos o no finitos', () => {
  assert.equal(parseNonNegativeMoney('125.456', 'Mano de obra'), 125.46);
  for (const value of [undefined, null, '', 0]) assert.equal(parseNonNegativeMoney(value, 'Impuestos'), 0);
  for (const value of [-1, 'abc', Infinity, NaN]) {
    assert.throws(() => parseNonNegativeMoney(value, 'Presupuesto'), { statusCode: 400 });
  }
});

test('las condiciones de recepción distinguen no aplica de no verificado', () => {
  assert.equal(assertInList('NO_INCLUIDO', RECEPCION_OPCIONES.estado_cargador, 'Cargador'), 'NO_INCLUIDO');
  assert.equal(assertInList('NO_VERIFICADO', RECEPCION_OPCIONES.estado_cargador, 'Cargador'), 'NO_VERIFICADO');
  assert.equal(assertInList('NO_REQUIERE', RECEPCION_OPCIONES.estado_acceso, 'Acceso'), 'NO_REQUIERE');
  assert.throws(() => assertInList('INVENTADO', RECEPCION_OPCIONES.estado_cargador, 'Cargador'), { statusCode: 400 });
});
