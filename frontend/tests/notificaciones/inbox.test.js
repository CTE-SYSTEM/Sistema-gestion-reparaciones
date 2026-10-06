import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeNotifications, reconcileNotifications } from '../../src/utils/notificationInbox.js';

const notice = (id, minute) => ({ id, timestamp: `2026-09-29T12:${String(minute).padStart(2, '0')}:00Z`, title: id });
test('Avisos: reconectar no duplica un diagnóstico y conserva el más reciente primero', () => {
  const rows = mergeNotifications([notice('nuevo', 20), notice('anterior', 10)], [notice('anterior', 10)]);
  assert.deepEqual(rows.map((r) => r.id), ['nuevo', 'anterior']);
});
test('Avisos: una respuesta atrasada conserva lo recibido en vivo y no revive lo marcado como leído', () => {
  const history = [notice('leido', 10), notice('pendiente', 5)];
  const rows = reconcileNotifications(history, [notice('nuevo', 20), notice('leido', 10)], new Set(['leido']));
  assert.deepEqual(rows.map((r) => r.id), ['nuevo', 'pendiente']);
  assert.deepEqual(reconcileNotifications([], [], new Set()), []);
});
test('Avisos: la bandeja limita 25 filas y prioriza la llegada durante la consulta', () => {
  const history = Array.from({ length: 30 }, (_, i) => notice(String(i), i));
  const rows = reconcileNotifications(history, [notice('en vivo', 50)]);
  assert.equal(rows.length, 25); assert.equal(rows[0].id, 'en vivo');
  assert.ok(!rows.some((r) => r.id === '0'));
});
