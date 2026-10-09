import { Router } from 'express';
import prisma from '../../../app/prismaClient.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { withAuditUser } from '../../../utils/auditContext.js';
import { notifyJefeTecnico, notifyRoles, notifyTecnico } from '../../../services/notifications.js';
import { parsePositiveId } from '../../../utils/domainValidation.js';

const router = Router();
router.use(authMiddleware);

const completedOrders = { OR: [{ estado: { in: ['FINALIZADO', 'ENTREGADO'] } }, { calidad_estado: 'RECHAZADO' }] };
const completedDiagnoses = { estado_del_diagnostico: { in: ['COMPLETADO', 'DIAGNOSTICADO'] } };
const reviewableOrders = { estado: 'FINALIZADO', calidad_estado: { in: ['PENDIENTE', 'NO_REQUERIDO'] }, facturas: { none: {} } };
const equipmentSearch = (search) => ({ OR: ['tipo', 'marca', 'modelo', 'numero_serie'].map((field) => ({ [field]: { contains: search, mode: 'insensitive' } })).concat([{ cliente: { nombre: { contains: search, mode: 'insensitive' } } }]) });
const listQuery = (req, diagnostic) => {
  const page = Math.max(1, Math.min(100000, parseInt(req.query.page, 10) || 1));
  const search = String(req.query.search || '').trim().slice(0, 150);
  const filters = [diagnostic && req.query.vista !== 'pendientes'
    ? { OR: [completedDiagnoses, { calidad_estado: 'RECHAZADO' }] }
    : diagnostic ? completedDiagnoses : completedOrders];
  if (req.query.vista === 'pendientes') filters.push(diagnostic ? { calidad_estado: 'PENDIENTE' } : reviewableOrders);
  if (search) filters.push({ OR: [diagnostic ? { equipo: equipmentSearch(search) } : { diagnostico: { equipo: equipmentSearch(search) } },
    ...(parsePositiveId(search) ? [{ [diagnostic ? 'id_diagnostico' : 'id_orden']: parsePositiveId(search) }] : [])] });
  return { where: { AND: filters }, page, skip: (page - 1) * 20, take: 20 };
};

router.get('/resumen', requirePermission(PERMISSIONS.CALIDAD_VER), async (_req, res, next) => {
  try {
    const [diagnosticos_pendientes, ordenes_pendientes, diagnosticos_revisados, ordenes_revisadas] = await Promise.all([
      prisma.diagnosticos.count({ where: { ...completedDiagnoses, calidad_estado: 'PENDIENTE' } }),
      prisma.ordenes.count({ where: reviewableOrders }),
      prisma.diagnosticos.count({ where: { calidad_estado: { in: ['APROBADO', 'RECHAZADO'] } } }),
      prisma.ordenes.count({ where: { ...completedOrders, revisiones_calidad: { some: {} } } }),
    ]);
    res.json({ data: { diagnosticos_pendientes, ordenes_pendientes, revisados: diagnosticos_revisados + ordenes_revisadas } });
  } catch (error) { next(error); }
});

router.get('/diagnosticos', requirePermission(PERMISSIONS.CALIDAD_VER), async (req, res, next) => {
  try {
    const query = listQuery(req, true);
    const [total, diagnosticos] = await Promise.all([prisma.diagnosticos.count({ where: query.where }), prisma.diagnosticos.findMany({
      where: query.where,
      select: { id_diagnostico: true, diagnostico_real: true, solucion_propuesta: true, fecha_completado: true, calidad_estado: true,
        tecnico: { select: { id_tecnico: true, nombre: true, usuario_id: true } },
        equipo: { select: { tipo: true, marca: true, modelo: true, numero_serie: true, cliente: { select: { nombre: true } } } },
        intervenciones: { where: { tipo: 'REVISION_CALIDAD' }, orderBy: { id_intervencion: 'desc' }, take: 3,
          select: { id_intervencion: true, motivo: true, datos_nuevos: true, fecha_hora: true, usuario: { select: { nombre_usuario: true } } } } },
      orderBy: { id_diagnostico: 'desc' }, skip: query.skip, take: query.take,
    })]);
    res.json({ data: diagnosticos, meta: { total, page: query.page, hasNextPage: query.page * 20 < total } });
  } catch (error) { next(error); }
});

