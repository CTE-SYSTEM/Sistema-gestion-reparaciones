import { Router } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../../../app/prismaClient.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { REPORT_CATALOG, loadAdminReport } from '../../../services/adminReportsService.js';

const router = Router();
router.use(authMiddleware, requirePermission(PERMISSIONS.CONTABILIDAD_MOVIMIENTOS));
const month = (date) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Managua', month: 'numeric' }).format(new Date(date))) - 1;
const round = (value) => Math.round(value * 100) / 100;
const yearRange = (value) => {
  const year = Number(value || new Intl.DateTimeFormat('en-US', { timeZone: 'America/Managua', year: 'numeric' }).format(new Date()));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return { year, gte: new Date(`${year}-01-01T00:00:00-06:00`), lt: new Date(`${year + 1}-01-01T00:00:00-06:00`) };
};
const buildSummary = async (range) => {
  const [movimientos, compras, facturas, facturasDelPeriodo] = await Promise.all([
    prisma.movimientosContables.findMany({ where: { fecha_registro: { gte: range.gte, lt: range.lt } }, select: { tipo: true, monto: true, fecha_registro: true } }),
    prisma.compras.findMany({ where: { fecha_obtencion: { gte: range.gte, lt: range.lt } }, select: { cantidad: true, costo_unitario: true, fecha_obtencion: true, metodo_pago: true } }),
    prisma.facturas.findMany({ where: { fecha_emision: { gte: range.gte, lt: range.lt }, metodo_pago: { not: 'Pendiente' }, total: { gt: 0 } },
      select: { id_factura: true, fecha_emision: true, total: true, movimientos_contables: { where: { tipo: 'COBRO', motivo: 'Cobro registrado al emitir la factura' }, select: { id_movimiento: true }, take: 1 } } }),
    prisma.facturas.findMany({ where: { fecha_emision: { gte: range.gte, lt: range.lt } },
      select: { total: true, metodo_pago: true, movimientos_contables: { select: { tipo: true, monto: true, motivo: true } } } }),
  ]);
  const months = Array.from({ length: 12 }, (_, index) => ({ mes: index + 1, cobros: 0, otros_ingresos: 0, compras: 0, compras_pagadas: 0, devoluciones: 0, reclamos: 0, gastos_operativos: 0, ingresos: 0, egresos: 0, neto: 0 }));
  for (const row of movimientos) {
    const target = months[month(row.fecha_registro)];
    const value = Number(row.monto || 0);
    if (row.tipo === 'COBRO') target.cobros += value;
    else if (row.tipo === 'OTRO_INGRESO') target.otros_ingresos += value;
    else if (row.tipo === 'DEVOLUCION') target.devoluciones += value;
    else if (row.tipo === 'COSTO_RECLAMO') target.reclamos += value;
    else if (row.tipo === 'GASTO_OPERATIVO') target.gastos_operativos += value;
  }
  for (const row of facturas) if (!row.movimientos_contables.length) months[month(row.fecha_emision)].cobros += Number(row.total || 0);
  for (const row of compras) {
    const target = months[month(row.fecha_obtencion)];
    const amount = Number(row.cantidad || 0) * Number(row.costo_unitario || 0);
    target.compras += amount;
    if (['Efectivo', 'Transferencia', 'Tarjeta'].includes(row.metodo_pago)) target.compras_pagadas += amount;
  }
  for (const row of months) {
    for (const key of ['cobros', 'otros_ingresos', 'compras', 'compras_pagadas', 'devoluciones', 'reclamos', 'gastos_operativos']) row[key] = round(row[key]);
    row.ingresos = round(row.cobros + row.otros_ingresos);
    row.egresos = round(row.compras_pagadas + row.devoluciones + row.reclamos + row.gastos_operativos);
    row.neto = round(row.ingresos - row.egresos);
  }
  const pending = facturasDelPeriodo.reduce((sum, factura) => {
    const charged = factura.movimientos_contables.filter((m) => m.tipo === 'COBRO').reduce((n, m) => n + Number(m.monto), 0);
    const returned = factura.movimientos_contables.filter((m) => m.tipo === 'DEVOLUCION').reduce((n, m) => n + Number(m.monto), 0);
    const historical = factura.metodo_pago && factura.metodo_pago !== 'Pendiente'
      && !factura.movimientos_contables.some((m) => m.tipo === 'COBRO' && m.motivo === 'Cobro registrado al emitir la factura')
      ? Number(factura.total || 0) : 0;
    return sum + Math.max(0, Number(factura.total || 0) - charged - historical + returned);
  }, 0);
  const totals = { ingresos: round(months.reduce((sum, row) => sum + row.ingresos, 0)), egresos: round(months.reduce((sum, row) => sum + row.egresos, 0)), neto: round(months.reduce((sum, row) => sum + row.neto, 0)),
    facturado: round(facturasDelPeriodo.reduce((sum, row) => sum + Number(row.total || 0), 0)), por_cobrar: round(pending),
    compras_registradas: round(months.reduce((sum, row) => sum + row.compras, 0)),
    compras_pagadas: round(months.reduce((sum, row) => sum + row.compras_pagadas, 0)) };
  return { year: range.year, months, totals, method: 'El flujo suma cobros y otros ingresos; resta devoluciones, reclamos, gastos y compras con método de pago registrado. Las compras antiguas sin método se muestran aparte. Facturado no equivale a cobrado; el saldo por cobrar corresponde a las facturas emitidas en el año.' };
};

