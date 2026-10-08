import prisma from '../../app/prismaClient.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { parsePositiveId, parseNonNegativeMoney } from '../../utils/domainValidation.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';
import { notifyJefeTecnico, notifyRoles } from '../../services/notifications.js';

const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
const replyError = (res, error) => {
  if (!error.statusCode) console.error('Error al procesar reclamo:', error);
  return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo procesar el reclamo' });
};
const detail = {
  orden_original: { include: { diagnostico: { include: { equipo: { include: { cliente: true } } } }, repuestos_usados: { include: { repuesto: true, compra: { include: { proveedor: true } } } } } },
  garantia: true, orden_reingreso: true, compra: { include: { proveedor: true } },
  abierto_por: { select: { nombre_usuario: true } }, analizado_por: { select: { nombre_usuario: true } }, decidido_por: { select: { nombre_usuario: true } },
};

export const listarReclamos = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const estado = String(req.query.estado || '').trim().toUpperCase();
    const search = String(req.query.search || '').trim();
    const id = parsePositiveId(search);
    const where = {
      ...(estado && estado !== 'TODOS' ? { estado } : {}),
      ...(search ? { OR: [
        ...(id ? [{ id_reclamo: id }, { orden_original_id: id }] : []),
        { descripcion: { contains: search, mode: 'insensitive' } },
        { orden_original: { diagnostico: { equipo: { cliente: { nombre: { contains: search, mode: 'insensitive' } } } } } },
      ] } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.reclamos.findMany({ where, include: detail, orderBy: { id_reclamo: 'desc' }, skip: offset, take: pageSize }),
      prisma.reclamos.count({ where }),
    ]);
    res.json({ data, meta: buildPaginationMeta({ page, pageSize, total }) });
  } catch (error) { replyError(res, error); }
};

export const crearReclamo = async (req, res) => {
  try {
    const ordenId = parsePositiveId(req.body?.orden_original_id);
    const descripcion = String(req.body?.descripcion || '').trim();
    if (!ordenId || descripcion.length < 10 || descripcion.length > 4000) fail(400, 'Indique una orden entregada y describa el problema entre 10 y 4000 caracteres');
    const data = await withAuditUser(req.user, async (tx) => {
      await tx.$queryRaw`SELECT id_orden FROM "Ordenes" WHERE id_orden = ${ordenId} FOR UPDATE`;
      const orden = await tx.ordenes.findUnique({ where: { id_orden: ordenId }, include: { facturas: { include: { garantias: true } } } });
      if (!orden) fail(404, 'Orden original no encontrada');
      if (orden.estado !== 'ENTREGADO' || !orden.facturas.length) fail(409, 'El reclamo debe referirse a un equipo entregado y facturado');
      const duplicado = await tx.reclamos.findFirst({ where: { orden_original_id: ordenId, estado: { not: 'CERRADO' } }, select: { id_reclamo: true } });
      if (duplicado) fail(409, `La orden ya tiene el reclamo #${duplicado.id_reclamo} abierto`);
      return tx.reclamos.create({ data: {
        orden_original_id: ordenId, descripcion, abierto_por_id: req.user.id,
        garantia_id: orden.facturas[0]?.garantias[0]?.id_garantia || null,
      }, include: detail });
    });
    await notifyRoles(['Reclamos', 'Garantias'], { type: 'reclamo_creado', title: 'Nuevo reclamo', message: `Reclamo #${data.id_reclamo} de la orden #${ordenId} pendiente de análisis.`, entity: { kind: 'reclamo', id: data.id_reclamo } });
    res.status(201).json({ data });
  } catch (error) { replyError(res, error); }
};

