import ExcelJS from 'exceljs';
import prisma from '../../app/prismaClient.js';
import { loadAdminReport, REPORT_CATALOG } from '../../services/adminReportsService.js';
import { getBusinessSettings } from '../../services/adminSettingsService.js';

const numericColumn = (accessor) => /^(stock_|cantidad|costo|precio|monto|subtotal|total|ganancia|perdida|margen|rentabilidad|promedio|dias_|horas_|porcentaje|valor_|importe_|efecto_)/i.test(accessor);
const integerColumn = (accessor) => /^(stock_|cantidad|dias_|horas_)/i.test(accessor);
const excelValue = (value, accessor) => {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && numericColumn(accessor) && /^-?\d+(\.\d+)?$/.test(value)) {
    const number = Number(value);
    if (Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER) return number;
  }
  return value;
};

const handleError = (res, error) => {
  console.error('[Reportes]', error.message);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo generar el reporte.' });
};
export const getReportCatalog = async (req, res) => {
  try { res.json({ data: REPORT_CATALOG, defaults: (await getBusinessSettings()).reglas }); }
  catch (error) { handleError(res, error); }
};
export const getReporteAdminPro = async (req, res) => {
  try { res.json(await loadAdminReport(req.params.tipo, req.query)); }
  catch (error) { handleError(res, error); }
};
export const downloadReportExcel = async (req, res) => {
  try {
    const result = await loadAdminReport(req.params.tipo, req.query);
    const book = new ExcelJS.Workbook();
    book.creator = req.user.username;
    book.created = new Date();
    const sheet = book.addWorksheet('Reporte');
    const columnCount = Math.max(result.columns.length, 1);
    sheet.mergeCells(1, 1, 1, columnCount);
    const title = sheet.getCell(1, 1);
    title.value = result.reporte.nombre;
    title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    title.alignment = { vertical: 'middle' };
    sheet.getRow(1).height = 30;
    sheet.addRow(['Generado', result.generado_en, 'Registros', result.total]);
    sheet.getRow(2).font = { size: 10, color: { argb: 'FF475569' } };
    const filterSummary = Object.entries(result.filtros).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join(' · ') || 'Sin filtros';
    sheet.addRow(['Filtros', result.nota ? `${filterSummary}\nNota: ${result.nota}` : filterSummary]);
    sheet.getRow(3).alignment = { wrapText: true, vertical: 'middle' };
    sheet.getRow(3).height = result.nota ? 45 : 30;
    if (result.resumen_financiero) {
      const summary = result.resumen_financiero;
      const labels = sheet.addRow(['Facturado', 'Compras registradas', 'Entradas de caja', 'Salidas de caja', 'Neto de caja']);
      labels.font = { bold: true, color: { argb: 'FF312E81' } };
      const totals = sheet.addRow([summary.facturado, summary.compras_registradas, summary.entradas_caja, summary.salidas_caja, summary.neto_caja]);
      totals.font = { bold: true };
      totals.eachCell((cell) => { cell.numFmt = '#,##0.00'; });
    }
    const header = sheet.addRow(result.columns.map((c) => c.header));
    header.height = 28;
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    result.data.forEach((row, index) => {
      const excelRow = sheet.addRow(result.columns.map((column) => excelValue(row[column.accessor], column.accessor)));
      if (index % 2 === 1) excelRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
      excelRow.eachCell((cell) => { cell.alignment = { vertical: 'top', wrapText: true }; });
    });
    result.columns.forEach((column, index) => {
      const values = result.data.slice(0, 200).map((row) => String(excelValue(row[column.accessor], column.accessor)).length);
      sheet.getColumn(index + 1).width = Math.min(Math.max(column.header.length + 2, ...values.map((length) => length + 2), 14), 48);
      if (numericColumn(column.accessor)) sheet.getColumn(index + 1).numFmt = integerColumn(column.accessor) ? '#,##0' : '#,##0.00';
    });
    sheet.views = [{ state: 'frozen', ySplit: header.number }];
    if (result.columns.length) sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: result.columns.length } };
    sheet.pageSetup = { orientation: result.columns.length > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.tipo}.xlsx"`);
    res.send(Buffer.from(await book.xlsx.writeBuffer()));
  } catch (error) { handleError(res, error); }
};
export const getReportOptions = async (req, res) => {
  try {
    const [clientes, equipos, repuestos, proveedores, tecnicos] = await Promise.all([
      prisma.clientes.findMany({ select: { id_cliente: true, nombre: true }, orderBy: { nombre: 'asc' } }),
      prisma.equipos.findMany({ select: { id_equipo: true, tipo: true, marca: true, modelo: true, cliente: { select: { nombre: true } } }, orderBy: { id_equipo: 'desc' } }),
      prisma.repuestos.findMany({ select: { id_repuesto: true, nombre: true }, orderBy: { nombre: 'asc' } }),
      prisma.proveedores.findMany({ select: { id_proveedor: true, nombre: true }, orderBy: { nombre: 'asc' } }),
      prisma.tecnicos.findMany({ select: { id_tecnico: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    ]);
    res.json({ data: { clientes, equipos: equipos.map((e) => ({ id_equipo: e.id_equipo, nombre: `#${e.id_equipo} ${[e.tipo, e.marca, e.modelo].filter(Boolean).join(' ')} · ${e.cliente.nombre}` })), repuestos, proveedores, tecnicos } });
  } catch (error) { handleError(res, error); }
};
