import test from 'node:test';
import assert from 'node:assert/strict';
import { facturacionAccess } from '../../src/features/contabilidad/utils/facturacionAccess.js';

test('Servicio al Cliente puede facturar y abrir la entrega desde la misma pantalla', () => {
  assert.deepEqual(facturacionAccess('ServicioCliente'), { canDeliver: true, canInvoice: true });
});

test('Secretaría y administradores conservan las acciones de facturación y entrega', () => {
  for (const role of ['Secretaria', 'Secretaría', 'Administrador', 'admin_pro', 'Admin', 'Servicio Cliente']) {
    assert.deepEqual(facturacionAccess(role), { canDeliver: true, canInvoice: true }, role);
  }
});

test('Los perfiles de consulta y otros roles no ofrecen acciones que el servidor rechaza', () => {
  for (const role of ['Contabilidad', 'Garantias', 'Reclamos', 'Recepcion', 'Bodega', 'Calidad', 'Tecnico', 'TecnicoJefe', '', null, undefined]) {
    assert.deepEqual(facturacionAccess(role), { canDeliver: false, canInvoice: false }, String(role));
  }
});