export const analizarReclamo = async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    const responsable = String(req.body?.responsable_tipo || '').toUpperCase();
    const analisis = String(req.body?.analisis || '').trim();
    const compraId = req.body?.compra_id ? parsePositiveId(req.body.compra_id) : null;
    if (!id || !['TECNICO', 'CLIENTE', 'PROVEEDOR', 'EMPRESA', 'INDETERMINADO'].includes(responsable) || analisis.length < 10 || analisis.length > 4000) {
      fail(400, 'Indique responsable y análisis de 10 a 4000 caracteres');
    }
    if (responsable === 'PROVEEDOR' && !compraId) fail(400, 'Seleccione la compra de la pieza relacionada con el proveedor');
    const costo = req.body?.costo_estimado === '' || req.body?.costo_estimado == null ? null : parseNonNegativeMoney(req.body.costo_estimado, 'Costo estimado');
    const data = await withAuditUser(req.user, async (tx) => {
      await tx.$queryRaw`SELECT id_reclamo FROM "Reclamos" WHERE id_reclamo = ${id} FOR UPDATE`;
      const reclamo = await tx.reclamos.findUnique({ where: { id_reclamo: id }, include: { orden_original: { include: { repuestos_usados: true } } } });
      if (!reclamo) fail(404, 'Reclamo no encontrado');
      if (reclamo.cobertura !== 'PENDIENTE' || reclamo.estado === 'CERRADO') fail(409, 'El reclamo ya tiene una decisión');
      if (compraId) {
        const compra = await tx.compras.findUnique({ where: { id_compra: compraId } });
        if (!compra || !reclamo.orden_original.repuestos_usados.some((pieza) => pieza.compra_id === compraId && pieza.repuesto_id === compra.repuesto_id)) fail(409, 'La compra debe estar vinculada a una pieza entregada en la orden original');
      }
      return tx.reclamos.update({ where: { id_reclamo: id }, data: {
        estado: 'ANALIZADO', responsable_tipo: responsable, compra_id: responsable === 'PROVEEDOR' ? compraId : null,
        analisis, costo_estimado: costo, analizado_por_id: req.user.id, fecha_analisis: new Date(),
      }, include: detail });
    });
    await notifyRoles(['Garantias', 'Recepcion', ...(costo !== null ? ['Contabilidad'] : [])], {
      type: 'reclamo_analizado', title: 'Reclamo analizado',
      message: `El reclamo #${id} requiere decisión de cobertura${responsable === 'PROVEEDOR' ? ' y revisión del proveedor' : ''}.`,
      entity: { kind: 'reclamo', id },
    });
    if (responsable === 'PROVEEDOR') await notifyRoles(['Bodega'], {
      type: 'reclamo_proveedor', title: 'Revisar compra reclamada',
      message: `El reclamo #${id} relaciona la compra #${compraId} con una pieza defectuosa.`,
      entity: { kind: 'compra', id: compraId },
    });
    res.json({ data });
  } catch (error) { replyError(res, error); }
};

