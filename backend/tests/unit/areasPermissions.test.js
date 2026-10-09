import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, PERMISSIONS, requireAnyPermission } from '../../src/utils/permissions.js';

test('Recepción conserva el ingreso y Servicio al Cliente gestiona la orden', () => {
  assert.equal(hasPermission('Recepcion', PERMISSIONS.CLIENTES_GESTIONAR), true);
  assert.equal(hasPermission('Recepcion', PERMISSIONS.EQUIPOS_GESTIONAR), true);
  assert.equal(hasPermission('Recepcion', PERMISSIONS.DIAGNOSTICOS_GESTIONAR), true);
  assert.equal(hasPermission('Recepcion', PERMISSIONS.DIAGNOSTICOS_ATENDER), false);
  assert.equal(hasPermission('Recepcion', PERMISSIONS.ORDENES_GESTIONAR), false);
  assert.equal(hasPermission('Recepcion', PERMISSIONS.FACTURAS_GESTIONAR), false);
  assert.equal(hasPermission('Recepcion', PERMISSIONS.RECLAMOS_CREAR), false);

  assert.equal(hasPermission('ServicioCliente', PERMISSIONS.CLIENTES_GESTIONAR), false);
  assert.equal(hasPermission('ServicioCliente', PERMISSIONS.EQUIPOS_GESTIONAR), false);
  assert.equal(hasPermission('ServicioCliente', PERMISSIONS.DIAGNOSTICOS_GESTIONAR), false);
  assert.equal(hasPermission('ServicioCliente', PERMISSIONS.DIAGNOSTICOS_ATENDER), true);
  assert.equal(hasPermission('ServicioCliente', PERMISSIONS.ORDENES_GESTIONAR), true);
  assert.equal(hasPermission('ServicioCliente', PERMISSIONS.FACTURAS_VER), true);
  assert.equal(hasPermission('ServicioCliente', PERMISSIONS.FACTURAS_GESTIONAR), true);
  assert.equal(hasPermission('ServicioCliente', PERMISSIONS.GARANTIAS_VER), true);
  assert.equal(hasPermission('ServicioCliente', PERMISSIONS.RECLAMOS_CREAR), true);
  assert.equal(hasPermission('Contabilidad', PERMISSIONS.FACTURAS_VER), true);
  assert.equal(hasPermission('Contabilidad', PERMISSIONS.FACTURAS_GESTIONAR), false);
  assert.equal(hasPermission('Contabilidad', PERMISSIONS.CONTABILIDAD_MOVIMIENTOS), true);
});

test('Servicio al Cliente puede consultar clientes para una orden sin poder modificarlos', () => {
  let allowed = false;
  const req = { user: { rol: 'ServicioCliente' } };
  const res = { status() { throw new Error('Consulta rechazada'); } };
  requireAnyPermission(PERMISSIONS.CLIENTES_GESTIONAR, PERMISSIONS.ORDENES_GESTIONAR)(req, res, () => { allowed = true; });
  assert.equal(allowed, true);
  assert.equal(hasPermission('Secretaria', PERMISSIONS.DIAGNOSTICOS_ATENDER), true);
});
