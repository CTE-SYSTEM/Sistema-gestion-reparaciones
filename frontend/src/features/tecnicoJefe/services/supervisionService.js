import api from '../../../services/api';

const root = '/jefe-tecnico';
const group = (tipo) => tipo === 'orden' ? 'ordenes' : 'diagnosticos';
export const supervisionService = {
  resumen: () => api.get(`${root}/resumen`),
  detalle: (tipo, id) => api.get(`${root}/${group(tipo)}/${id}`),
  asignar: (tipo, id, data) => api.post(`${root}/${group(tipo)}/${id}/asignacion`, data),
  prioridad: (tipo, id, data) => api.patch(`${root}/${group(tipo)}/${id}/prioridad`, data),
  intervenir: (tipo, id, data) => api.post(`${root}/${group(tipo)}/${id}/intervencion`, data),
  disponibilidad: (id, data) => api.patch(`${root}/tecnicos/${id}/disponibilidad`, data),
  repuesto: (id, accion, data) => api.patch(`${root}/repuestos/${id}/${accion}`, data),
  irreparable: (id, data) => api.patch(`${root}/ordenes/${id}/irreparable`, data),
};
