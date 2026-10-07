import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const excelValue = (value) => {
  if (value == null) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
};

const normalizePdfCell = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const buildPdfTableData = (rows, columns) => {
  const headers = columns.map((col) => col.header);
  const body = rows.map((row) =>
    columns.map((col) => normalizePdfCell(row[col.accessor]))
  );

  return { headers, body };
};

const formatReportDate = () => {
  return new Date().toLocaleString('es-NI', {
    timeZone: 'America/Managua',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const parseNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const cleaned = value.replace(/[^0-9.-]+/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
};

const getNumericSummaries = (rows, columns) => {
  return columns
    .map((column) => {
      // Las columnas con importes de distintas monedas no admiten un total común.
      if (column.summarize !== true) return null;
      const values = rows
        .map((row) => parseNumber(row[column.accessor]))
        .filter((value) => value !== null);

      if (!values.length || values.length < Math.max(2, Math.ceil(rows.length * 0.6))) return null;

      const total = values.reduce((sum, value) => sum + value, 0);
      return {
        label: column.header,
        value: total,
      };
    })
    .filter(Boolean)
    .slice(0, 3);
};

const drawHeader = (doc, title, rows, columns, recordCount = rows.length) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedAt = formatReportDate();
  const summaries = getNumericSummaries(rows, columns);

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setFillColor(79, 70, 229);
  doc.roundedRect(14, 10, 12, 12, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SG', 16.6, 18);

  doc.setFontSize(16);
  doc.text(title, 32, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text('Sistema de gestión - Administración', 32, 21);
  doc.text(`Generado: ${generatedAt}`, 32, 26);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 42, pageWidth - 28, summaries.length ? 30 : 18, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 42, pageWidth - 28, summaries.length ? 30 : 18, 3, 3, 'S');

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Resumen del reporte', 20, 51);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${recordCount} ${recordCount === 1 ? 'registro exportado' : 'registros exportados'}`, 20, 57);

  summaries.forEach((summary, index) => {
    const x = 20 + index * 58;
    const y = 66;
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(String(summary.label).slice(0, 22), x, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(summary.value.toLocaleString('es-NI', { maximumFractionDigits: 2 }), x, y + 6);
  });

  return summaries.length ? 80 : 68;
};

const drawFooter = (doc, title) => {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (page > 1) {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 16, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(title, 14, 10, { maxWidth: pageWidth - 28 });
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('Sistema de gestión', 14, pageHeight - 9);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - 14, pageHeight - 9, { align: 'right' });
  }
};

const drawSectionTitle = (doc, title, y) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 26;
  }

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, 18, y + 6.5);

  return y + 14;
};

const drawMetadata = (doc, metadata, startY) => {
  if (!metadata?.length) return startY;

  autoTable(doc, {
    body: metadata.map((item) => [item.label, item.value]),
    startY,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      textColor: [71, 85, 105],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 44 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 17, right: 17 },
  });

  return doc.lastAutoTable.finalY + 8;
};

const drawEmptySection = (doc, y) => {
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Sin registros para este período.', 18, y);
  return y + 8;
};

export const downloadJsonExcel = async (rows, columns, filename) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de gestión';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Reporte', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: columns.length > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const title = filename.replace(/\.(csv|xls|xlsx)$/i, '').replaceAll('_', ' ');
  const lastColumn = Math.max(columns.length, 1);
  sheet.mergeCells(1, 1, 1, lastColumn);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  sheet.getCell(1, 1).alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 30;
  sheet.mergeCells(2, 1, 2, lastColumn);
  sheet.getCell(2, 1).value = `Generado: ${formatReportDate()} · ${rows.length} registros`;
  sheet.getCell(2, 1).font = { size: 10, color: { argb: 'FF475569' } };
  sheet.getRow(2).height = 23;

  const header = sheet.getRow(4);
  header.values = columns.map((column) => column.header);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.addRow(columns.map((column) => excelValue(row[column.accessor])));
    if (rowIndex % 2 === 1) {
      excelRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
    }
    excelRow.eachCell((cell) => { cell.alignment = { vertical: 'top', wrapText: true }; });
  });
  columns.forEach((column, index) => {
    const longest = Math.max(String(column.header).length, ...rows.slice(0, 200).map((row) => String(excelValue(row[column.accessor])).length));
    sheet.getColumn(index + 1).width = Math.min(Math.max(longest + 2, 14), 48);
  });
  if (columns.length) sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename.replace(/\.(csv|xls|xlsx)$/i, '') + '.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadJsonPdf = (rows, columns, filename, title = 'Reporte') => {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', format: columns.length > 9 ? 'a3' : 'a4' });
  const { headers, body } = buildPdfTableData(rows, columns);
  const startY = drawHeader(doc, title, rows, columns);

  autoTable(doc, {
    head: [headers],
    body,
    startY,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: '#ffffff',
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap',
      font: 'helvetica',
      valign: 'middle',
    },
    margin: { top: 22, left: 14, right: 14, bottom: 22 },
    pageBreak: 'auto',
    horizontalPageBreak: columns.length > 12,
    horizontalPageBreakRepeat: 0,
    horizontalPageBreakBehaviour: 'afterAllRows',
  });

  drawFooter(doc, title);
  doc.save(filename);
};

export const downloadSectionedPdf = ({
  title = 'Reporte general',
  filename = 'reporte_general.pdf',
  description = '',
  metadata = [],
  sections = [],
}) => {
  const maxColumns = Math.max(0, ...sections.map((section) => section.columns?.length || 0));
  const doc = new jsPDF({ orientation: 'landscape', format: maxColumns > 9 ? 'a3' : 'a4' });
  const totalRows = sections.reduce((sum, section) => sum + (section.rows?.length || 0), 0);
  let cursorY = drawHeader(doc, title, [], [], totalRows);

  if (description) {
    const lines = doc.splitTextToSize(description, doc.internal.pageSize.getWidth() - 36);
    if (cursorY + lines.length * 4 > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      cursorY = 26;
    }
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(lines, 18, cursorY);
    cursorY += lines.length * 4 + 6;
  }

  cursorY = drawMetadata(doc, metadata, cursorY);

  sections.forEach((section) => {
    cursorY = drawSectionTitle(doc, section.title, cursorY);

    if (!section.rows?.length) {
      cursorY = drawEmptySection(doc, cursorY);
      return;
    }

    const { headers, body } = buildPdfTableData(section.rows, section.columns);

    autoTable(doc, {
      head: [headers],
      body,
      startY: cursorY,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: '#ffffff',
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      bodyStyles: {
        fontSize: 7.2,
        textColor: [51, 65, 85],
        cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      styles: {
        overflow: 'linebreak',
        cellWidth: 'auto',
        font: 'helvetica',
        valign: 'middle',
      },
      margin: { top: 22, left: 14, right: 14, bottom: 22 },
      pageBreak: 'auto',
      horizontalPageBreak: section.columns.length > 12,
      horizontalPageBreakRepeat: 0,
      horizontalPageBreakBehaviour: 'afterAllRows',
    });

    cursorY = doc.lastAutoTable.finalY + 12;
  });

  drawFooter(doc, title);
  doc.save(filename);
};
