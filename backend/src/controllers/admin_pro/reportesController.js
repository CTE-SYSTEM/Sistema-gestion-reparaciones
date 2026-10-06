import ExcelJS from 'exceljs';
import prisma from '../../app/prismaClient.js';
import { loadAdminReport, REPORT_CATALOG } from '../../services/adminReportsService.js';
import { getBusinessSettings } from '../../services/adminSettingsService.js';

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
    const sheet = book.addWorksheet('Reporte');
    sheet.addRow([result.reporte.nombre]);
    sheet.addRow(['Generado', result.generado_en, 'Registros', result.total]);
    sheet.addRow(['Filtros', JSON.stringify(result.filtros)]);
    if (result.nota) sheet.addRow([result.nota]);
    const header = sheet.addRow(result.columns.map((c) => c.header));
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
    for (const row of result.data) sheet.addRow(result.columns.map((c) => {
      const value = row[c.accessor];
      if (typeof value === 'string' && !/^id_|referencia/.test(c.accessor) && /^-?\d+(\.\d+)?$/.test(value) && Number.isSafeInteger(Math.trunc(Number(value)))) return Number(value);
      return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
    }));
    result.columns.forEach((c, i) => { sheet.getColumn(i + 1).width = Math.min(Math.max(c.header.length + 3, 16), 35); });
    sheet.views = [{ state: 'frozen', ySplit: header.number }];
    if (result.columns.length) sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: result.columns.length } };
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
