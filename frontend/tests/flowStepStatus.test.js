import test from 'node:test';
import assert from 'node:assert/strict';
import { flowStepStatus } from '../src/features/recepcion/utils/flowStepStatus.js';

test('una orden registrada o en reparación no se muestra como finalizada', () => {
  for (const estado of ['PENDIENTE', 'ASIGNADO', 'EN_REPARACION', 'ESPERANDO_PIEZA', 'CANCELADO']) {
    assert.equal(flowStepStatus({ orden: { estado } }, 'orden').complete, false);
  }
  assert.equal(flowStepStatus({ orden: { estado: 'FINALIZADO' } }, 'orden').complete, true);
});

test('aprobar piezas no equivale a entregarlas y finalizar no equivale a aprobar calidad', () => {
  const item = { repuestos: { total: 2, aprobados: 2, entregados: 1 }, orden: { estado: 'FINALIZADO', calidad_estado: 'PENDIENTE' } };
  assert.deepEqual(flowStepStatus(item, 'repuestos'), { label: '1/2 entregadas', complete: false });
  assert.equal(flowStepStatus(item, 'calidad').complete, false);
  assert.equal(flowStepStatus(item, 'entrega').complete, false);
  assert.equal(flowStepStatus({ orden: { estado: 'ENTREGADO', calidad_estado: 'APROBADO' } }, 'entrega').complete, true);
});
