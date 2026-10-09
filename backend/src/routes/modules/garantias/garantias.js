import { Router } from 'express';
import { getGarantias, createGarantia, revalidarGarantia } from '../../../controllers/garantias/garantiasController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { getBusinessSettings } from '../../../services/adminSettingsService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission(PERMISSIONS.GARANTIAS_VER), getGarantias);
router.get('/politica', requirePermission(PERMISSIONS.GARANTIAS_VER), async (_req, res, next) => {
  try { const { negocio } = await getBusinessSettings(); res.json({ data: { meses: negocio.garantia_meses, condiciones: negocio.garantia_condiciones } }); }
  catch (error) { next(error); }
});
router.post('/', requirePermission(PERMISSIONS.GARANTIAS_GESTIONAR), createGarantia);
router.patch('/:id/revalidar', requirePermission(PERMISSIONS.GARANTIAS_GESTIONAR), revalidarGarantia);

export default router;
