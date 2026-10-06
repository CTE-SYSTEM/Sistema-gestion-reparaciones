// frontend/src/features/secretaria/services/diagnosticoService.js
import api from '../../../services/api';

export const createDiagnostico = async (diagnosticoData) => {
  const payload = {
    ...diagnosticoData,
    equipo_id: Number.parseInt(diagnosticoData.equipo_id, 10),
    cliente_id: Number.parseInt(diagnosticoData.cliente_id, 10),
    deja_cargador: diagnosticoData.deja_cargador === true || diagnosticoData.deja_cargador === 'true',
    enciende: diagnosticoData.enciende === true || diagnosticoData.enciende === 'true',
    usa_corriente_ac: diagnosticoData.usa_corriente_ac === true || diagnosticoData.usa_corriente_ac === 'true',
  };

  return api.post('/secretaria/diagnostico/create', payload);
};

export const getDiagnosticos = (params = {}) => api.get('/secretaria/diagnostico', { params });

export const updateDiagnostico = (id, diagnosticoData) => {
  const payload = {
    ...diagnosticoData,
    equipo_id: Number.parseInt(diagnosticoData.equipo_id, 10),
    cliente_id: Number.parseInt(diagnosticoData.cliente_id, 10),
    deja_cargador: diagnosticoData.deja_cargador === true || diagnosticoData.deja_cargador === 'true',
    enciende: diagnosticoData.enciende === true || diagnosticoData.enciende === 'true',
    usa_corriente_ac: diagnosticoData.usa_corriente_ac === true || diagnosticoData.usa_corriente_ac === 'true',
  };

  return api.put(`/secretaria/diagnostico/${id}`, payload);
};

export const updateEstadoDiagnostico = (id, nuevoEstado) =>
  api.patch(`/secretaria/diagnostico/${id}/estado`, { estado: nuevoEstado });
export const actualizarContacto = (id, data) => api.patch(`/secretaria/diagnostico/${id}/contacto`, data);
export const registrarRetiro = (id, data) => api.patch(`/secretaria/diagnostico/${id}/retiro`, data);
export const getHistorialDiagnostico = (id) => api.get(`/secretaria/diagnostico/${id}/historial`, { cache: false });
export const descargarDocumentoDiagnostico = (id) => api.get(`/secretaria/diagnostico/${id}/documento`, { responseType: 'blob' });