router.post('/diagnosticos/:id/revision', requirePermission(PERMISSIONS.CALIDAD_REVISAR), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    const decision = String(req.body?.decision || '').toUpperCase();
    const observacion = String(req.body?.observacion || '').trim();
    const parte = String(req.body?.parte || '').trim();
    if (!id || !['SIN_ERRORES', 'CON_ERRORES'].includes(decision) || observacion.length < 10 || observacion.length > 4000
      || (decision === 'CON_ERRORES' && (parte.length < 3 || parte.length > 150))) return res.status(400).json({ error: 'Indique el resultado, la parte con error y una observación de 10 a 4000 caracteres' });
    const result = await withAuditUser(req.user, async (tx) => {
      await tx.$queryRaw`SELECT id_diagnostico FROM "Diagnosticos" WHERE id_diagnostico = ${id} FOR UPDATE`;
      const diagnostico = await tx.diagnosticos.findUnique({ where: { id_diagnostico: id }, include: { tecnico: { select: { usuario_id: true, nombre: true } } } });
      if (!diagnostico) throw Object.assign(new Error('Diagnóstico no encontrado'), { statusCode: 404 });
      if (!['COMPLETADO', 'DIAGNOSTICADO'].includes(diagnostico.estado_del_diagnostico)) throw Object.assign(new Error('El diagnóstico aún no está completado'), { statusCode: 409 });
      if (diagnostico.calidad_estado !== 'PENDIENTE') throw Object.assign(new Error('Este diagnóstico ya fue revisado; espere una nueva versión técnica'), { statusCode: 409 });
      const revision = await tx.intervencionesTecnicas.create({ data: { diagnostico_id: id, tipo: 'REVISION_CALIDAD', motivo: observacion,
        usuario_id: req.user.id, datos_anteriores: {}, datos_nuevos: { decision, parte: parte || null, observacion, tecnico_id: diagnostico.tecnico_id, tecnico_nombre: diagnostico.tecnico?.nombre || null } } });
      await tx.diagnosticos.update({ where: { id_diagnostico: id }, data: decision === 'SIN_ERRORES'
        ? { calidad_estado: 'APROBADO' }
        : { calidad_estado: 'RECHAZADO', estado_del_diagnostico: 'EN_REVISION', fecha_completado: null } });
      return { revision, tecnico: diagnostico.tecnico };
    });
    if (decision === 'CON_ERRORES') {
      await notifyTecnico(result.tecnico, { type: 'calidad_diagnostico_error', title: 'Error detectado en diagnóstico', message: `Calidad detectó un error en ${parte} del diagnóstico #${id}: ${observacion}`, entity: { kind: 'diagnostico', id } });
      await notifyJefeTecnico({ type: 'calidad_diagnostico_error', title: 'Error en diagnóstico', message: `Diagnóstico #${id}, técnico ${result.tecnico?.nombre || 'sin asignar'}: ${parte}.`, entity: { kind: 'diagnostico', id } });
    } else {
      await notifyRoles(['ServicioCliente', 'Secretaria'], { type: 'calidad_diagnostico_aprobada', title: 'Diagnóstico aprobado por Calidad', message: `El diagnóstico #${id} está listo para contactar al cliente.`, entity: { kind: 'diagnostico', id } });
    }
    res.status(201).json({ data: result.revision });
  } catch (error) { res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo guardar la revisión' }); }
});

// Consulta de órdenes y revisiones independientes de control de calidad.
router.get('/ordenes', requirePermission(PERMISSIONS.CALIDAD_VER), async (req, res, next) => {
  try {
    const query = listQuery(req, false);
    const [total, ordenes] = await Promise.all([prisma.ordenes.count({ where: query.where }), prisma.ordenes.findMany({
      where: query.where,
      select: {
        id_orden: true, estado: true, fecha_finalizacion: true, resultado_final: true,
        observacion_final: true, pruebas_salida: true, enciende_salida: true,
        usa_corriente_ac_salida: true, calidad_estado: true, calidad_observacion: true, calidad_revisada_en: true, es_garantia: true,
        facturas: { select: { id_factura: true }, take: 1 },
        revisiones_calidad: { orderBy: { id_revision: 'desc' }, take: 5, select: { id_revision: true, decision: true, observacion: true, pruebas: true, fecha_revision: true, usuario: { select: { nombre_usuario: true } } } },
        tecnico: { select: { usuario_id: true, nombre: true } },
        diagnostico: { select: { equipo: { select: { tipo: true, marca: true, modelo: true, numero_serie: true } } } },
      },
      orderBy: { id_orden: 'desc' }, skip: query.skip, take: query.take,
    })]);
    res.json({ data: ordenes, meta: { total, page: query.page, hasNextPage: query.page * 20 < total } });
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
    if (decision === 'RECHAZADO' && (typeof pruebas.parte !== 'string' || pruebas.parte.trim().length < 3 || pruebas.parte.length > 150)) return res.status(400).json({ error: 'Indique la parte donde se detectó el error' });
    if (decision === 'APROBADO' && Object.values(pruebas).includes('FALLA')) return res.status(400).json({ error: 'No se puede aprobar una revisión con pruebas fallidas' });
    const result = await withAuditUser(req.user, async (tx) => {
      await tx.$queryRaw`SELECT id_orden FROM "Ordenes" WHERE id_orden = ${id} FOR UPDATE`;
      const orden = await tx.ordenes.findUnique({ where: { id_orden: id }, include: { facturas: true, tecnico: { select: { usuario_id: true } } } });
      if (!orden) throw Object.assign(new Error('Orden no encontrada'), { statusCode: 404 });
      if (orden.estado !== 'FINALIZADO' || !['PENDIENTE', 'NO_REQUERIDO'].includes(orden.calidad_estado) || orden.facturas.length) throw Object.assign(new Error('Solo se revisan órdenes finalizadas, pendientes de calidad y sin factura'), { statusCode: 409 });
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
    if (decision === 'APROBADO') await notifyRoles(result.orden.es_garantia ? ['Contabilidad', 'Reclamos', 'Garantias'] : ['Contabilidad', 'ServicioCliente', 'Reclamos', 'Garantias'], {
      type: 'calidad_aprobada', title: 'Calidad aprobada', message: `La orden #${id} superó control de calidad${result.orden.es_garantia ? ' y quedó sin cobro' : ''}.`, entity: { kind: 'orden', id },
    });
    else {
      await notifyJefeTecnico({ type: 'calidad_rechazada', title: 'Corrección necesaria', message: `La orden #${id} fue devuelta por calidad. Error en ${pruebas.parte}: ${observacion}`, entity: { kind: 'orden', id } });
      await notifyTecnico(result.tecnico, { type: 'calidad_rechazada', title: 'Corrección necesaria', message: `Revise la orden #${id}. Error en ${pruebas.parte}: ${observacion}`, entity: { kind: 'orden', id } });
    }
    res.json({ data: result.orden });
  } catch (error) { res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo registrar la revisión de calidad' }); }
});

export default router;
