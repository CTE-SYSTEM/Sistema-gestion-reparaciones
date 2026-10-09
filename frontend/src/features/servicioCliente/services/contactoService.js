import api from '../../../services/api';

export const actualizarContacto = (id, data) => api.patch(`/servicio-cliente/diagnostico/${id}/contacto`, data);
export const registrarRetiro = (id, data) => api.patch(`/servicio-cliente/diagnostico/${id}/retiro`, data);
export const getHistorialDiagnostico = (id) => api.get(`/servicio-cliente/diagnostico/${id}/historial`, { cache: false });
export const descargarDocumentoDiagnostico = (id) => api.get(`/servicio-cliente/diagnostico/${id}/documento`, { responseType: 'blob' });
