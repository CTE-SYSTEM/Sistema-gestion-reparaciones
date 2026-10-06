import * as service from '../../services/JefeTecnico/supervisionService.js';
import { notifyTecnico, notifyRole } from '../../services/notifications.js';

export const respond = (operation, message) => async (req, res) => {
  try { res.json({ data: await operation(req), ...(message ? { message } : {}) }); }
  catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === 'P2025') return res.status(404).json({ error: 'Registro no encontrado' });
    if (['P2002', 'P2010', 'P2034'].includes(error.code)) return res.status(409).json({ error: 'El trabajo cambió o incumple una regla. Actualice la información antes de continuar.' });
    console.error('Error de supervisión:', error);
    return res.status(500).json({ error: 'No se pudo procesar la operación de supervisión' });
  }
};
const workNotice = (tipo, r, title, message, notificationType) => notifyTecnico(r.tecnico, { type: notificationType, title, message, severity: 'info', entity: { kind: tipo, id: r.id_orden || r.id_diagnostico } });
export const getResumen = respond(() => service.resumen());
export const getDetalle = (tipo) => respond((req) => service.detalle(tipo, req.params.id));
export const asignarTrabajo = (tipo) => respond(async (req) => {
  const r = await service.asignar(tipo, req.params.id, req.body, req.user);
  await workNotice(tipo, r, 'Nuevo trabajo asignado', `Se te asignó ${tipo === 'orden' ? 'la orden' : 'el diagnóstico'} #${req.params.id}. Registra el inicio cuando comiences.`, `${tipo}_asignado`);
  return r;
}, 'Técnico asignado correctamente');
export const cambiarPrioridad = (tipo) => respond(async (req) => {
  const r = await service.prioridad(tipo, req.params.id, req.body, req.user);
  await workNotice(tipo, r, 'Prioridad actualizada', `La prioridad del trabajo #${req.params.id} cambió a ${r.prioridad}.`, 'prioridad_actualizada');
  return r;
}, 'Prioridad registrada correctamente');
export const intervenirTrabajo = (tipo) => respond(async (req) => {
  const { anterior, actualizado } = await service.intervenir(tipo, req.params.id, req.body, req.user);
  if (req.body.tipo === 'REASIGNACION') {
    await workNotice(tipo, anterior, 'Trabajo reasignado', `El trabajo #${req.params.id} fue reasignado por el jefe. Motivo: ${req.body.motivo}`, 'trabajo_retirado');
    await workNotice(tipo, actualizado, 'Trabajo reasignado a tu cuenta', `El trabajo #${req.params.id} quedó a tu cargo. Motivo: ${req.body.motivo}`, 'trabajo_reasignado');
  } else {
    await workNotice(tipo, actualizado, 'Finalización excepcional', `El jefe registró una finalización excepcional para la orden #${req.params.id}.`, 'orden_cerrada');
    await notifyRole('Secretaria', { type: 'orden_finalizada', title: 'Orden lista para facturar', message: `La orden #${req.params.id} quedó finalizada.`, entity: { kind: 'orden', id: Number(req.params.id) } });
  }
  return actualizado;
}, 'Intervención excepcional registrada con su motivo');
export const actualizarDisponibilidad = respond((req) => service.disponibilidad(req.params.id, req.body, req.user), 'Disponibilidad actualizada');
export const revisarIrreparable = respond(async (req) => {
  const r = await service.revisarIrreparable(req.params.id, req.body, req.user);
  await workNotice('orden', r, 'Irreparabilidad revisada', `Orden #${req.params.id}: ${req.body.decision === 'APROBADO' ? 'irreparabilidad confirmada' : 'regresa a reparación'}. ${req.body.motivo}`, 'irreparable_revisado');
  if (req.body.decision === 'APROBADO') await notifyRole('Secretaria', { type: 'irreparable_confirmado', title: 'Irreparabilidad confirmada', message: `El jefe confirmó la irreparabilidad de la orden #${req.params.id}.`, entity: { kind: 'orden', id: Number(req.params.id) } });
  return r;
}, 'Revisión de irreparabilidad registrada');
export const procesarRepuesto = (accion) => respond(async (req) => {
  const r = await service.accionRepuesto(req.params.id, accion, req.body, req.user);
  const payload = { type: `repuesto_${accion}`, title: `Solicitud de repuesto: ${accion}`, message: `La solicitud #${r.id_detalle_repuesto} de la orden #${r.orden_id} fue procesada. ${r.motivo_rechazo || ''}`, entity: { kind: 'repuesto', id: r.id_detalle_repuesto, orden_id: r.orden_id } };
  await notifyTecnico(r.tecnico_solicitante || r.orden.tecnico, payload);
  if (r.tecnico_solicitante?.id_tecnico !== r.orden.tecnico?.id_tecnico) await notifyTecnico(r.orden.tecnico, payload);
  return r;
}, 'Acción de repuesto registrada correctamente');
