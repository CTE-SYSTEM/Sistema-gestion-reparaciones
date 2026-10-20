export const receptionPhotosReadOnly = (kind, servicio) => {
  if (!servicio) return true;
  if (kind === 'diagnostico') return Boolean(servicio.tecnico_id || servicio.fecha_inicio || servicio.ordenes?.length)
    || !['PENDIENTE', 'INGRESADO'].includes(servicio.estado_del_diagnostico);
  return Boolean(servicio.tecnico_id || servicio.fecha_inicio_reparacion)
    || servicio.estado !== 'PENDIENTE';
};
