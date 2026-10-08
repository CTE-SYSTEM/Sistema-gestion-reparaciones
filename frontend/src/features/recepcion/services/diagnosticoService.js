// Servicios de recepción y seguimiento del diagnóstico.
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

  return api.post('/recepcion/diagnostico/create', payload);
};

export const getDiagnosticos = (params = {}) => api.get('/recepcion/diagnostico', { params });

export const updateDiagnostico = (id, diagnosticoData) => {
  const payload = {
    ...diagnosticoData,
    equipo_id: Number.parseInt(diagnosticoData.equipo_id, 10),
    cliente_id: Number.parseInt(diagnosticoData.cliente_id, 10),
    deja_cargador: diagnosticoData.deja_cargador === true || diagnosticoData.deja_cargador === 'true',
    enciende: diagnosticoData.enciende === true || diagnosticoData.enciende === 'true',
    usa_corriente_ac: diagnosticoData.usa_corriente_ac === true || diagnosticoData.usa_corriente_ac === 'true',
  };

  return api.put(`/recepcion/diagnostico/${id}`, payload);
};

export const updateEstadoDiagnostico = (id, nuevoEstado) =>
  api.patch(`/recepcion/diagnostico/${id}/estado`, { estado: nuevoEstado });
export const actualizarContacto = (id, data) => api.patch(`/recepcion/diagnostico/${id}/contacto`, data);
export const registrarRetiro = (id, data) => api.patch(`/recepcion/diagnostico/${id}/retiro`, data);
export const getHistorialDiagnostico = (id) => api.get(`/recepcion/diagnostico/${id}/historial`, { cache: false });
export const descargarDocumentoDiagnostico = (id) => api.get(`/recepcion/diagnostico/${id}/documento`, { responseType: 'blob' });
