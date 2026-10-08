import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararAprobacionOrden } from '../../src/features/recepcion/utils/aprobacionOrden.js';

const diagnostico = {
  id_diagnostico: 30,
  estado_contacto: 'PENDIENTE_CONTACTAR',
  observacion_respuesta: 'Se habló con el cliente',
  diagnostico_real: 'Cambio de batería',
  presupuesto_estimado: 70,
  equipo: { id_equipo: 37, cliente: { id_cliente: 9 } },
};

test('la opción Documento enviado recién seleccionada se guarda antes de crear la orden', () => {
  const plan = prepararAprobacionOrden(diagnostico, {
    estadoContacto: 'DOCUMENTO_ENVIADO', montoAutorizado: '70', requierePiezas: true,
  });
  assert.equal(plan.error, undefined);
  assert.equal(plan.guardarContacto, true);
  assert.deepEqual(plan.contacto, { estado_contacto: 'DOCUMENTO_ENVIADO', observacion_respuesta: 'Se habló con el cliente' });
  assert.deepEqual(plan.orden, { diagnostico_id: 30, monto_autorizado: 70, requiere_piezas: true });
});

test('un estado de contacto ya guardado no exige una segunda actualización', () => {
  const plan = prepararAprobacionOrden({ ...diagnostico, estado_contacto: 'ESPERANDO_RESPUESTA' }, {
    montoAutorizado: 100, requierePiezas: false,
  });
  assert.equal(plan.guardarContacto, false);
  assert.equal(plan.orden.requiere_piezas, false);
});

test('sin registrar el envío o sin monto válido la aprobación muestra el problema', () => {
  assert.match(prepararAprobacionOrden(diagnostico, { montoAutorizado: 70, requierePiezas: true }).error, /Documento enviado/);
  assert.match(prepararAprobacionOrden(diagnostico, { estadoContacto: 'DOCUMENTO_ENVIADO', montoAutorizado: 0, requierePiezas: true }).error, /monto autorizado/);
});
