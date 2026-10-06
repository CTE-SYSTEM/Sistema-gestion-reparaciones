import test from 'node:test';
import assert from 'node:assert/strict';
import { getReceptionProfile as frontendProfile } from '../../src/features/secretaria/components/Diagnostico/receptionRequirements.js';
import { getReceptionProfile as backendProfile } from '../../../backend/src/utils/receptionRequirements.js';

test('Secretaría usa las mismas restricciones de recepción en formulario y servidor', () => {
  const cases = [
    ['Monitor', { charger: false, access: false }],
    ['TV LED', { charger: false, access: false }],
    ['Impresora', { charger: false, access: false }],
    ['UPS', { charger: false, access: false }],
    ['Router', { charger: false, access: true }],
    ['PC escritorio', { charger: false, access: true }],
    ['PlayStation', { charger: false, access: true }],
    ['Computadora portátil', { charger: true, access: true }],
    ['Teléfono', { charger: true, access: true }],
    ['Consola portátil', { charger: true, access: true }],
    ['Tablet', { charger: true, access: true }],
    ['Tipo futuro', { charger: true, access: true }],
  ];
  for (const [type, expected] of cases) {
    assert.deepEqual(frontendProfile(type), expected, `Formulario: ${type}`);
    assert.deepEqual(backendProfile(type), expected, `Servidor: ${type}`);
  }
});
