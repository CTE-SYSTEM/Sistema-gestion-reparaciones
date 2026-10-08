import api from '../../../services/api';

export const getTiposRepuesto = (params = {}) => api.get('/tipos-repuesto', { params });
export const createTipoRepuesto = (data) => api.post('/tipos-repuesto', data);
export const updateTipoRepuesto = (id, data) => api.put(`/tipos-repuesto/${id}`, data);
export const deleteTipoRepuesto = (id) => api.delete(`/tipos-repuesto/${id}`);
