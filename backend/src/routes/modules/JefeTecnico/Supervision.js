import { Router } from 'express';
import authMiddleware from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS as P, requirePermission as permission } from '../../../utils/permissions.js';
import * as controller from '../../../controllers/JefeTecnico/supervisionController.js';

const router = Router();
router.use(authMiddleware, permission(P.JEFE_TECNICO_VER));
router.get('/resumen', controller.getResumen);
router.patch('/tecnicos/:id/disponibilidad', permission(P.JEFE_TECNICO_EQUIPO), controller.actualizarDisponibilidad);
for (const [path, tipo] of [['diagnosticos', 'diagnostico'], ['ordenes', 'orden']]) {
  router.get(`/${path}/:id`, controller.getDetalle(tipo));
  router.post(`/${path}/:id/asignacion`, permission(P.JEFE_TECNICO_ASIGNAR), controller.asignarTrabajo(tipo));
  router.patch(`/${path}/:id/prioridad`, permission(P.JEFE_TECNICO_PRIORIDAD), controller.cambiarPrioridad(tipo));
  router.post(`/${path}/:id/intervencion`, permission(P.JEFE_TECNICO_INTERVENIR), controller.intervenirTrabajo(tipo));
}
router.patch('/ordenes/:id/irreparable', permission(P.JEFE_TECNICO_APROBAR), controller.revisarIrreparable);
for (const action of ['aprobar', 'rechazar', 'corregir', 'entregar']) {
  router.patch(`/repuestos/:id/${action}`, permission(action === 'entregar' ? P.REPUESTOS_ENTREGAR : P.JEFE_TECNICO_APROBAR), controller.procesarRepuesto(action));
}
for (const action of ['retirar-aprobacion', 'reabrir', 'corregir-entrega', 'devolver']) {
  router.patch(`/repuestos/:id/${action}`, permission(P.JEFE_TECNICO_INTERVENIR),
    ...(['corregir-entrega', 'devolver'].includes(action) ? [permission(P.REPUESTOS_ENTREGAR)] : []), controller.procesarRepuesto(action));
}
export default router;
