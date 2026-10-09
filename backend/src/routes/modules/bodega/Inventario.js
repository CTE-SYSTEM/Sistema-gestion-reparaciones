import { Router } from 'express';
import prisma from '../../../app/prismaClient.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { withAuditUser } from '../../../utils/auditContext.js';
import { parsePositiveId } from '../../../utils/domainValidation.js';
import { parsePagination, buildPaginationMeta } from '../../../utils/pagination.js';

const router = Router();
router.use(authMiddleware, requirePermission(PERMISSIONS.REPUESTOS_TRAZAR));
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const respond = (res, error) => res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo procesar el inventario' });

const sumByPart = (rows) => new Map(rows.map((row) => [row.repuesto_id, Number(row._sum?.cantidad_usada || row._sum?.cantidad || 0)]));

const quantities = async (db, ids) => {
  if (!ids.length) return { delivered: new Map(), reserved: new Map(), quarantine: new Map() };
  const [delivered, reserved, quarantine] = await Promise.all([
    db.ordenes_Repuestos.groupBy({ by: ['repuesto_id'], where: { repuesto_id: { in: ids }, estado_aprobacion: 'APROBADO', estado_entrega: 'ENTREGADO', orden: { facturas: { none: {} } } }, _sum: { cantidad_usada: true } }),
    db.ordenes_Repuestos.groupBy({ by: ['repuesto_id'], where: { repuesto_id: { in: ids }, estado_aprobacion: 'APROBADO', estado_entrega: 'PENDIENTE', orden: { estado: { notIn: ['CANCELADO', 'ENTREGADO'] } } }, _sum: { cantidad_usada: true } }),
    db.devolucionesProveedor.groupBy({ by: ['repuesto_id'], where: { repuesto_id: { in: ids }, origen: 'BODEGA', estado: 'CUARENTENA' }, _sum: { cantidad: true } }),
  ]);
  return { delivered: sumByPart(delivered), reserved: sumByPart(reserved), quarantine: sumByPart(quarantine) };
};

const inventoryRow = (part, q) => {
  const stock = Number(part.stock_actual || 0);
  const enTaller = q.delivered.get(part.id_repuesto) || 0;
  const reservado = q.reserved.get(part.id_repuesto) || 0;
  const cuarentena = q.quarantine.get(part.id_repuesto) || 0;
  return { ...part, stock_registrado: stock, en_taller_sin_facturar: enTaller,
    fisico_bodega: Math.max(0, stock - enTaller), reservado, cuarentena,
    disponible: Math.max(0, stock - enTaller - reservado - cuarentena) };
};

router.get('/', async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = String(req.query.search || '').trim().slice(0, 100);
    const where = { activo: true, descontinuada: false, ...(search ? { OR: [
      { nombre: { contains: search, mode: 'insensitive' } },
      { descripcion: { contains: search, mode: 'insensitive' } },
      { ubicacion_fisica: { contains: search, mode: 'insensitive' } },
      { proveedor: { nombre: { contains: search, mode: 'insensitive' } } },
    ] } : {}) };
    const [parts, total] = await Promise.all([
      prisma.repuestos.findMany({ where, include: { proveedor: { select: { nombre: true } }, categoria: { select: { nombre_tipo: true } } }, orderBy: [{ nombre: 'asc' }, { id_repuesto: 'asc' }], skip: offset, take: pageSize }),
      prisma.repuestos.count({ where }),
    ]);
    const q = await quantities(prisma, parts.map((part) => part.id_repuesto));
    res.json({ data: parts.map((part) => inventoryRow(part, q)), meta: buildPaginationMeta({ page, pageSize, total }) });
  } catch (error) { respond(res, error); }
});

router.get('/devoluciones', async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const where = req.query.repuesto_id ? { repuesto_id: parsePositiveId(req.query.repuesto_id) || -1 } : {};
    const [data, total] = await Promise.all([
      prisma.devolucionesProveedor.findMany({ where, include: { repuesto: { select: { nombre: true } }, compra: { include: { proveedor: { select: { nombre: true } } } }, usuario: { select: { nombre_usuario: true } } }, orderBy: { id_devolucion: 'desc' }, skip: offset, take: pageSize }),
      prisma.devolucionesProveedor.count({ where }),
    ]);
    res.json({ data, meta: buildPaginationMeta({ page, pageSize, total }) });
  } catch (error) { respond(res, error); }
});

