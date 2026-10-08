// frontend/src/features/secretaria/services/clientesService.js
import api from '../../../services/api';

export const getClientes = (params = {}) => api.get('/clientes', { params });
export const createCliente = (data) => api.post('/clientes', data);
export const updateCliente = (id, data) => api.put(`/clientes/${id}`, data);
export const deleteCliente = (id) => api.delete(`/clientes/${id}`);
