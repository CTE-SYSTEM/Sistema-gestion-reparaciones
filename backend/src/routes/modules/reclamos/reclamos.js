import { Router } from 'express';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { analizarReclamo, cerrarReclamo, crearReclamo, decidirCobertura, listarReclamos } from '../../../controllers/reclamos/reclamosController.js';
import prisma from '../../../app/prismaClient.js';

const router = Router();
router.use(authMiddleware);
router.get('/resumen', requirePermission(PERMISSIONS.RECLAMOS_VER), async (_req, res, next) => {
  try {
    const groups = await prisma.reclamos.groupBy({ by: ['estado'], _count: { _all: true } });
    res.json({ data: { total: groups.reduce((sum, row) => sum + row._count._all, 0),
      abiertos: groups.filter((row) => ['ABIERTO', 'ANALIZADO'].includes(row.estado)).reduce((sum, row) => sum + row._count._all, 0),
      reingresos: groups.find((row) => row.estado === 'EN_REINGRESO')?._count._all || 0,
      cerrados: groups.find((row) => row.estado === 'CERRADO')?._count._all || 0 } });
  } catch (error) { next(error); }
});
router.get('/clientes', requirePermission(PERMISSIONS.RECLAMOS_CREAR), async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 100);
    if (!search) return res.json({ data: [] });
    const data = await prisma.clientes.findMany({ where: { OR: [
      { nombre: { contains: search, mode: 'insensitive' } },
      { telefono: { contains: search, mode: 'insensitive' } },
    ] },
    select: { id_cliente: true, nombre: true, telefono: true }, orderBy: { nombre: 'asc' }, take: 20 });
    res.json({ data });
  } catch (error) { next(error); }
});
router.get('/clientes/:id/equipos', requirePermission(PERMISSIONS.RECLAMOS_CREAR), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Cliente inválido' });
    const data = await prisma.equipos.findMany({ where: { cliente_id: id },
    select: { id_equipo: true, tipo: true, marca: true, modelo: true, numero_serie: true }, orderBy: { id_equipo: 'desc' } });
    res.json({ data });
  } catch (error) { next(error); }
});
router.get('/equipos/:id/ordenes', requirePermission(PERMISSIONS.RECLAMOS_CREAR), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Equipo inválido' });
    const data = await prisma.ordenes.findMany({ where: { diagnostico: { equipo_id: id } },
      select: { id_orden: true, estado: true, fecha_ingreso: true, fecha_entrega: true, resultado_final: true, es_garantia: true,
        diagnostico: { select: { falla_reportada: true, diagnostico_real: true } },
        facturas: { select: { id_factura: true, fecha_emision: true, garantias: { select: { id_garantia: true, fecha_vencimiento: true } } } },
        reclamos_originales: { select: { id_reclamo: true, estado: true } },
      }, orderBy: [{ fecha_ingreso: 'asc' }, { id_orden: 'asc' }] });
    res.json({ data });
  } catch (error) { next(error); }
});
router.get('/', requirePermission(PERMISSIONS.RECLAMOS_VER), listarReclamos);
router.post('/', requirePermission(PERMISSIONS.RECLAMOS_CREAR), crearReclamo);
router.patch('/:id/analisis', requirePermission(PERMISSIONS.RECLAMOS_ANALIZAR), analizarReclamo);
router.patch('/:id/decision', requirePermission(PERMISSIONS.RECLAMOS_DECIDIR), decidirCobertura);
router.patch('/:id/cerrar', requirePermission(PERMISSIONS.RECLAMOS_ANALIZAR), cerrarReclamo);
export default router;
