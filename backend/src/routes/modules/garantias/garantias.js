import { Router } from 'express';
import { getGarantias, createGarantia } from '../../../controllers/garantias/garantiasController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission(PERMISSIONS.GARANTIAS_VER), getGarantias);
router.post('/', requirePermission(PERMISSIONS.GARANTIAS_GESTIONAR), createGarantia);

export default router;
