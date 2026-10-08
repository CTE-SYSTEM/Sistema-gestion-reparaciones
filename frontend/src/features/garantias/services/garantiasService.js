import api from '../../../services/api';

export const getGarantias = (params = {}) => api.get('/garantias', { params });
export const createGarantia = (data) => api.post('/garantias', data);
