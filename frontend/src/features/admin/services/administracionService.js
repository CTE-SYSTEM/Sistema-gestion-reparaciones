import api from '../../../services/api';

const root = '/admin_pro';
export const administracionService = {
  getCuenta: () => api.get('/auth/mi-cuenta', { cache: false }),
  updateCuenta: (body) => api.put('/auth/mi-cuenta', body),
  changePassword: (body) => api.put('/auth/mi-cuenta/password', body),
  closeSessions: (body) => api.post('/auth/mi-cuenta/cerrar-sesiones', body),
  getConfiguracion: () => api.get(`${root}/configuracion`, { cache: false }),
  saveConfiguracion: (body) => api.put(`${root}/configuracion`, body),
  getReglas: () => api.get(`${root}/reglas`, { cache: false }),
  getAuditoria: (params) => api.get(`${root}/auditoria`, { params, cache: false }),
  getBackups: () => api.get(`${root}/backups`, { cache: false }),
  createBackup: () => api.post(`${root}/backups/manual`),
  downloadBackup: (month, name) => api.get(`${root}/backups/${encodeURIComponent(month)}/${encodeURIComponent(name)}/descargar`, { responseType: 'blob' }),
  verifyBackup: (month, name) => api.post(`${root}/backups/${encodeURIComponent(month)}/${encodeURIComponent(name)}/verificar`),
  restoreBackup: (month, name, respaldoId, confirmacion) => api.post(`${root}/backups/${encodeURIComponent(month)}/${encodeURIComponent(name)}/restaurar`, { respaldo_id: respaldoId, confirmacion }),
  getCatalogo: (signal) => api.get(`${root}/reportes/catalogo`, { signal }),
  getOpciones: (signal) => api.get(`${root}/reportes/opciones`, { signal }),
  getReporte: (type, params, signal) => api.get(`${root}/reportes/${type}`, { params, signal, cache: false }),
  getReporteExcel: (type, params) => api.get(`${root}/reportes/${type}/excel`, { params, responseType: 'blob', cache: false }),
};

export const saveBlob = (blob, name) => {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export const errorText = async (error) => {
  const data = error.response?.data;
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text()).error || 'No se pudo descargar el archivo.'; } catch { return 'No se pudo descargar el archivo.'; }
  }
  return data?.error || data?.message || 'No se pudo completar la operación. Intente nuevamente.';
};
