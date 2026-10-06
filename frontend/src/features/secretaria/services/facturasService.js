import api from '../../../services/api';

export const getFacturas = (params = {}) => api.get('/facturas', { params });
export const getOrdenesParaFacturar = () => api.get('/facturas/ordenes-disponibles');
export const getDiagnosticosParaFacturar = () => api.get('/facturas/diagnosticos-disponibles');
export const getTarifasFacturacion = () => api.get('/facturas/tarifas');
export const createFactura = (data) => api.post('/facturas', data);
export const createFacturaDiagnostico = (data) => api.post('/facturas/diagnosticos', data);
