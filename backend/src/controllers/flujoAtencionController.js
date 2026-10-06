import flujoAtencionService from '../services/flujoAtencionService.js';

export const getFlujoAtencion = async (req, res) => {
  try {
    const result = await flujoAtencionService.obtenerFlujoAtencion({
      filtro: req.query.filtro || 'todos',
      search: req.query.search || '',
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.json(result);
  } catch (error) {
    console.error('Error al obtener flujo de atencion:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Error al obtener flujo de atencion', ...(error.statusCode ? {} : { details: error.message }) });
  }
};

export default {
  getFlujoAtencion,
};
