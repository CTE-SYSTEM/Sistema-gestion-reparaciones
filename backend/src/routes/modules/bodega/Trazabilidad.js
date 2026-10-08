import { Router } from 'express';
import prisma from '../../../app/prismaClient.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { parsePositiveId } from '../../../utils/domainValidation.js';
import { procesarRepuesto } from '../../../controllers/JefeTecnico/supervisionController.js';

const router = Router();
router.use(authMiddleware, requirePermission(PERMISSIONS.REPUESTOS_TRAZAR));

router.get('/solicitudes', async (req, res, next) => {
  try {
    const estado = String(req.query.estado || 'PENDIENTE').toUpperCase();
    const data = await prisma.ordenes_Repuestos.findMany({
      where: { estado_aprobacion: 'APROBADO', ...(estado === 'TODOS' ? {} : { estado_entrega: estado }) },
      include: {
        repuesto: { select: { id_repuesto: true, nombre: true, stock_actual: true } },
        compra: { include: { proveedor: { select: { nombre: true } } } },
        orden: { select: { id_orden: true, estado: true, diagnostico: { select: { equipo: { select: { tipo: true, marca: true, modelo: true } } } } } },
      },
      orderBy: { id_detalle_repuesto: 'desc' }, take: 100,
    });
    res.json({ data });
  } catch (error) { next(error); }
});

router.get('/lotes', async (req, res, next) => {
  try {
    const repuestoId = parsePositiveId(req.query.repuesto_id);
    if (!repuestoId) return res.status(400).json({ error: 'Seleccione un repuesto' });
    const [compras, asignadas] = await Promise.all([
      prisma.compras.findMany({ where: { repuesto_id: repuestoId }, include: { proveedor: { select: { nombre: true } } }, orderBy: { id_compra: 'desc' } }),
      prisma.ordenes_Repuestos.groupBy({ by: ['compra_id'], where: { repuesto_id: repuestoId, compra_id: { not: null }, estado_entrega: 'ENTREGADO' }, _sum: { cantidad_usada: true } }),
    ]);
    const usadas = new Map(asignadas.map((a) => [a.compra_id, Number(a._sum.cantidad_usada || 0)]));
    res.json({ data: compras.map((compra) => ({
      id_compra: compra.id_compra, repuesto_id: compra.repuesto_id, proveedor: compra.proveedor?.nombre,
      documento: compra.documento, fecha_obtencion: compra.fecha_obtencion, cantidad: compra.cantidad,
      unidades_asignadas: usadas.get(compra.id_compra) || 0,
      disponibles_identificadas: Math.max(0, Number(compra.cantidad || 0) - (usadas.get(compra.id_compra) || 0)),
    })) });
  } catch (error) { next(error); }
});

router.patch('/solicitudes/:id/entregar', requirePermission(PERMISSIONS.REPUESTOS_ENTREGAR), (req, res, next) => {
  if (!parsePositiveId(req.body?.compra_id)) return res.status(400).json({ error: 'Seleccione la compra de origen para trazar la pieza' });
  return procesarRepuesto('entregar')(req, res, next);
});

export default router;
