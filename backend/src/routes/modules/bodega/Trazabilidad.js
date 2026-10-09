import { Router } from 'express';
import prisma from '../../../app/prismaClient.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { parsePositiveId } from '../../../utils/domainValidation.js';
import { buildPaginationMeta, parsePagination } from '../../../utils/pagination.js';
import { procesarRepuesto } from '../../../controllers/JefeTecnico/supervisionController.js';
import { stockDisponible } from '../../../services/Tecnico/stockDisponible.js';

const router = Router();
router.use(authMiddleware, requirePermission(PERMISSIONS.REPUESTOS_TRAZAR));

router.get('/solicitudes', async (req, res, next) => {
  try {
    const estado = String(req.query.estado || 'ACTIVAS').toUpperCase();
    if (!['ACTIVAS', 'POR_ENTREGAR', 'POR_APROBAR', 'SIN_EXISTENCIA', 'ENTREGADO', 'TODOS'].includes(estado)) return res.status(400).json({ error: 'Estado de solicitud inválido' });
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = String(req.query.search || '').trim().slice(0, 100);
    const numeric = parsePositiveId(search);
    const where = {
      ...(estado === 'TODOS' ? {} : estado === 'ENTREGADO' ? { estado_entrega: 'ENTREGADO' }
        : estado === 'SIN_EXISTENCIA' ? { estado_entrega: 'SIN_EXISTENCIA', estado_aprobacion: { in: ['PENDIENTE', 'APROBADO'] } }
          : estado === 'POR_ENTREGAR' ? { estado_entrega: 'PENDIENTE', estado_aprobacion: 'APROBADO' }
            : estado === 'POR_APROBAR' ? { estado_entrega: 'PENDIENTE', estado_aprobacion: 'PENDIENTE' }
              : { estado_entrega: { in: ['PENDIENTE', 'SIN_EXISTENCIA'] }, estado_aprobacion: { in: ['PENDIENTE', 'APROBADO'] } }),
      ...(search ? { OR: [
        { repuesto: { nombre: { contains: search, mode: 'insensitive' } } },
        { pieza_solicitada: { contains: search, mode: 'insensitive' } },
        { orden: { diagnostico: { equipo: { OR: [
          { tipo: { contains: search, mode: 'insensitive' } }, { marca: { contains: search, mode: 'insensitive' } },
          { modelo: { contains: search, mode: 'insensitive' } }, { numero_serie: { contains: search, mode: 'insensitive' } },
          { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
        ] } } } },
        ...(numeric ? [{ orden_id: numeric }, { id_detalle_repuesto: numeric }] : []),
      ] } : {}) };
    const [data, total] = await Promise.all([prisma.ordenes_Repuestos.findMany({
      where,
      include: {
        repuesto: { select: { id_repuesto: true, nombre: true, stock_actual: true } },
        compra: { include: { proveedor: { select: { nombre: true } } } },
        tecnico_solicitante: { select: { nombre: true } },
        usuario_entregador: { select: { nombre_persona: true, nombre_usuario: true } },
        orden: { select: { id_orden: true, estado: true, tecnico: { select: { nombre: true } }, diagnostico: { select: { equipo: { select: { tipo: true, marca: true, modelo: true, numero_serie: true, cliente: { select: { nombre: true } } } } } } } },
      },
      orderBy: { id_detalle_repuesto: 'desc' }, skip: offset, take: pageSize,
    }), prisma.ordenes_Repuestos.count({ where })]);
    const available = await Promise.all(data.map((row) => row.repuesto_id
      ? stockDisponible(prisma, row.repuesto_id, row.id_detalle_repuesto).catch(() => 0) : Promise.resolve(null)));
    res.json({ data: data.map((row, index) => ({ ...row, disponible_para_solicitud: available[index] })), meta: buildPaginationMeta({ page, pageSize, total }) });
  } catch (error) { next(error); }
});

router.get('/lotes', async (req, res, next) => {
  try {
    const repuestoId = parsePositiveId(req.query.repuesto_id);
    if (!repuestoId) return res.status(400).json({ error: 'Seleccione un repuesto' });
    const [compras, asignadas, defectuosas] = await Promise.all([
      prisma.compras.findMany({ where: { repuesto_id: repuestoId }, include: { proveedor: { select: { nombre: true } } }, orderBy: { id_compra: 'desc' } }),
      prisma.ordenes_Repuestos.groupBy({ by: ['compra_id'], where: { repuesto_id: repuestoId, compra_id: { not: null }, estado_entrega: 'ENTREGADO' }, _sum: { cantidad_usada: true } }),
      prisma.devolucionesProveedor.groupBy({ by: ['compra_id'], where: { repuesto_id: repuestoId, origen: 'BODEGA' }, _sum: { cantidad: true } }),
    ]);
    const usadas = new Map(asignadas.map((a) => [a.compra_id, Number(a._sum.cantidad_usada || 0)]));
    const apartadas = new Map(defectuosas.map((a) => [a.compra_id, Number(a._sum.cantidad || 0)]));
    res.json({ data: compras.map((compra) => ({
      id_compra: compra.id_compra, repuesto_id: compra.repuesto_id, proveedor: compra.proveedor?.nombre,
      documento: compra.documento, fecha_obtencion: compra.fecha_obtencion, cantidad: compra.cantidad,
      unidades_asignadas: usadas.get(compra.id_compra) || 0,
      unidades_defectuosas: apartadas.get(compra.id_compra) || 0,
      disponibles_identificadas: Math.max(0, Number(compra.cantidad || 0) - (usadas.get(compra.id_compra) || 0) - (apartadas.get(compra.id_compra) || 0)),
    })) });
  } catch (error) { next(error); }
});

router.patch('/solicitudes/:id/entregar', requirePermission(PERMISSIONS.REPUESTOS_ENTREGAR), (req, res, next) => {
  if (req.body?.compra_id != null && req.body.compra_id !== '' && !parsePositiveId(req.body.compra_id)) return res.status(400).json({ error: 'Seleccione una compra válida' });
  return procesarRepuesto('entregar')(req, res, next);
});
router.patch('/solicitudes/:id/sin-existencia', requirePermission(PERMISSIONS.REPUESTOS_ENTREGAR), procesarRepuesto('sin-existencia'));
router.patch('/solicitudes/:id/revisar-disponibilidad', requirePermission(PERMISSIONS.REPUESTOS_ENTREGAR), procesarRepuesto('revisar-disponibilidad'));

export default router;
