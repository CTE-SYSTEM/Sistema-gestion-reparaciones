import api from '../../../services/api';

export const getCompras = (params = {}) => api.get('/compras', { params });
export const createCompra = (data) => api.post('/compras', data);
export const listarFotosCompra = (params = {}) => api.get('/compras/fotos', { params, cache: false });
export const subirFotoCompra = (id, file) => api.post(`/compras/${id}/fotos`, file, { headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) } });
export const descargarFotoCompra = (id) => api.get(`/compras/fotos/${id}/contenido`, { responseType: 'blob' });
