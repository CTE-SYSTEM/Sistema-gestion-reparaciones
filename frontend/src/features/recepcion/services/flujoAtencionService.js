import api from '../../../services/api';

export const getFlujoAtencion = ({ filtro = 'todos', search = '', page = 1, pageSize = 20 } = {}) =>
  api.get('/flujo-atencion', { params: { filtro, search, page, pageSize } });

export const getResumenRecepcion = () => api.get('/flujo-atencion/resumen-recepcion');

export default {
  getFlujoAtencion,
  getResumenRecepcion,
};
