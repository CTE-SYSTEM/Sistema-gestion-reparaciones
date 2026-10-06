import api from '../../../services/api';

export const repuestosJefeService = {
  getPendientesAprobacion: () => api.get('/diagnosticos/repuestos/pendientes-aprobacion'),
  aprobar: (id_detalle_repuesto) =>
    api.patch(`/diagnosticos/repuestos/${id_detalle_repuesto}/aprobar`),
  rechazar: (id_detalle_repuesto, motivo_rechazo) =>
    api.patch(`/diagnosticos/repuestos/${id_detalle_repuesto}/rechazar`, { motivo_rechazo }),
};

export default repuestosJefeService;