router.get('/', async (req, res, next) => {
  try { const range = yearRange(req.query.anio); if (!range) return res.status(400).json({ error: 'Año inválido' }); return res.json({ data: await buildSummary(range) }); }
  catch (error) { return next(error); }
});
router.get('/excel', async (req, res, next) => {
  try {
    const range = yearRange(req.query.anio); if (!range) return res.status(400).json({ error: 'Año inválido' });
    const data = await buildSummary(range);
    const book = new ExcelJS.Workbook(); book.creator = 'SGR';
    const sheet = book.addWorksheet('Flujo mensual', { views: [{ state: 'frozen', ySplit: 3 }] });
    sheet.mergeCells('A1:K1'); sheet.getCell('A1').value = `Contabilidad · Flujo de dinero ${data.year}`;
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }; sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; sheet.getRow(1).height = 32;
    sheet.mergeCells('A2:K2'); sheet.getCell('A2').value = data.method;
    sheet.getRow(3).values = ['Mes', 'Cobros', 'Otros ingresos', 'Compras registradas', 'Compras pagadas', 'Devoluciones', 'Reclamos', 'Gastos operativos', 'Ingresos registrados', 'Egresos registrados', 'Flujo neto registrado'];
    sheet.getRow(3).eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; });
    data.months.forEach((row, index) => { const current = sheet.addRow([row.mes, row.cobros, row.otros_ingresos, row.compras, row.compras_pagadas, row.devoluciones, row.reclamos, row.gastos_operativos, row.ingresos, row.egresos, row.neto]); if (index % 2) current.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; }); });
    sheet.addRow(['TOTAL', '', '', data.totals.compras_registradas, data.totals.compras_pagadas, '', '', '', data.totals.ingresos, data.totals.egresos, data.totals.neto]).font = { bold: true };
    sheet.columns.forEach((column) => { column.width = 20; });
    for (let row = 4; row <= 16; row += 1) for (let column = 2; column <= 11; column += 1) sheet.getRow(row).getCell(column).numFmt = '#,##0.00';
    const bytes = await book.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="contabilidad-${data.year}.xlsx"`);
    return res.send(Buffer.from(bytes));
  } catch (error) { return next(error); }
});
router.get('/reportes/catalogo', (_req, res) => res.json({ data: REPORT_CATALOG.filter((item) => item.categoria === 'Finanzas') }));
router.get('/reportes/:tipo', async (req, res, next) => {
  try {
    if (!REPORT_CATALOG.some((item) => item.id === req.params.tipo && item.categoria === 'Finanzas')) return res.status(404).json({ error: 'Reporte financiero no disponible' });
    return res.json(await loadAdminReport(req.params.tipo, req.query));
  } catch (error) { return next(error); }
});
export default router;
