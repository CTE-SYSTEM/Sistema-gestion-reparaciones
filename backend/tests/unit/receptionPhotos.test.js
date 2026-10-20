import test from 'node:test';
import assert from 'node:assert/strict';
import { receptionPhotosReadOnly } from '../../src/utils/receptionPhotos.js';

test('recepción carga fotos antes de asignar; asignación o inicio permiten solo consulta', () => {
  const pending = { estado_del_diagnostico: 'PENDIENTE', ordenes: [] };
  assert.equal(receptionPhotosReadOnly('diagnostico', pending), false);
  for (const change of [{ tecnico_id: 1 }, { fecha_inicio: new Date() }, { estado_del_diagnostico: 'EN_REVISION' }, { estado_del_diagnostico: 'COMPLETADO' }, { ordenes: [{ id_orden: 1 }] }]) {
    assert.equal(receptionPhotosReadOnly('diagnostico', { ...pending, ...change }), true);
  }
});

test('órdenes asignadas, iniciadas y cerradas son de consulta para recepción', () => {
  assert.equal(receptionPhotosReadOnly('orden', { estado: 'PENDIENTE' }), false);
  assert.equal(receptionPhotosReadOnly('orden', { estado: 'PENDIENTE', tecnico_id: 1 }), true);
  assert.equal(receptionPhotosReadOnly('orden', { estado: 'PENDIENTE', fecha_inicio_reparacion: new Date() }), true);
  for (const estado of ['ASIGNADO', 'EN_REPARACION', 'ESPERANDO_PIEZA', 'FINALIZADO', 'ENTREGADO', 'CANCELADO']) {
    assert.equal(receptionPhotosReadOnly('orden', { estado }), true);
  }
});
