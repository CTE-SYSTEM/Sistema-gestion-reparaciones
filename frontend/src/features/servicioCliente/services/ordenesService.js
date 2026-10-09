// Servicio al Cliente: órdenes y entregas.
import api from '../../../services/api';

export const getOrdenes = (params = {}) => api.get('/ordenes', { params, cache: false });
export const getDiagnosticosListosParaOrden = (params = {}) => api.get('/ordenes/diagnosticos-listos', { params, cache: false });
export const createOrden = (data) => api.post('/ordenes', data);
export const createOrdenDirecta = (data) => api.post('/ordenes/directa', data);
export const updateOrden = (id, data) => api.put(`/ordenes/${id}`, data);
export const deleteOrden = (id) => api.delete(`/ordenes/${id}`);
export const registrarEntregaOrden = (id, data) => api.patch(`/ordenes/${id}/entrega`, data);
export const cancelarOrden = (id, motivo_cancelacion) => api.patch(`/ordenes/${id}/cancelar`, { motivo_cancelacion });
export const getHistorialOrden = (id) => api.get(`/ordenes/${id}/historial`, { cache: false });

export const ordenesService = {
  getTodas: getOrdenes,
  getAprobadas: () => api.get('/diagnosticos/ordenes/aprobadas'),
  asignarOrden: (id_orden, id_tecnico) =>
    api.patch(`/diagnosticos/orden/${id_orden}/asignar`, { id_tecnico }),
};
