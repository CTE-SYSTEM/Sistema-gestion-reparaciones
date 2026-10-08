import api from '../../../services/api';

export const getEquipos = (params = {}) => api.get('/equipos', { params });
export const createEquipo = (data) => api.post('/equipos', data);
export const updateEquipo = (id, data) => api.put(`/equipos/${id}`, data);
export const deleteEquipo = (id) => api.delete(`/equipos/${id}`);
