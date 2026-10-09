import { Router } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../../../app/prismaClient.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { dateRange as validatedDateRange } from '../../../utils/adminFilters.js';

const router = Router();
router.use(authMiddleware, requirePermission(PERMISSIONS.REPUESTOS_TRAZAR));
const dateRange = (query) => {
  try { return validatedDateRange({ fecha_inicio: query.desde, fecha_fin: query.hasta }).where; }
  catch { return null; }
};

router.get('/resumen', async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 86400000);
    const [repuestos, comprasMes, entregasMes, pendientes, comprasRecientes] = await Promise.all([
      prisma.repuestos.findMany({ where: { activo: true, descontinuada: false }, select: { id_repuesto: true, nombre: true, stock_actual: true, stock_minimo: true, proveedor: { select: { nombre: true } } } }),
      prisma.compras.findMany({ where: { fecha_obtencion: { gte: since } }, select: { cantidad: true, costo_unitario: true } }),
      prisma.ordenes_Repuestos.count({ where: { estado_entrega: 'ENTREGADO', fecha_entrega: { gte: since } } }),
      prisma.ordenes_Repuestos.count({ where: { estado_aprobacion: 'APROBADO', estado_entrega: 'PENDIENTE' } }),
      prisma.compras.findMany({ take: 5, orderBy: { id_compra: 'desc' }, include: { proveedor: { select: { nombre: true } }, repuesto: { select: { nombre: true } } } }),
    ]);
    res.json({ data: {
      referencias: repuestos.length,
      unidades: repuestos.reduce((sum, row) => sum + Number(row.stock_actual || 0), 0),
      bajo_minimo: repuestos.filter((row) => Number(row.stock_actual || 0) <= Number(row.stock_minimo || 0)),
      entradas_30_dias: comprasMes.reduce((sum, row) => sum + Number(row.cantidad || 0), 0),
      costo_entradas_30_dias: comprasMes.reduce((sum, row) => sum + Number(row.cantidad || 0) * Number(row.costo_unitario || 0), 0),
      entregas_30_dias: entregasMes, pendientes, compras_recientes: comprasRecientes,
    } });
  } catch (error) { next(error); }
});

router.get('/reporte.xlsx', async (req, res, next) => {
  try {
    const range = dateRange(req.query);
    if (!range) return res.status(400).json({ error: 'Rango de fechas inválido' });
    const [compras, salidas] = await Promise.all([
      prisma.compras.findMany({ where: { fecha_obtencion: range }, orderBy: { id_compra: 'desc' },
        include: { proveedor: { select: { nombre: true } }, repuesto: { select: { nombre: true } } } }),
      prisma.ordenes_Repuestos.findMany({ where: { estado_entrega: 'ENTREGADO', fecha_entrega: range }, orderBy: { id_detalle_repuesto: 'desc' },
        include: { repuesto: { select: { nombre: true } }, compra: { select: { id_compra: true, costo_unitario: true, proveedor: { select: { nombre: true } } } },
          orden: { select: { id_orden: true, diagnostico: { select: { equipo: { select: { tipo: true, marca: true, modelo: true, numero_serie: true, cliente: { select: { nombre: true } } } } } } } } } }),
    ]);
    const book = new ExcelJS.Workbook(); book.creator = 'SGR';
    const addSheet = (name, headers, rows) => {
      const sheet = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
      sheet.mergeCells(1, 1, 1, headers.length);
      sheet.getCell(1, 1).value = `Bodega · ${name}`;
      sheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      sheet.getRow(1).height = 32;
      sheet.mergeCells(2, 1, 2, headers.length);
      sheet.getCell(2, 1).value = `Periodo: ${req.query.desde || 'inicio'} a ${req.query.hasta || 'hoy'} · ${rows.length} registros`;
      sheet.getRow(3).values = headers;
      sheet.getRow(3).eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; });
      rows.forEach((row, index) => { const current = sheet.addRow(row); if (index % 2) current.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; }); });
      sheet.columns.forEach((column) => { column.width = 22; });
      sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: headers.length } };
    };
    addSheet('Entradas', ['Fecha', 'Compra', 'Repuesto', 'Proveedor', 'Documento', 'Cantidad', 'Costo unitario', 'Total'],
      compras.map((c) => [c.fecha_obtencion || '', c.id_compra, c.repuesto?.nombre || '', c.proveedor?.nombre || '', c.documento || '', Number(c.cantidad || 0), Number(c.costo_unitario || 0), Number(c.cantidad || 0) * Number(c.costo_unitario || 0)]));
    addSheet('Salidas', ['Fecha', 'Orden', 'Equipo', 'Serie', 'Cliente', 'Repuesto', 'Cantidad', 'Compra', 'Proveedor', 'Costo unitario'],
      salidas.map((s) => { const e = s.orden?.diagnostico?.equipo; return [s.fecha_entrega || '', s.orden_id, [e?.tipo, e?.marca, e?.modelo].filter(Boolean).join(' '), e?.numero_serie || '', e?.cliente?.nombre || '', s.repuesto?.nombre || s.pieza_solicitada || '', Number(s.cantidad_usada || 0), s.compra?.id_compra || '', s.compra?.proveedor?.nombre || '', Number(s.compra?.costo_unitario || 0)]; }));
    const bytes = await book.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="bodega-entradas-salidas.xlsx"');
    return res.send(Buffer.from(bytes));
  } catch (error) { next(error); }
});

export default router;
