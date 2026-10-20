import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ADMIN_SETTINGS, validateSettings } from '../../src/utils/adminPolicy.js';

test('Negocio normaliza contacto sin alterar reglas, respaldos ni el objeto recibido', () => {
  const previous = structuredClone(DEFAULT_ADMIN_SETTINGS);
  previous.reglas.password_minimo = 12;
  previous.respaldos.habilitado = false;
  const snapshot = structuredClone(previous);
  const input = { negocio: { nombre: '  Taller Ñandú  ', correo: '  taller@example.test ', telefono: ' +505 8888-0000 ', direccion: '  Managua  ', garantia_condiciones: '  Solo reparación  ' } };
  const originalInput = structuredClone(input);
  const result = validateSettings(input, previous);
  assert.deepEqual(result.negocio, { ...previous.negocio, nombre: 'Taller Ñandú', correo: 'taller@example.test', telefono: '+505 8888-0000', direccion: 'Managua', garantia_condiciones: 'Solo reparación' });
  assert.deepEqual(result.reglas, previous.reglas);
  assert.deepEqual(result.respaldos, previous.respaldos);
  assert.deepEqual(previous, snapshot);
  assert.deepEqual(input, originalInput);
  result.reglas.tarifas_diagnostico.push({ nombre: 'Otra', monto: 100 });
  assert.deepEqual(previous.reglas.tarifas_diagnostico, []);
});

test('Contacto puede borrarse y los campos de texto admiten exactamente su límite', () => {
  const values = validateSettings({ negocio: { nombre: 'N'.repeat(300), correo: '', telefono: 'T'.repeat(300), direccion: 'D'.repeat(300), garantia_condiciones: 'C'.repeat(2000) } });
  assert.equal(values.negocio.nombre.length, 300);
  assert.equal(values.negocio.garantia_condiciones.length, 2000);
  const cleared = validateSettings({ negocio: { correo: ' ', telefono: '', direccion: '\t' } }, values);
  assert.equal(cleared.negocio.correo, '');
  assert.equal(cleared.negocio.telefono, '');
  assert.equal(cleared.negocio.direccion, '');
});

for (const [field, values] of Object.entries({
  garantia_meses: [1, 36], margen_repuesto_porcentaje: [0, 0.01, 20.5, 1000],
})) {
  for (const value of values) test(`Negocio acepta ${field} = ${value}`, () => {
    assert.equal(validateSettings({ negocio: { [field]: value } }).negocio[field], value);
  });
}

for (const [field, values] of Object.entries({
  nombre: ['', '  ', null, 123, 'N'.repeat(301)],
  correo: ['sin-arroba', 'a@b', 'a b@example.test', null, 'a'.repeat(301)],
  telefono: [null, 50588880000, 'T'.repeat(301)],
  direccion: [null, {}, 'D'.repeat(301)],
  garantia_condiciones: ['', '\n\t', false, 'C'.repeat(2001)],
  garantia_meses: [0, 37, 1.5, '6', null, true, NaN, Infinity],
  margen_repuesto_porcentaje: [-0.01, 1000.01, '20', null, false, NaN, Infinity],
})) {
  values.forEach((value, index) => test(`Negocio rechaza ${field}: caso inválido ${index + 1}`, () => {
    const previous = structuredClone(DEFAULT_ADMIN_SETTINGS);
    const snapshot = structuredClone(previous);
    assert.throws(() => validateSettings({ negocio: { [field]: value } }, previous), { status: 400 });
    assert.deepEqual(previous, snapshot);
  }));
}

test('Negocio rechaza estructuras y parámetros no soportados, incluido logo', () => {
  for (const input of [null, [], 'negocio', { negocio: null }, { negocio: [] }, { negocio: 'taller' }, { negocio: { logo_url: 'https://example.test/logo.png' } }, JSON.parse('{"negocio":{"__proto__":{"nombre":"Intruso"}}}')]) {
    assert.throws(() => validateSettings(input), { status: 400 });
  }
  assert.equal({}.nombre, undefined);
});
