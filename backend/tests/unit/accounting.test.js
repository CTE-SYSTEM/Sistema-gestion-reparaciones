import test from 'node:test';
import assert from 'node:assert/strict';
import { accountingPeriod, accountingWhere } from '../../src/services/contabilidadService.js';
import { documentFilename, reportFilename } from '../../../frontend/src/features/admin/utils/reportIdentity.js';

test('el período contable incluye el día completo de Managua y el día bisiesto', () => {
  const period = accountingPeriod({ anio: 2024, fecha_inicio: '2024-02-29', fecha_fin: '2024-02-29' });
  assert.equal(period.gte.toISOString(), '2024-02-29T06:00:00.000Z');
  assert.equal(period.lt.toISOString(), '2024-03-01T06:00:00.000Z');
  assert.equal(accountingPeriod({ anio: 2025 }).from, '2025-01-01');
  assert.equal(accountingPeriod({ anio: 2025 }).to, '2025-12-31');
});

test('rechaza períodos y filtros inválidos antes de consultar', () => {
  for (const query of [{ anio: 1999 }, { fecha_inicio: '2026-02-30' }, { fecha_inicio: '2026-03-02', fecha_fin: '2026-03-01' }]) {
    assert.throws(() => accountingPeriod(query), error => (error.statusCode || error.status) === 400);
  }
  for (const query of [{ tipo: 'OTRO' }, { metodo: 'Desconocido' }, { usuario_id: '1 OR TRUE' }]) {
    assert.throws(() => accountingWhere(query, accountingPeriod({ anio: 2026 })), { statusCode: 400 });
  }
  const injected = accountingWhere({ search: "%' OR TRUE--" }, accountingPeriod({ anio: 2026 }));
  assert.ok(!injected.text.includes('OR TRUE--'));
  assert.ok(injected.values.some(value => String(value).includes('OR TRUE--')));
});

test('los nombres de descarga conservan solamente el tipo de documento', () => {
  assert.equal(reportFilename({ id: 'facturacion' }, { fecha_inicio: '2026-01-01' }, 'xlsx'), 'facturacion.xlsx');
  assert.equal(documentFilename('ordenes_estado_2026-01-01_2026-12-31.pdf', 'pdf'), 'ordenes_estado.pdf');
  assert.equal(documentFilename('informe-orden-108.xlsx', 'xlsx'), 'informe_orden.xlsx');
});
