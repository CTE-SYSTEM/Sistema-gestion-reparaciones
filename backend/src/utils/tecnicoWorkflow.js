import { normalizeRole } from './roles.js';

export const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
export const motivoObligatorio = (value) => {
  const motivo = String(value || '').trim();
  if (!motivo || motivo.length > 2000) fail(400, 'Indique un motivo de hasta 2000 caracteres');
  return motivo;
};
export const diagnosticoActivo = (d) => ['PENDIENTE', 'INGRESADO', 'ASIGNADO', 'EN_REVISION'].includes(d.estado_del_diagnostico);
export const ordenActiva = (o) => !['FINALIZADO', 'ENTREGADO', 'CANCELADO'].includes(o.estado)
  && (o.estado !== 'IRREPARABLE' || o.irreparable_estado === 'PENDIENTE');
export const tecnicoElegible = (t) => Boolean(t?.activo && t.usuario?.activo && normalizeRole(t.usuario.rol) === 'tecnico');
export const assertTecnicoDisponible = async (tx, id) => {
  await tx.$queryRaw`SELECT id_tecnico FROM "Tecnicos" WHERE id_tecnico = ${id} FOR UPDATE`;
  const t = await tx.tecnicos.findUnique({ where: { id_tecnico: id }, include: { usuario: { select: { activo: true, rol: true } } } });
  if (!tecnicoElegible(t)) fail(400, 'Seleccione un técnico con una cuenta activa de rol Técnico');
  if (t.disponibilidad !== 'DISPONIBLE') fail(409, 'El técnico seleccionado no está disponible para nuevas asignaciones');
  return t;
};
export const assertTrabajoPropio = async (tx, user, tecnicoId) => {
  const t = await tx.tecnicos.findFirst({ where: { usuario_id: user?.id || -1, activo: true } });
  if (normalizeRole(user?.rol) !== 'tecnico' || !t || t.id_tecnico !== tecnicoId) fail(403, 'Solo el técnico asignado puede modificar este trabajo');
  return t;
};
export const assertPuedeFinalizar = (orden) => {
  if (!ordenActiva(orden) || orden.estado === 'IRREPARABLE') fail(409, 'La orden no admite una finalización en su estado actual');
  if (!orden.tecnico_id || !orden.fecha_inicio_reparacion) fail(409, 'La orden debe tener técnico y un inicio de reparación registrado');
  if (orden.repuestos_usados.some((p) => p.estado_aprobacion === 'PENDIENTE' || (p.estado_aprobacion === 'APROBADO' && (p.estado_entrega !== 'ENTREGADO' || !p.repuesto_id)))) fail(409, 'Las piezas pendientes deben revisarse y las aprobadas deben entregarse antes de finalizar');
};
export const auditMotivo = (tx, motivo, excepcion = false) => tx.$queryRaw`SELECT set_config('app.observacion', ${motivo}, true), set_config('app.excepcion_tecnica', ${excepcion ? 'true' : 'false'}, true)`;
export const lockTrabajo = (tx, tipo, id) => tipo === 'orden'
  ? tx.$queryRaw`SELECT id_orden FROM "Ordenes" WHERE id_orden = ${id} FOR UPDATE`
  : tx.$queryRaw`SELECT id_diagnostico FROM "Diagnosticos" WHERE id_diagnostico = ${id} FOR UPDATE`;