router.post('/devoluciones', requirePermission(PERMISSIONS.REPUESTOS_GESTIONAR), async (req, res) => {
  try {
    const compraId = parsePositiveId(req.body?.compra_id);
    const reclamoId = req.body?.reclamo_id ? parsePositiveId(req.body.reclamo_id) : null;
    const cantidad = Number(req.body?.cantidad);
    const origen = String(req.body?.origen || 'BODEGA').toUpperCase();
    const motivo = String(req.body?.motivo || '').trim();
    if (!compraId || !Number.isInteger(cantidad) || cantidad < 1 || !['BODEGA', 'RECLAMO'].includes(origen) || motivo.length < 10 || motivo.length > 2000) fail(400, 'Indique compra, origen, cantidad y motivo de al menos 10 caracteres');
    if (origen === 'RECLAMO' && !reclamoId) fail(400, 'Seleccione el reclamo que devolvió la pieza');
    const data = await withAuditUser(req.user, async (tx) => {
      const compra = await tx.compras.findUnique({ where: { id_compra: compraId } });
      if (!compra) fail(404, 'Compra no encontrada');
      await tx.$queryRaw`SELECT id_repuesto FROM "Repuestos" WHERE id_repuesto = ${compra.repuesto_id} FOR UPDATE`;
      if (origen === 'RECLAMO') {
        const reclamo = await tx.reclamos.findUnique({ where: { id_reclamo: reclamoId }, select: { orden_original_id: true } });
        if (!reclamo) fail(404, 'Reclamo no encontrado');
        const [delivered, marked] = await Promise.all([
          tx.ordenes_Repuestos.aggregate({ where: { orden_id: reclamo.orden_original_id, compra_id: compraId, estado_entrega: 'ENTREGADO' }, _sum: { cantidad_usada: true } }),
          tx.devolucionesProveedor.aggregate({ where: { reclamo_id: reclamoId, compra_id: compraId, origen: 'RECLAMO' }, _sum: { cantidad: true } }),
        ]);
        if (Number(delivered._sum.cantidad_usada || 0) - Number(marked._sum.cantidad || 0) < cantidad) fail(409, 'El reclamo no tiene esa cantidad de piezas entregadas de la compra');
      } else {
        const [part, q, used, marked] = await Promise.all([
          tx.repuestos.findUnique({ where: { id_repuesto: compra.repuesto_id } }),
          quantities(tx, [compra.repuesto_id]),
          tx.ordenes_Repuestos.aggregate({ where: { compra_id: compraId, estado_entrega: 'ENTREGADO' }, _sum: { cantidad_usada: true } }),
          tx.devolucionesProveedor.aggregate({ where: { compra_id: compraId, origen: 'BODEGA' }, _sum: { cantidad: true } }),
        ]);
        if (inventoryRow(part, q).disponible < cantidad || Number(compra.cantidad || 0) - Number(used._sum.cantidad_usada || 0) - Number(marked._sum.cantidad || 0) < cantidad) fail(409, 'La compra no tiene esa cantidad disponible para apartar');
      }
      return tx.devolucionesProveedor.create({ data: { repuesto_id: compra.repuesto_id, compra_id: compraId, reclamo_id: reclamoId, usuario_id: req.user.id, cantidad, origen, motivo } });
    });
    res.status(201).json({ data });
  } catch (error) { respond(res, error); }
});

router.patch('/devoluciones/:id/devolver', requirePermission(PERMISSIONS.REPUESTOS_GESTIONAR), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) fail(400, 'Devolución no válida');
    const data = await withAuditUser(req.user, async (tx) => {
      const item = await tx.devolucionesProveedor.findUnique({ where: { id_devolucion: id } });
      if (!item) fail(404, 'Registro no encontrado');
      await tx.$queryRaw`SELECT id_repuesto FROM "Repuestos" WHERE id_repuesto = ${item.repuesto_id} FOR UPDATE`;
      if (item.estado !== 'CUARENTENA') fail(409, 'La pieza ya fue devuelta al proveedor');
      if (item.origen === 'BODEGA') {
        const updated = await tx.repuestos.updateMany({ where: { id_repuesto: item.repuesto_id, stock_actual: { gte: item.cantidad } }, data: { stock_actual: { decrement: item.cantidad } } });
        if (!updated.count) fail(409, 'El stock cambió y no alcanza para registrar la salida');
      }
      return tx.devolucionesProveedor.update({ where: { id_devolucion: id }, data: { estado: 'DEVUELTO', fecha_devolucion: new Date() } });
    });
    res.json({ data });
  } catch (error) { respond(res, error); }
});

export default router;
