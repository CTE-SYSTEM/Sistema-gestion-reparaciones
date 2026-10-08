import api from '../../../services/api';

export const getReclamos = (params = {}) => api.get('/reclamos', { params });
export const crearReclamo = (data) => api.post('/reclamos', data);
export const analizarReclamo = (id, data) => api.patch(`/reclamos/${id}/analisis`, data);
export const decidirCobertura = (id, data) => api.patch(`/reclamos/${id}/decision`, data);
export const cerrarReclamo = (id, data) => api.patch(`/reclamos/${id}/cerrar`, data);
