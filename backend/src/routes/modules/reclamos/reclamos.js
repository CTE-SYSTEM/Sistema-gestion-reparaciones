import { Router } from 'express';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { analizarReclamo, cerrarReclamo, crearReclamo, decidirCobertura, listarReclamos } from '../../../controllers/reclamos/reclamosController.js';

const router = Router();
router.use(authMiddleware);
router.get('/', requirePermission(PERMISSIONS.RECLAMOS_VER), listarReclamos);
router.post('/', requirePermission(PERMISSIONS.RECLAMOS_CREAR), crearReclamo);
router.patch('/:id/analisis', requirePermission(PERMISSIONS.RECLAMOS_ANALIZAR), analizarReclamo);
router.patch('/:id/decision', requirePermission(PERMISSIONS.RECLAMOS_DECIDIR), decidirCobertura);
router.patch('/:id/cerrar', requirePermission(PERMISSIONS.RECLAMOS_ANALIZAR), cerrarReclamo);
export default router;
