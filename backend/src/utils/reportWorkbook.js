import ExcelJS from 'exceljs';

const ink = 'FF17233B', accent = 'FF4338CA', muted = 'FF64748B';
const numeric = key => /^(monto|total|subtotal|importe|valor|costo|precio|cantidad|stock|ganancia|perdida|margen|rentabilidad|porcentaje|pendiente|efecto|ingresos|egresos|neto|cobros|compras|devoluciones|gastos|acumulado|facturado|entradas|salidas|cartera|promedio|dias|horas)/i.test(key);
const integer = key => /^(id_|cantidad|stock|dias|orden$|reclamo$|factura$|compra$|diagnostico$|tecnico$)/i.test(key);
const dateKey = key => /fecha|apertura|vencimiento|^inicio$|^cierre$|^generado$/i.test(key);
const label = key => key.replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase());
const localDate = value => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`);
  const source = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(source.getTime())) return String(value);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(source).map(p => [p.type, p.value]));
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)));
};
const valueOf = (value, key) => {
  if (value == null) return '';
  if (value instanceof Date || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(value) && dateKey(key)) return localDate(value);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string' && numeric(key) && /^-?\d+(\.\d+)?$/.test(value) && Number.isSafeInteger(Math.trunc(Number(value)))) return Number(value);
  return typeof value === 'object' ? JSON.stringify(value) : value;
};
const stringOf = value => value instanceof Date ? '00/00/0000 00:00' : String(value ?? '');
const rowHeight = (values, widths, minimum = 25) => Math.min(409, Math.max(minimum, ...values.map((value, index) => {
  const capacity = Math.max(8, (widths[index] || 20) - 2);
  const lines = stringOf(value).split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / capacity)), 0);
  return lines * 14 + 10;
})));

export function createReportWorkbook(result, creator = 'SGR') {
  const book = new ExcelJS.Workbook();
  book.creator = creator; book.created = new Date(result.generado_en); book.modified = new Date();
  const columns = result.columns || [];
  const count = Math.max(1, columns.length);
  const sheet = book.addWorksheet('Reporte', { views: [{ state: 'frozen', ySplit: 4, xSplit: columns.length > 5 ? 1 : 0, showGridLines: false, zoomScale: columns.length > 10 ? 85 : 100 }] });
  const values = (result.data || []).map(row => columns.map(column => valueOf(row[column.accessor], column.accessor)));
  const widths = columns.map((column, index) => {
    const key = column.accessor;
    if (integer(key)) return Math.max(12, Math.min(22, column.header.length + 3));
    if (numeric(key)) return Math.max(17, Math.min(24, column.header.length + 3));
    if (dateKey(key) || values.some(row => row[index] instanceof Date)) return 22;
    const longest = Math.max(column.header.length, ...values.slice(0, 200).map(row => stringOf(row[index]).length));
    return Math.min(/descripcion|analisis|resolucion|motivo|nota|observacion|diagnostico_real/.test(key) ? 56 : 36, Math.max(19, longest + 3));
  });
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  for (const row of [1, 2]) if (count > 1) sheet.mergeCells(row, 1, row, count);
  sheet.getCell('A1').value = result.reporte.nombre;
  sheet.getCell('A1').font = { name: 'Calibri', bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ink } };
  sheet.getCell('A1').alignment = { vertical: 'middle', wrapText: true }; sheet.getRow(1).height = 36;
  sheet.getCell('A2').value = `${result.total ?? values.length} registros. Fechas y horas de Nicaragua. Filtros y criterios en Información.`;
  sheet.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: muted } };
  sheet.getCell('A2').alignment = { vertical: 'middle', wrapText: true }; sheet.getRow(2).height = 30;
  const header = sheet.getRow(4);
  header.values = columns.map(column => column.header);
  header.height = rowHeight(columns.map(column => column.header), widths, 30);
  header.eachCell(cell => { cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } }; cell.alignment = { vertical: 'middle', wrapText: true }; });
  values.forEach((values, index) => {
    const row = sheet.getRow(index + 5); row.values = values; row.height = rowHeight(values, widths);
    for (let columnIndex = 1; columnIndex <= count; columnIndex++) {
      const cell = row.getCell(columnIndex), key = columns[columnIndex - 1]?.accessor || '';
      cell.font = { name: 'Calibri', size: 11, color: { argb: ink } };
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: typeof cell.value === 'number' ? 'right' : 'left' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 ? 'FFF1F5F9' : 'FFFFFFFF' } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      if (cell.value instanceof Date) cell.numFmt = 'dd/mm/yyyy hh:mm';
      else if (typeof cell.value === 'number') cell.numFmt = integer(key) ? '#,##0' : numeric(key) ? '#,##0.00;[Red](#,##0.00)' : '0';
    }
  });
  if (!values.length) { sheet.getCell('A5').value = 'No hay registros con los filtros seleccionados.'; sheet.getRow(5).height = 30; }
  if (columns.length) sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, values.length + 4), column: count } };
  sheet.pageSetup = { paperSize: count > 12 ? 8 : 9, orientation: count > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:4', printArea: `A1:${sheet.getColumn(count).letter}${Math.max(5, values.length + 4)}`, horizontalCentered: true };
  sheet.headerFooter.oddFooter = '&LSGR&R Página &P de &N';
  const info = book.addWorksheet('Información', { views: [{ showGridLines: false }] });
  info.columns = [{ width: 30 }, { width: 85 }];
  const details = [['Reporte', result.reporte.nombre], ['Generado', localDate(result.generado_en)], ['Zona horaria', 'America/Managua'], ['Registros', result.total ?? values.length],
    ...Object.entries(result.filtros || {}).filter(([key]) => !['page', 'pageSize'].includes(key)).map(([key, value]) => [label(key), String(value ?? '')]),
    ...(result.nota ? [['Criterio del reporte', result.nota]] : []),
    ...Object.entries(result.resumen_financiero || result.summary || {}).map(([key, value]) => [label(key), Number(value)])];
  details.forEach((values, index) => { const row = info.addRow(values); row.height = rowHeight(values, [30, 85], 28); row.alignment = { wrapText: true, vertical: 'top' }; row.font = { name: 'Calibri', size: 11, color: { argb: ink } }; row.getCell(1).font = { ...row.font, bold: true }; if (index % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; if (values[1] instanceof Date) row.getCell(2).numFmt = 'dd/mm/yyyy hh:mm'; if (typeof values[1] === 'number') row.getCell(2).numFmt = values[0] === 'Registros' ? '#,##0' : '#,##0.00'; });
  return book;
}
