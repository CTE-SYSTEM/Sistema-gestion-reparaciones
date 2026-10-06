import api from '../../../services/api';

export const listarFotosServicio = (kind, id) => api.get(`/archivos-servicio/${kind}/${id}`, { params: { _t: Date.now() } });
export const galeriaFotosServicio = (params = {}) => api.get('/archivos-servicio/galeria', { params, cache: false });
export const subirFotoServicio = (kind, id, tipo, file, { onProgress, correccion } = {}) => api.post(`/archivos-servicio/${kind}/${id}`, file, {
  headers: {
    'Content-Type': file.type,
    'X-Tipo-Archivo': tipo,
    'X-File-Name': encodeURIComponent(file.name),
    ...(correccion ? { 'X-Motivo-Correccion': encodeURIComponent(correccion.motivo),
      'X-Correccion-Excepcion': String(correccion.excepcion === true) } : {}),
  },
  onUploadProgress: onProgress ? (event) => {
    if (event.total) onProgress(Math.round((event.loaded / event.total) * 100));
  } : undefined,
});
export const descargarFotoServicio = (id) => api.get(`/archivos-servicio/${id}/contenido`, { responseType: 'blob' });
export const revisarFotoTecnica = (id, visible) => api.patch(`/archivos-servicio/${id}/visibilidad-tecnica`, { visible_tecnico: visible, sin_datos_cliente: visible });
