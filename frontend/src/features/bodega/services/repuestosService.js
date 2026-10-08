import api from '../../../services/api';

export const getRepuestos = (params = {}) => api.get('/repuestos', { params });
export const createRepuesto = (data) => api.post('/repuestos', data);
export const updateRepuesto = (id, data) => api.put(`/repuestos/${id}`, data);
export const deleteRepuesto = (id) => api.delete(`/repuestos/${id}`);

export const repuestoService = {
  getTodos: getRepuestos,
  getPendientesAprobacion: () => api.get('/diagnosticos/repuestos/pendientes-aprobacion'),
  aprobar: (id_detalle_repuesto) =>
    api.patch(`/diagnosticos/repuestos/${id_detalle_repuesto}/aprobar`),
  rechazar: (id_detalle_repuesto) =>
    api.patch(`/diagnosticos/repuestos/${id_detalle_repuesto}/rechazar`),
};
