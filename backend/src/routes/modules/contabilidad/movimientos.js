import { Router } from 'express';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { consultarSaldo, crearMovimiento, listarMovimientos } from '../../../controllers/contabilidad/movimientosController.js';

const router = Router();
router.use(authMiddleware, requirePermission(PERMISSIONS.CONTABILIDAD_MOVIMIENTOS));
router.get('/', listarMovimientos);
router.get('/facturas/:id/saldo', consultarSaldo);
router.post('/', crearMovimiento);
export default router;
