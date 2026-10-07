import ExcelJS from 'exceljs';

export const createAdminExcel = async ({ title, headers, rows }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SGR';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Reporte', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: headers.length > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  sheet.mergeCells(1, 1, 1, headers.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF183153' } };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(2, 1, 2, headers.length);
  sheet.getCell(2, 1).value = `${rows.length} registros · ${new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Managua' }).format(new Date())}`;
  sheet.getCell(2, 1).font = { color: { argb: 'FF52657A' }, size: 10 };

  const headerRow = sheet.getRow(4);
  headerRow.values = headers;
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF183153' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });

  rows.forEach((values, index) => {
    const row = sheet.addRow(values.map((value) => value == null ? '' : value));
    row.alignment = { vertical: 'top', wrapText: true };
    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
    }
  });

  sheet.columns.forEach((column, index) => {
    const longest = Math.max(headers[index].length, ...rows.slice(0, 200).map((row) => String(row[index] ?? '').length));
    column.width = Math.min(Math.max(longest + 3, 13), 55);
  });
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, rows.length + 4), column: headers.length } };
  sheet.printTitlesRow = '1:4';

  return Buffer.from(await workbook.xlsx.writeBuffer());
};