export const decidirCobertura = async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    const decision = String(req.body?.decision || '').toUpperCase();
    const motivo = String(req.body?.motivo || '').trim();
    if (!id || !['APROBADA', 'RECHAZADA'].includes(decision) || motivo.length < 10 || motivo.length > 4000) fail(400, 'Indique decisión y motivo de 10 a 4000 caracteres');
    const data = await withAuditUser(req.user, async (tx) => {
      await tx.$queryRaw`SELECT id_reclamo FROM "Reclamos" WHERE id_reclamo = ${id} FOR UPDATE`;
      const reclamo = await tx.reclamos.findUnique({ where: { id_reclamo: id }, include: { garantia: true, orden_original: { include: { diagnostico: true } } } });
      if (!reclamo) fail(404, 'Reclamo no encontrado');
      if (reclamo.estado !== 'ANALIZADO' || reclamo.cobertura !== 'PENDIENTE') fail(409, 'Analice el reclamo antes de decidir la cobertura');
      const now = new Date();
      if (decision === 'APROBADA' && (!reclamo.garantia?.fecha_inicio || !reclamo.garantia?.fecha_vencimiento
        || now < reclamo.garantia.fecha_inicio || now > reclamo.garantia.fecha_vencimiento)) fail(409, 'La garantía debe estar vigente para aprobar un reingreso cubierto');
      let reingresoId = null;
      if (decision === 'APROBADA') {
        const equipoId = reclamo.orden_original.diagnostico.equipo_id;
        const activa = await tx.ordenes.findFirst({ where: { diagnostico: { equipo_id: equipoId }, estado: { notIn: ['ENTREGADO', 'CANCELADO'] } }, select: { id_orden: true } });
        if (activa) fail(409, `El equipo ya tiene la orden #${activa.id_orden} activa`);
        const diagnostico = await tx.diagnosticos.create({ data: {
          equipo_id: equipoId, origen_directo: true, falla_reportada: `Reclamo #${id}: ${reclamo.descripcion}`,
          diagnostico_real: 'Reingreso por garantía; pendiente de revisión técnica',
          estado_del_diagnostico: 'COMPLETADO', estado_contacto: 'APROBADO', Estado_aprobacion: 'Aprobado',
          presupuesto_estimado: 0, fecha_completado: now, fecha_respuesta_cliente: now,
        } });
        const orden = await tx.ordenes.create({ data: {
          diagnostico_id: diagnostico.id_diagnostico, estado: 'PENDIENTE', prioridad: 'Alta',
          monto_autorizado: 0, fecha_aprobacion_cliente: now, es_garantia: true,
        } });
        reingresoId = orden.id_orden;
      }
      return tx.reclamos.update({ where: { id_reclamo: id }, data: {
        cobertura: decision, motivo_cobertura: motivo, decidido_por_id: req.user.id, fecha_decision: now,
        orden_reingreso_id: reingresoId, estado: decision === 'APROBADA' ? 'EN_REINGRESO' : 'RESUELTO',
      }, include: detail });
    });
    await notifyRoles(['Recepcion', 'Reclamos', 'Contabilidad'], { type: 'reclamo_decidido', title: 'Cobertura decidida', message: `Reclamo #${id}: cobertura ${decision.toLowerCase()}.`, entity: { kind: 'reclamo', id } });
    if (data.orden_reingreso_id) await notifyJefeTecnico({ type: 'orden_creada', title: 'Orden de garantía pendiente', message: `Asigne la orden de reingreso #${data.orden_reingreso_id}.`, entity: { kind: 'orden', id: data.orden_reingreso_id } });
    res.json({ data });
  } catch (error) { replyError(res, error); }
};

export const cerrarReclamo = async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    const resolucion = String(req.body?.resolucion || '').trim();
    if (!id || resolucion.length < 10 || resolucion.length > 4000) fail(400, 'Describa la resolución final entre 10 y 4000 caracteres');
    const data = await withAuditUser(req.user, async (tx) => {
      await tx.$queryRaw`SELECT id_reclamo FROM "Reclamos" WHERE id_reclamo = ${id} FOR UPDATE`;
      const reclamo = await tx.reclamos.findUnique({ where: { id_reclamo: id }, include: { orden_reingreso: true } });
      if (!reclamo) fail(404, 'Reclamo no encontrado');
      if (reclamo.estado === 'CERRADO') fail(409, 'El reclamo ya está cerrado');
      if (reclamo.cobertura === 'PENDIENTE') fail(409, 'Falta la decisión de cobertura');
      if (reclamo.cobertura === 'APROBADA' && reclamo.orden_reingreso?.estado !== 'ENTREGADO') fail(409, 'Entregue la orden de reingreso antes de cerrar el reclamo');
      return tx.reclamos.update({ where: { id_reclamo: id }, data: { estado: 'CERRADO', resolucion, fecha_cierre: new Date() }, include: detail });
    });
    await notifyRoles(['Recepcion', 'Garantias', 'Contabilidad'], { type: 'reclamo_cerrado', title: 'Reclamo cerrado', message: `Reclamo #${id} cerrado con resolución registrada.`, entity: { kind: 'reclamo', id } });
    res.json({ data });
  } catch (error) { replyError(res, error); }
};
