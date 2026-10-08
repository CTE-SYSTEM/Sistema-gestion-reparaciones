import api from '../../../services/api';

export const getFlujoAtencion = ({ filtro = 'todos', search = '', page = 1, pageSize = 50 } = {}) =>
  api.get('/flujo-atencion', { params: { filtro, search, page, pageSize } });

export default {
  getFlujoAtencion,
};
