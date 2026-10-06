import test from 'node:test';
import assert from 'node:assert/strict';
import { datosCorreccionCierre, validarCorreccionCierre } from '../../src/utils/correccionCierre.js';

const cierre = new Date('2026-09-29T12:00:00Z');
const orden = { estado: 'FINALIZADO', fecha_finalizacion: cierre, facturas: [], fecha_entrega: null };
const reglas = { correccion_cierre_horas: 24, correccion_excepcional_habilitada: true };

test('El plazo configurable se mide desde el cierre, incluso en el límite exacto', () => {
  const limite = new Date('2026-09-30T12:00:00Z');
  assert.equal(datosCorreccionCierre(orden, reglas, limite).requiere_excepcion, false);
  assert.equal(datosCorreccionCierre(orden, reglas, new Date(limite.getTime() + 1)).requiere_excepcion, true);
  assert.equal(datosCorreccionCierre(orden, { ...reglas, correccion_cierre_horas: 48 }, new Date(limite.getTime() + 1)).requiere_excepcion, false);
});

test('Después del plazo exige excepción explícita y la regla del administrador', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  assert.throws(() => validarCorreccionCierre(orden, { motivo: 'Foto omitida' }, reglas, now), { statusCode: 409 });
  assert.throws(() => validarCorreccionCierre(orden, { motivo: 'Foto omitida', excepcion: true }, { ...reglas, correccion_excepcional_habilitada: false }, now), { statusCode: 409 });
  assert.equal(validarCorreccionCierre(orden, { motivo: 'Foto omitida', excepcion: true }, reglas, now).es_excepcion, true);
});

test('La entrega y la factura conservan el informe original; canceladas y revisiones pendientes quedan fuera', () => {
  assert.equal(datosCorreccionCierre({ ...orden, facturas: [{ id_factura: 1 }] }, reglas).puede_editar_informe, false);
  assert.equal(datosCorreccionCierre({ ...orden, estado: 'ENTREGADO' }, reglas).puede_editar_informe, false);
  assert.equal(datosCorreccionCierre({ ...orden, estado: 'CANCELADO' }, reglas), null);
  assert.equal(datosCorreccionCierre({ ...orden, estado: 'IRREPARABLE', irreparable_estado: 'PENDIENTE' }, reglas), null);
});
