// routes/equipos.js
// backend/src/routes/modules/secretaria/Equipos.js
import { Router } from 'express';
const router = Router();
// No olvides el .js al final del import
import { getEquipos, createEquipo, updateEquipo, deleteEquipo } from '../../../controllers/recepcion/equiposController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS, requireAnyPermission } from '../../../utils/permissions.js';

router.use(authMiddleware);

router.get('/', requireAnyPermission(PERMISSIONS.EQUIPOS_GESTIONAR, PERMISSIONS.ORDENES_GESTIONAR), getEquipos);
router.post('/', requirePermission(PERMISSIONS.EQUIPOS_GESTIONAR), createEquipo);
router.put('/:id', requirePermission(PERMISSIONS.EQUIPOS_GESTIONAR), updateEquipo);
router.delete('/:id', requirePermission(PERMISSIONS.EQUIPOS_GESTIONAR), deleteEquipo);

export default router;
