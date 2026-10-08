import { Router } from 'express';
import prisma from '../../../app/prismaClient.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { withAuditUser } from '../../../utils/auditContext.js';
import { notifyJefeTecnico, notifyRoles, notifyTecnico } from '../../../services/notifications.js';
import { parsePositiveId } from '../../../utils/domainValidation.js';

const router = Router();
router.use(authMiddleware);

// Consulta de órdenes y revisiones independientes de control de calidad.
router.get('/ordenes', requirePermission(PERMISSIONS.CALIDAD_VER), async (_req, res, next) => {
  try {
    const ordenes = await prisma.ordenes.findMany({
      where: { OR: [{ estado: { in: ['FINALIZADO', 'ENTREGADO'] } }, { calidad_estado: 'RECHAZADO' }] },
      select: {
        id_orden: true, estado: true, fecha_finalizacion: true, resultado_final: true,
        observacion_final: true, pruebas_salida: true, enciende_salida: true,
        usa_corriente_ac_salida: true, calidad_estado: true, calidad_observacion: true, calidad_revisada_en: true, es_garantia: true,
        revisiones_calidad: { orderBy: { id_revision: 'desc' }, take: 5, select: { id_revision: true, decision: true, observacion: true, pruebas: true, fecha_revision: true, usuario: { select: { nombre_usuario: true } } } },
        tecnico: { select: { usuario_id: true } },
        diagnostico: { select: { equipo: { select: { tipo: true, marca: true, modelo: true, numero_serie: true } } } },
      },
      orderBy: { id_orden: 'desc' }, take: 50,
    });
    res.json({ data: ordenes });
  } catch (error) { next(error); }
});

router.post('/ordenes/:id/revision', requirePermission(PERMISSIONS.CALIDAD_REVISAR), async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    const decision = String(req.body?.decision || '').toUpperCase();
    const observacion = String(req.body?.observacion || '').trim();
    const pruebas = req.body?.pruebas;
    if (!id || !['APROBADO', 'RECHAZADO'].includes(decision) || observacion.length < 10 || observacion.length > 4000) return res.status(400).json({ error: 'Registre decisión y observación de 10 a 4000 caracteres' });
    if (!pruebas || typeof pruebas !== 'object' || Array.isArray(pruebas) || !['CORRECTO', 'FALLA', 'NO_APLICA'].includes(pruebas.encendido)
      || !['CORRECTO', 'FALLA', 'NO_APLICA'].includes(pruebas.funcion_general)) return res.status(400).json({ error: 'Registre pruebas independientes de encendido y funcionamiento' });
    if (decision === 'APROBADO' && Object.values(pruebas).includes('FALLA')) return res.status(400).json({ error: 'No se puede aprobar una revisión con pruebas fallidas' });
    const result = await withAuditUser(req.user, async (tx) => {
      await tx.$queryRaw`SELECT id_orden FROM "Ordenes" WHERE id_orden = ${id} FOR UPDATE`;
      const orden = await tx.ordenes.findUnique({ where: { id_orden: id }, include: { facturas: true, tecnico: { select: { usuario_id: true } } } });
      if (!orden) throw Object.assign(new Error('Orden no encontrada'), { statusCode: 404 });
      if (orden.estado !== 'FINALIZADO' || orden.calidad_estado !== 'PENDIENTE' || orden.facturas.length) throw Object.assign(new Error('Solo se revisan órdenes finalizadas, pendientes de calidad y sin factura'), { statusCode: 409 });
      await tx.revisionesCalidad.create({ data: { orden_id: id, usuario_id: req.user.id, decision, observacion, pruebas } });
      const actualizado = await tx.ordenes.update({ where: { id_orden: id }, data: {
        calidad_estado: decision, calidad_observacion: observacion, calidad_revisada_en: new Date(),
        ...(decision === 'RECHAZADO' ? { estado: 'EN_REPARACION', fecha_finalizacion: null, fecha_cierre: null } : {}),
      } });
      if (decision === 'APROBADO' && orden.es_garantia) {
        await tx.facturas.create({ data: {
          orden_id: id, diagnostico_id: orden.diagnostico_id, monto_repuestos: 0, mano_obra: 0,
          monto_diagnostico: 0, subtotal: 0, impuestos: 0, total: 0, metodo_pago: 'GARANTIA',
        } });
      }
      return { orden: actualizado, tecnico: orden.tecnico };
    });
    if (decision === 'APROBADO') await notifyRoles(['Contabilidad', 'Recepcion', 'Reclamos', 'Garantias'], {
      type: 'calidad_aprobada', title: 'Calidad aprobada', message: `La orden #${id} superó control de calidad${result.orden.es_garantia ? ' y quedó sin cobro' : ''}.`, entity: { kind: 'orden', id },
    });
    else {
      await notifyJefeTecnico({ type: 'calidad_rechazada', title: 'Corrección necesaria', message: `La orden #${id} fue devuelta por calidad.`, entity: { kind: 'orden', id } });
      await notifyTecnico(result.tecnico, { type: 'calidad_rechazada', title: 'Corrección necesaria', message: `Revise la orden #${id}.`, entity: { kind: 'orden', id } });
    }
    res.json({ data: result.orden });
  } catch (error) { res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo registrar la revisión de calidad' }); }
});

export default router;
