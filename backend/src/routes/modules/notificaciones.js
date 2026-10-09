import { Router } from 'express';
import authMiddleware from '../../middlewares/authMiddleware.js';
import { Prisma } from '@prisma/client';
import prisma from '../../app/prismaClient.js';
import { notificationRole } from '../../services/notifications.js';

const router = Router();
router.use(authMiddleware);
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/', async (req, res) => {
  const role = notificationRole(req.user.rol);
  // Los avisos históricos sin rol pertenecían exclusivamente a Secretaría.
  // Un cambio de rol no da acceso a los avisos del rol anterior.
  // El jefe solo ve avisos que requieren asignar o tomar una decisión.
  const actionableJefe = Prisma.sql`(${role} <> 'tecnicojefe' OR
    (n.contenido->>'type' = 'diagnostico_creado' AND EXISTS (
      SELECT 1 FROM "Diagnosticos" d
      WHERE d.id_diagnostico::text = (n.contenido #>> '{entity,id}')
        AND d.tecnico_id IS NULL AND d.estado_del_diagnostico IN ('PENDIENTE', 'INGRESADO', 'ASIGNADO', 'EN_REVISION')
    )) OR
    (n.contenido->>'type' = 'orden_creada' AND EXISTS (
      SELECT 1 FROM "Ordenes" o
      WHERE o.id_orden::text = (n.contenido #>> '{entity,id}')
        AND o.tecnico_id IS NULL AND o.estado NOT IN ('FINALIZADO', 'ENTREGADO', 'CANCELADO', 'IRREPARABLE')
    )) OR
    (n.contenido->>'type' = 'calidad_rechazada' AND EXISTS (
      SELECT 1 FROM "Ordenes" o
      WHERE o.id_orden::text = (n.contenido #>> '{entity,id}')
        AND o.estado = 'EN_REPARACION' AND o.calidad_estado = 'RECHAZADO'
    )) OR
    (n.contenido->>'type' = 'repuesto_solicitado' AND EXISTS (
      SELECT 1 FROM "Ordenes_Repuestos" p JOIN "Ordenes" o ON o.id_orden = p.orden_id
      WHERE ((n.contenido #>> '{entity,kind}') = 'repuesto' AND p.id_detalle_repuesto::text = (n.contenido #>> '{entity,id}')
        OR (n.contenido #>> '{entity,kind}') = 'orden' AND p.orden_id::text = (n.contenido #>> '{entity,id}'))
        AND p.estado_aprobacion = 'PENDIENTE' AND p.estado_entrega <> 'ENTREGADO'
        AND o.estado NOT IN ('FINALIZADO', 'ENTREGADO', 'CANCELADO', 'IRREPARABLE')
    )) OR
    (n.contenido->>'type' = 'orden_irreparable_pendiente' AND EXISTS (
      SELECT 1 FROM "Ordenes" o
      WHERE o.id_orden::text = (n.contenido #>> '{entity,id}')
        AND o.estado = 'IRREPARABLE' AND o.irreparable_estado = 'PENDIENTE'
    ))
  )`;
  const actionableServicio = Prisma.sql`(${role} <> 'serviciocliente' OR
    (n.contenido->>'type' = 'diagnostico_completado' AND EXISTS (
      SELECT 1 FROM "Diagnosticos" d WHERE d.id_diagnostico::text = (n.contenido #>> '{entity,id}')
        AND d.estado_del_diagnostico IN ('COMPLETADO', 'DIAGNOSTICADO')
        AND NOT EXISTS (SELECT 1 FROM "Ordenes" o WHERE o.diagnostico_id = d.id_diagnostico)
        AND NOT EXISTS (SELECT 1 FROM "Facturas" f WHERE f.diagnostico_id = d.id_diagnostico)
    )) OR
    (n.contenido->>'type' = 'calidad_aprobada' AND EXISTS (
      SELECT 1 FROM "Ordenes" o WHERE o.id_orden::text = (n.contenido #>> '{entity,id}')
        AND o.estado = 'FINALIZADO' AND o.calidad_estado = 'APROBADO' AND o.es_garantia = false
        AND NOT EXISTS (SELECT 1 FROM "Facturas" f WHERE f.orden_id = o.id_orden)
    )) OR
    (n.contenido->>'type' = 'irreparable_confirmado' AND EXISTS (
      SELECT 1 FROM "Ordenes" o WHERE o.id_orden::text = (n.contenido #>> '{entity,id}')
        AND o.estado = 'IRREPARABLE' AND o.irreparable_estado = 'APROBADO'
        AND NOT EXISTS (SELECT 1 FROM "Facturas" f WHERE f.orden_id = o.id_orden)
    ))
  )`;
  const [rows, counts] = await prisma.$transaction([
    prisma.$queryRaw`SELECT n.contenido FROM "Notificaciones" n
      WHERE n.usuario_id = ${req.user.id} AND n.leida_en IS NULL
        AND COALESCE(n.contenido->>'destinatario_rol', 'secretaria') = ${role}
        AND ${actionableJefe} AND ${actionableServicio}
      ORDER BY n.fecha_hora DESC, n.id DESC LIMIT 25`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "Notificaciones" n
      WHERE n.usuario_id = ${req.user.id} AND n.leida_en IS NULL
        AND COALESCE(n.contenido->>'destinatario_rol', 'secretaria') = ${role}
        AND ${actionableJefe} AND ${actionableServicio}`,
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  res.json({ data: rows.map((row) => row.contenido), total: counts[0].total });
});
router.patch('/leidas', async (req, res) => {
  const ids = req.body.ids;
  if (!Array.isArray(ids) || ids.length > 25 || ids.some((id) => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return res.status(400).json({ error: 'Avisos inválidos' });
  }
  if (!ids.length) return res.json({ data: { leidas: 0 } });
  const role = notificationRole(req.user.rol);
  const count = await prisma.$executeRaw`UPDATE "Notificaciones" SET leida_en = now()
    WHERE usuario_id = ${req.user.id} AND leida_en IS NULL AND id::text IN (${Prisma.join(ids)})
      AND COALESCE(contenido->>'destinatario_rol', 'secretaria') = ${role}`;
  res.json({ data: { leidas: count } });
});
export default router;
