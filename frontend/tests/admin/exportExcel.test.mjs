import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { downloadJsonExcel } from '../../src/features/admin/utils/csvExport.js';

test('el botón Excel produce un XLSX válido y conserva referencias como texto', async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let blob;
  let downloadedName;

  try {
    URL.createObjectURL = (value) => { blob = value; return 'blob:reporte'; };
    URL.revokeObjectURL = () => {};
    globalThis.window = { setTimeout: () => {} };
    globalThis.document = {
      body: { appendChild: () => {} },
      createElement: () => ({ click() { downloadedName = this.download; }, remove: () => {} }),
    };

    await downloadJsonExcel(
      [{ referencia: '0007', cliente: 'José', monto: 125.5, observacion: '=2+3' }],
      [
        { header: 'Referencia', accessor: 'referencia' },
        { header: 'Cliente', accessor: 'cliente' },
        { header: 'Monto', accessor: 'monto' },
        { header: 'Observación', accessor: 'observacion' },
      ],
      'reporte.csv',
    );

    assert.equal(downloadedName, 'reporte.xlsx');
    const data = Buffer.from(await blob.arrayBuffer());
    assert.equal(data.subarray(0, 2).toString(), 'PK');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);
    const sheet = workbook.worksheets[0];
    assert.equal(sheet.getCell('A5').value, '0007');
    assert.equal(sheet.getCell('B5').value, 'José');
    assert.equal(sheet.getCell('C5').value, 125.5);
    assert.equal(sheet.getCell('D5').value, '=2+3');
    assert.equal(sheet.views[0].ySplit, 4);
    assert.ok(sheet.autoFilter);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});
