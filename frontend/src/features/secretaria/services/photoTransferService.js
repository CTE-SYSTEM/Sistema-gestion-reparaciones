import api from '../../../services/api';

export const crearSesionFotos = () => api.post('/photo-transfer');
export const consultarSesionFotos = (token) => api.get(`/photo-transfer/${token}`, { cache: false });
export const listarFotosTemporales = (token) => api.get(`/photo-transfer/${token}/photos`, { cache: false });
export const descargarFotoTemporal = (token, id) => api.get(`/photo-transfer/${token}/photos/${id}`, { responseType: 'blob' });
export const enviarFotoTemporal = (token, file, onProgress) => api.post(`/photo-transfer/${token}/photos`, file, {
  headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) },
  onUploadProgress: onProgress ? (event) => onProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0) : undefined,
});
export const cerrarSesionFotos = (token) => api.delete(`/photo-transfer/${token}`);
