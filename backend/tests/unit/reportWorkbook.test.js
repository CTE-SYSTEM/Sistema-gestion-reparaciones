import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createReportWorkbook } from '../../src/utils/reportWorkbook.js';

test('Excel de reportes conserva fechas locales, cifras, identificadores y textos largos', async () => {
  const result = { reporte: { id: 'reclamos', nombre: 'Reclamos y responsables' }, generado_en: '2026-10-14T19:30:00Z', total: 1,
    columns: [{ accessor: 'reclamo', header: 'Reclamo' }, { accessor: 'apertura', header: 'Fecha de apertura' }, { accessor: 'costo_estimado', header: 'Costo estimado C$' }, { accessor: 'descripcion', header: 'Descripción del problema' }],
    data: [{ reclamo: 12, apertura: '2026-10-14T19:30:00Z', costo_estimado: '1530.75', descripcion: 'Se revisó la falla original y se documentó la evidencia para decidir la cobertura. '.repeat(5) }],
    filtros: { fecha_inicio: '2026-10-01' }, nota: 'La cobertura requiere revisar la garantía.', resumen_financiero: { costo_estimado: 1530.75 } };
  const book = createReportWorkbook(result);
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await book.xlsx.writeBuffer());
  const sheet = loaded.getWorksheet('Reporte');
  assert.equal(sheet.getCell('A5').value, 12);
  assert.equal(sheet.getCell('A5').numFmt, '#,##0');
  assert.ok(sheet.getCell('B5').value instanceof Date);
  assert.equal(sheet.getCell('B5').value.getUTCHours(), 13);
  assert.equal(sheet.getCell('C5').value, 1530.75);
  assert.ok(sheet.getRow(5).height > 50);
  assert.equal(sheet.getCell('D5').value, result.data[0].descripcion);
  assert.equal(sheet.views[0].ySplit, 4);
  assert.equal(sheet.autoFilter, 'A4:D5');
  assert.ok(loaded.getWorksheet('Información').getRow(1).getCell(2).value.includes('Reclamos'));
});

test('Excel sin datos muestra un mensaje y mantiene la información del reporte', async () => {
  const book = createReportWorkbook({ reporte: { id: 'vacio', nombre: 'Reporte vacío' }, generado_en: new Date().toISOString(), total: 0, columns: [], data: [], filtros: {} });
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await book.xlsx.writeBuffer());
  assert.equal(loaded.getWorksheet('Reporte').getCell('A5').value, 'No hay registros con los filtros seleccionados.');
});

test('Una fecha sin hora conserva el día y los importes cero y negativos son numéricos', () => {
  const book = createReportWorkbook({ reporte: { id: 'fechas', nombre: 'Fechas' }, generado_en: new Date().toISOString(), columns: [{ accessor: 'fecha', header: 'Fecha' }, { accessor: 'monto', header: 'Monto' }], data: [{ fecha: '2026-10-01', monto: '0' }, { fecha: '2026-10-02', monto: '-123.45' }] });
  const sheet = book.getWorksheet('Reporte');
  assert.equal(sheet.getCell('A5').value.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(sheet.getCell('B5').value, 0);
  assert.equal(sheet.getCell('B6').value, -123.45);
});
