import prisma from '../../app/prismaClient.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { assertInList, parsePositiveId } from '../../utils/domainValidation.js';
import { assertPuedeFinalizar, assertTecnicoDisponible, auditMotivo, diagnosticoActivo, fail, lockTrabajo, motivoObligatorio, ordenActiva, tecnicoElegible } from '../../utils/tecnicoWorkflow.js';
import { catalogoDisponible, lockRepuestos, stockDisponible } from '../Tecnico/stockDisponible.js';

const userSelect = { id_usuario: true, nombre_usuario: true };
const techInclude = { usuario: { select: { id_usuario: true, nombre_usuario: true, rol: true, activo: true } } };
const diagInclude = { equipo: { include: { cliente: true } }, tecnico: true, historial_estados: { orderBy: { fecha_hora: 'desc' }, take: 1 }, avances_tecnicos: { orderBy: { fecha_hora: 'desc' }, take: 1 } };
const orderInclude = { tecnico: true, diagnostico: { include: diagInclude }, repuestos_usados: { include: { repuesto: true } }, facturas: { select: { id_factura: true } }, historial_estados: { orderBy: { fecha_hora: 'desc' }, take: 1 }, avances_tecnicos: { orderBy: { fecha_hora: 'desc' }, take: 1 } };
const pieceInclude = { repuesto: true, compra: { include: { proveedor: true } }, tecnico_solicitante: true, usuario_aprobador: { select: userSelect }, usuario_entregador: { select: userSelect }, orden: { include: { tecnico: true, facturas: { select: { id_factura: true } }, diagnostico: { select: { falla_reportada: true, diagnostico_real: true, equipo: { select: { tipo: true, marca: true, modelo: true } } } } } } };
const idValue = (value) => parsePositiveId(value) || fail(400, 'La referencia seleccionada no es válida');
const entity = (tipo) => tipo === 'orden' ? { model: 'ordenes', key: 'id_orden', include: orderInclude } : { model: 'diagnosticos', key: 'id_diagnostico', include: diagInclude };
const active = (tipo, r) => tipo === 'orden' ? ordenActiva(r) : diagnosticoActivo(r);
const snapshot = (r) => JSON.parse(JSON.stringify({ tecnico_id: r.tecnico_id, fecha_asignacion: r.fecha_asignacion, estado: r.estado || r.estado_del_diagnostico, observacion_final: r.observacion_final, resultado_final: r.resultado_final, fecha_finalizacion: r.fecha_finalizacion }));
const pieceSnapshot = (r) => JSON.parse(JSON.stringify(Object.fromEntries([
  'id_detalle_repuesto', 'orden_id', 'repuesto_id', 'pieza_solicitada', 'cantidad_usada',
  'estado_aprobacion', 'estado_entrega', 'fecha_aprobacion', 'fecha_rechazo', 'motivo_rechazo',
  'usuario_aprobador_id', 'fecha_entrega', 'usuario_entregador_id', 'compra_id',
].map((key) => [key, r[key]]))));
const correctionTypes = {
  corregir: 'CORRECCION_REPUESTO', 'retirar-aprobacion': 'RETIRAR_APROBACION',
  reabrir: 'REABRIR_SOLICITUD', 'corregir-entrega': 'CORREGIR_ENTREGA', devolver: 'DEVOLUCION_REPUESTO',
};
const average = (rows, start, end) => {
  const values = rows.filter((r) => r[start] && r[end] && new Date(r[end]) >= new Date(r[start])).map((r) => (new Date(r[end]) - new Date(r[start])) / 3600000);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
};
const toWork = (r, tipo) => {
  const d = tipo === 'orden' ? r.diagnostico : r, e = d.equipo;
  const last = [r.fecha_borrador, r.avances_tecnicos[0]?.fecha_hora, r.historial_estados[0]?.fecha_hora, r.fecha_asignacion, r.fecha_inicio_reparacion || r.fecha_inicio, r.fecha_ingreso || r.fecha_hora].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0];
  const isActive = active(tipo, r), billed = Boolean(r.facturas?.length);
  return { key: `${tipo}-${r.id_orden || r.id_diagnostico}`, tipo, id: r.id_orden || r.id_diagnostico, diagnostico_id: tipo === 'orden' ? r.diagnostico_id : null, equipo_nombre: [e.marca, e.modelo].filter(Boolean).join(' ') || e.tipo || 'Equipo', cliente_nombre: e.cliente.nombre, tecnico: r.tecnico, estado: r.estado || r.estado_del_diagnostico, prioridad: r.prioridad || 'Normal', activo: isActive, fecha_finalizacion: r.fecha_finalizacion || r.fecha_completado, ultimo_avance: last, horas_sin_avance: last ? Math.max(0, (Date.now() - new Date(last)) / 3600000) : 0, irreparable_estado: r.irreparable_estado, justificacion_irreparable: r.justificacion_irreparable, tiene_factura: billed, puede_asignar: isActive && !r.tecnico_id && !billed && r.estado !== 'IRREPARABLE', puede_intervenir: isActive && Boolean(r.tecnico_id) && !billed && r.estado !== 'IRREPARABLE' };
};
export const resumen = async () => {
  const [diagnosticos, ordenes, techs, pieces, catalogo, intervenciones] = await Promise.all([
    prisma.diagnosticos.findMany({ include: diagInclude, orderBy: { id_diagnostico: 'desc' } }),
    prisma.ordenes.findMany({ include: orderInclude, orderBy: { id_orden: 'desc' } }),
    prisma.tecnicos.findMany({ where: { activo: true }, include: techInclude, orderBy: { nombre: 'asc' } }),
    prisma.ordenes_Repuestos.findMany({ include: pieceInclude, orderBy: { fecha_solicitud: 'desc' } }),
    catalogoDisponible(prisma), prisma.intervencionesTecnicas.findMany({ include: { usuario: { select: userSelect } }, orderBy: { fecha_hora: 'desc' } }),
  ]);
  const trabajos = [...diagnosticos.map((r) => toWork(r, 'diagnostico')), ...ordenes.map((r) => toWork(r, 'orden'))];
  const activos = trabajos.filter((r) => r.activo);
  const tecnicos = techs.filter(tecnicoElegible).map((t) => ({ ...t, diagnosticos_activos: activos.filter((r) => r.tipo === 'diagnostico' && r.tecnico?.id_tecnico === t.id_tecnico).length, ordenes_activas: activos.filter((r) => r.tipo === 'orden' && r.tecnico?.id_tecnico === t.id_tecnico).length, atrasados: activos.filter((r) => r.tecnico?.id_tecnico === t.id_tecnico && r.horas_sin_avance >= 72).length }));
  const repuestos = pieces.map((p) => {
    const editable = ordenActiva(p.orden) && p.orden.estado !== 'IRREPARABLE' && !p.orden.facturas.length;
    const delivered = p.estado_entrega === 'ENTREGADO', approved = p.estado_aprobacion === 'APROBADO';
    return { ...p, puede_revisar: editable && !delivered && p.estado_aprobacion === 'PENDIENTE',
      puede_entregar: editable && approved && !delivered && Boolean(p.repuesto_id),
      puede_corregir: editable && !delivered && ['PENDIENTE', 'APROBADO'].includes(p.estado_aprobacion),
      puede_retirar_aprobacion: editable && approved && !delivered,
      puede_reabrir: editable && !delivered && p.estado_aprobacion === 'DENEGADO',
      puede_corregir_entrega: editable && approved && delivered,
      puede_devolver: editable && approved && delivered && Boolean(p.repuesto_id) };
  });
  const count = (estado) => activos.filter((r) => r.estado === estado).length;
  return { trabajos, tecnicos, repuestos, catalogo, intervenciones, indicadores: { trabajos_activos: activos.length, diagnosticos_activos: activos.filter((r) => r.tipo === 'diagnostico').length, ordenes_activas: activos.filter((r) => r.tipo === 'orden').length, sin_asignar: activos.filter((r) => r.puede_asignar).length, asignados: count('ASIGNADO'), en_diagnostico: count('EN_REVISION'), en_reparacion: count('EN_REPARACION'), esperando_piezas: count('ESPERANDO_PIEZA'), irreparables_pendientes: ordenes.filter((o) => o.estado === 'IRREPARABLE' && o.irreparable_estado === 'PENDIENTE' && o.justificacion_irreparable).length, repuestos_pendientes: repuestos.filter((p) => p.puede_revisar).length, repuestos_por_entregar: repuestos.filter((p) => p.puede_entregar).length, atrasados: activos.filter((r) => r.horas_sin_avance >= 72).length, promedio_diagnostico_horas: average(diagnosticos, 'fecha_inicio', 'fecha_completado'), promedio_reparacion_horas: average(ordenes, 'fecha_inicio_reparacion', 'fecha_finalizacion') } };
};
export const detalle = async (tipo, value) => {
  const id = idValue(value), { model, key, include } = entity(tipo), whereHistory = tipo === 'orden' ? { orden_id: id } : { diagnostico_id: id };
  const r = await prisma[model].findUnique({ where: { [key]: id }, include });
  if (!r) fail(404, 'Trabajo no encontrado');
  const [historial, asignaciones, intervenciones, avances, intervencionesDiagnostico] = await Promise.all([
    prisma[tipo === 'orden' ? 'historialOrdenes' : 'historialDiagnosticos'].findMany({ where: whereHistory, include: { usuario: { select: userSelect } }, orderBy: { fecha_hora: 'desc' } }),
    prisma.historialAsignaciones.findMany({ where: whereHistory, include: { tecnico_anterior: true, tecnico_nuevo: true, usuario: { select: userSelect } }, orderBy: { fecha_hora: 'desc' } }),
    prisma.intervencionesTecnicas.findMany({ where: whereHistory, include: { usuario: { select: userSelect } }, orderBy: { fecha_hora: 'desc' } }),
    prisma.bitacoraTecnica.findMany({ where: whereHistory, include: { usuario: { select: userSelect } }, orderBy: { fecha_hora: 'desc' } }),
    tipo === 'orden' ? prisma.intervencionesTecnicas.findMany({ where: { diagnostico_id: r.diagnostico_id }, include: { usuario: { select: userSelect } }, orderBy: { fecha_hora: 'desc' } }) : Promise.resolve([]),
  ]);
  return { registro: r, historial_estados: historial, asignaciones, intervenciones, intervenciones_diagnostico: intervencionesDiagnostico, avances };
};
const editable = async (tx, tipo, id) => {
  await lockTrabajo(tx, tipo, id);
  const { model, key, include } = entity(tipo), r = await tx[model].findUnique({ where: { [key]: id }, include });
  if (!r) fail(404, 'Trabajo no encontrado');
  if (!active(tipo, r) || r.estado === 'IRREPARABLE' || r.facturas?.length) fail(409, 'El trabajo cerrado, facturado o en revisión de irreparable no admite esta acción');
  return r;
};
export const asignar = (tipo, value, payload, user) => withAuditUser(user, async (tx) => {
  const id = idValue(value), tecnicoId = idValue(payload.tecnico_id || payload.id_tecnico), { model, key } = entity(tipo);
  const r = await editable(tx, tipo, id);
  if (r.tecnico_id) fail(409, 'Este trabajo ya tiene técnico; use una intervención excepcional para reasignarlo');
  await assertTecnicoDisponible(tx, tecnicoId);
  await auditMotivo(tx, 'Asignación inicial de trabajo');
  return tx[model].update({ where: { [key]: id }, data: { tecnico_id: tecnicoId, fecha_asignacion: new Date(), [tipo === 'orden' ? 'estado' : 'estado_del_diagnostico']: 'ASIGNADO' }, include: tipo === 'orden' ? orderInclude : diagInclude });
});
export const prioridad = (tipo, value, payload, user) => withAuditUser(user, async (tx) => {
  const id = idValue(value), { model, key } = entity(tipo);
  await editable(tx, tipo, id);
  const valuePriority = String(payload.prioridad || '').toUpperCase();
  assertInList(valuePriority, ['NORMAL', 'ALTA', 'URGENTE'], 'Prioridad');
  if (!valuePriority) fail(400, 'Seleccione una prioridad');
  await auditMotivo(tx, motivoObligatorio(payload.motivo));
  return tx[model].update({ where: { [key]: id }, data: { prioridad: valuePriority[0] + valuePriority.slice(1).toLowerCase() }, include: tipo === 'orden' ? orderInclude : diagInclude });
});
export const intervenir = (tipo, value, payload, user) => withAuditUser(user, async (tx) => {
  const id = idValue(value), motivo = motivoObligatorio(payload.motivo), { model, key } = entity(tipo), r = await editable(tx, tipo, id);
  if (!r.tecnico_id) fail(409, 'Asigne un técnico antes de intervenir en el trabajo');
  if (!['REASIGNACION', 'FINALIZACION'].includes(payload.tipo)) fail(400, 'Tipo de intervención no permitido');
  await auditMotivo(tx, motivo, true);
  let changes;
  if (payload.tipo === 'REASIGNACION') {
    const tecnicoId = idValue(payload.tecnico_id);
    if (tecnicoId === r.tecnico_id) fail(409, 'Seleccione un técnico diferente al responsable actual');
    await assertTecnicoDisponible(tx, tecnicoId);
    // Se conserva el avance y la fecha de inicio; reasignar no reinicia la reparación.
    changes = { tecnico_id: tecnicoId, fecha_asignacion: new Date() };
  } else {
    if (tipo !== 'orden') fail(403, 'El jefe no puede completar diagnósticos mediante excepciones');
    assertPuedeFinalizar(r);
    const observacion = String(payload.observacion_final || '').trim();
    if (!observacion || observacion.length > 4000) fail(400, 'Registre el resultado comprobado de la reparación, hasta 4000 caracteres');
    if (![true, false, 'true', 'false'].includes(payload.enciende_salida) || ![true, false, 'true', 'false'].includes(payload.usa_corriente_ac_salida)) fail(400, 'Registre las comprobaciones de salida');
    changes = { estado: 'FINALIZADO', resultado_final: 'REPARADO', observacion_final: observacion, enciende_salida: payload.enciende_salida === true || payload.enciende_salida === 'true', usa_corriente_ac_salida: payload.usa_corriente_ac_salida === true || payload.usa_corriente_ac_salida === 'true', fecha_finalizacion: new Date(), fecha_cierre: new Date(), calidad_estado: 'PENDIENTE', calidad_observacion: null, calidad_revisada_en: null };
  }
  const updated = await tx[model].update({ where: { [key]: id }, data: changes, include: tipo === 'orden' ? orderInclude : diagInclude });
  await tx.intervencionesTecnicas.create({ data: { [tipo === 'orden' ? 'orden_id' : 'diagnostico_id']: id, tipo: payload.tipo, motivo, usuario_id: user.id, datos_anteriores: snapshot(r), datos_nuevos: snapshot(updated) } });
  return { anterior: r, actualizado: updated };
});
export const disponibilidad = (value, payload, user) => withAuditUser(user, async (tx) => {
  const id = idValue(value);
  await tx.$queryRaw`SELECT id_tecnico FROM "Tecnicos" WHERE id_tecnico = ${id} FOR UPDATE`;
  const t = await tx.tecnicos.findUnique({ where: { id_tecnico: id }, include: techInclude });
  if (!tecnicoElegible(t)) fail(404, 'Técnico con cuenta activa no encontrado');
  if (!['DISPONIBLE', 'AUSENTE', 'NO_DISPONIBLE'].includes(payload.disponibilidad)) fail(400, 'Disponibilidad no permitida');
  const note = String(payload.observacion_disponibilidad || '').trim();
  if (note.length > 2000) fail(400, 'La observación no debe superar 2000 caracteres');
  if (payload.disponibilidad !== 'DISPONIBLE' && !note) fail(400, 'Indique el motivo de la indisponibilidad');
  await auditMotivo(tx, note || 'Técnico disponible');
  return tx.tecnicos.update({ where: { id_tecnico: id }, data: { disponibilidad: payload.disponibilidad, observacion_disponibilidad: note || null } });
});
export const revisarIrreparable = (value, payload, user) => withAuditUser(user, async (tx) => {
  const id = idValue(value); await lockTrabajo(tx, 'orden', id);
  const r = await tx.ordenes.findUnique({ where: { id_orden: id }, include: orderInclude });
  if (!r) fail(404, 'Orden no encontrada');
  if (r.estado !== 'IRREPARABLE' || r.irreparable_estado !== 'PENDIENTE' || !r.justificacion_irreparable || r.facturas.length) fail(409, 'Esta orden no tiene una solicitud de irreparabilidad pendiente');
  if (!['APROBADO', 'RECHAZADO'].includes(payload.decision)) fail(400, 'Decisión no permitida');
  const motivo = motivoObligatorio(payload.motivo); await auditMotivo(tx, motivo);
  return tx.ordenes.update({ where: { id_orden: id }, data: { irreparable_estado: payload.decision, estado: payload.decision === 'APROBADO' ? 'IRREPARABLE' : 'EN_REPARACION', usuario_revisor_irreparable_id: user.id, fecha_revision_irreparable: new Date(), motivo_revision_irreparable: motivo, ...(payload.decision === 'APROBADO' ? { resultado_final: 'IRREPARABLE', fecha_finalizacion: new Date(), fecha_cierre: new Date() } : { resultado_final: null, fecha_finalizacion: null, fecha_cierre: null }) }, include: orderInclude });
});
export const accionRepuesto = (value, accion, payload, user) => withAuditUser(user, async (tx) => {
  const id = idValue(value), previous = await tx.ordenes_Repuestos.findUnique({ where: { id_detalle_repuesto: id } });
  if (!previous) fail(404, 'Solicitud no encontrada');
  await lockTrabajo(tx, 'orden', previous.orden_id);
  await tx.$queryRaw`SELECT id_detalle_repuesto FROM "Ordenes_Repuestos" WHERE id_detalle_repuesto = ${id} FOR UPDATE`;
  const r = await tx.ordenes_Repuestos.findUnique({ where: { id_detalle_repuesto: id }, include: pieceInclude });
  if (!r) fail(404, 'Solicitud no encontrada');
  if (!ordenActiva(r.orden) || r.orden.estado === 'IRREPARABLE' || r.orden.facturas.length) fail(409, 'No se pueden modificar piezas de una orden cerrada, facturada o en revisión');
  const finish = async (changes, motivo) => {
    await auditMotivo(tx, motivo, Boolean(correctionTypes[accion]));
    const updated = await tx.ordenes_Repuestos.update({ where: { id_detalle_repuesto: id }, data: changes, include: pieceInclude });
    if (correctionTypes[accion]) await tx.intervencionesTecnicas.create({ data: {
      orden_id: r.orden_id, tipo: correctionTypes[accion], motivo, usuario_id: user.id,
      datos_anteriores: pieceSnapshot(r), datos_nuevos: pieceSnapshot(updated),
    } });
    return updated;
  };
  if (['retirar-aprobacion', 'reabrir', 'corregir-entrega', 'devolver'].includes(accion)) {
    const motivo = motivoObligatorio(payload.motivo);
    if (accion === 'retirar-aprobacion' && (r.estado_aprobacion !== 'APROBADO' || r.estado_entrega === 'ENTREGADO')) fail(409, 'Solo se puede retirar una aprobación antes de entregar la pieza');
    if (accion === 'reabrir' && (r.estado_aprobacion !== 'DENEGADO' || r.estado_entrega === 'ENTREGADO')) fail(409, 'Solo se puede devolver a revisión una solicitud rechazada sin entrega');
    if (['corregir-entrega', 'devolver'].includes(accion) && (r.estado_aprobacion !== 'APROBADO' || r.estado_entrega !== 'ENTREGADO')) fail(409, 'La solicitud debe tener una entrega registrada y estar aprobada');
    if (accion === 'corregir-entrega' && payload.entrega_no_realizada !== true) fail(400, 'Confirme que la pieza nunca fue entregada físicamente al técnico');
    if (accion === 'devolver' && (payload.devolucion_total_confirmada !== true || !r.repuesto_id)) fail(400, 'Confirme la recepción de todas las unidades en condiciones de volver al almacén');
    await lockRepuestos(tx, [r.repuesto_id]);
    const changes = { estado_entrega: 'PENDIENTE', fecha_entrega: null, usuario_entregador_id: null, compra_id: null };
    if (accion !== 'corregir-entrega') Object.assign(changes, {
      estado_aprobacion: 'PENDIENTE', fecha_aprobacion: null, fecha_rechazo: null,
      motivo_rechazo: null, usuario_aprobador_id: null,
    });
    return finish(changes, motivo);
  }
  if (accion === 'entregar') {
    if (r.estado_aprobacion !== 'APROBADO' || r.estado_entrega === 'ENTREGADO' || !r.repuesto_id) fail(409, 'Solo se pueden entregar piezas del catálogo aprobadas y pendientes de entrega');
    const compraId = payload.compra_id ? idValue(payload.compra_id) : null;
    if (compraId) {
      await lockRepuestos(tx, [r.repuesto_id]);
      const compra = await tx.compras.findUnique({ where: { id_compra: compraId } });
      if (!compra || compra.repuesto_id !== r.repuesto_id) fail(409, 'La compra seleccionada no corresponde al repuesto aprobado');
      const asignadas = await tx.ordenes_Repuestos.aggregate({ where: { compra_id: compraId, estado_entrega: 'ENTREGADO' }, _sum: { cantidad_usada: true } });
      if (Number(compra.cantidad || 0) - Number(asignadas._sum.cantidad_usada || 0) < Number(r.cantidad_usada || 0)) fail(409, 'La compra no tiene suficientes unidades sin asignar');
      if (await stockDisponible(tx, r.repuesto_id, id) < Number(r.cantidad_usada || 0)) fail(409, 'Stock físico insuficiente para la entrega');
    }
    return finish({ estado_entrega: 'ENTREGADO', fecha_entrega: new Date(), usuario_entregador_id: user.id, compra_id: compraId }, 'Entrega física de repuesto al técnico');
  }
  if (accion === 'rechazar') {
    if (r.estado_aprobacion !== 'PENDIENTE') fail(409, 'La solicitud ya fue revisada');
    if (r.estado_entrega === 'ENTREGADO') fail(409, 'Una pieza entregada debe corregirse o devolverse antes de revisar la solicitud');
    const motivo = motivoObligatorio(payload.motivo || payload.motivo_rechazo);
    return finish({ estado_aprobacion: 'DENEGADO', motivo_rechazo: motivo, usuario_aprobador_id: user.id, fecha_rechazo: new Date() }, motivo);
  }
  if (!['aprobar', 'corregir'].includes(accion)) fail(400, 'Acción de repuesto no permitida');
  if (accion === 'aprobar' && r.estado_aprobacion !== 'PENDIENTE') fail(409, 'La solicitud ya fue revisada');
  if (r.estado_entrega === 'ENTREGADO' || r.estado_aprobacion === 'DENEGADO') fail(409, 'Una pieza entregada o rechazada no admite correcciones');
  const repuestoId = idValue(payload.repuesto_id || r.repuesto_id), cantidad = Number(payload.cantidad_usada ?? r.cantidad_usada);
  if (!Number.isInteger(cantidad) || cantidad < 1) fail(400, 'La cantidad debe ser un entero mayor a cero');
  await lockRepuestos(tx, [r.repuesto_id, repuestoId]);
  const part = await tx.repuestos.findUnique({ where: { id_repuesto: repuestoId } });
  if (!part || part.descontinuada) fail(404, 'El repuesto no está disponible en el catálogo');
  if (accion === 'corregir' && repuestoId === r.repuesto_id && cantidad === r.cantidad_usada) fail(409, 'Cambie la pieza o la cantidad para registrar una corrección');
  if ((accion === 'aprobar' || r.estado_aprobacion === 'APROBADO') && await stockDisponible(tx, repuestoId, id) < cantidad) fail(409, 'Stock disponible insuficiente; otras órdenes ya tienen piezas reservadas');
  return finish({ repuesto_id: repuestoId, pieza_solicitada: part.nombre, cantidad_usada: cantidad, ...(accion === 'aprobar' ? { estado_aprobacion: 'APROBADO', usuario_aprobador_id: user.id, fecha_aprobacion: new Date(), fecha_rechazo: null, motivo_rechazo: null, estado_entrega: 'PENDIENTE', fecha_entrega: null, usuario_entregador_id: null } : {}) }, accion === 'corregir' ? motivoObligatorio(payload.motivo) : 'Aprobación de solicitud de repuesto');
});
