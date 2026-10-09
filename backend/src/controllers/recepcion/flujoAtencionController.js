import flujoAtencionService from '../../services/recepcion/flujoAtencionService.js';

export const getFlujoAtencion = async (req, res) => {
  try {
    const result = await flujoAtencionService.obtenerFlujoAtencion({
      filtro: req.query.filtro || 'todos',
      search: req.query.search || '',
      page: req.query.page,
      pageSize: req.query.pageSize,
      customerOnly: req.user.rol === 'ServicioCliente',
    });
    res.json(result);
  } catch (error) {
    console.error('Error al obtener flujo de atencion:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Error al obtener flujo de atencion', ...(error.statusCode ? {} : { details: error.message }) });
  }
};

export const getResumenRecepcion = async (_req, res) => {
  try {
    res.json({ data: await flujoAtencionService.obtenerResumenRecepcion() });
  } catch (error) {
    console.error('Error al obtener resumen de recepción:', error);
    res.status(500).json({ error: 'No se pudo cargar el resumen de recepción.' });
  }
};

export default {
  getFlujoAtencion,
  getResumenRecepcion,
};
