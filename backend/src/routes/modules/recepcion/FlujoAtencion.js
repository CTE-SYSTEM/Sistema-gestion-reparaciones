import { Router } from 'express';
import { getFlujoAtencion } from '../../../controllers/recepcion/flujoAtencionController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';

const router = Router();

router.use(authMiddleware, requirePermission(PERMISSIONS.FLUJO_VER));
router.get('/', getFlujoAtencion);

export default router;
