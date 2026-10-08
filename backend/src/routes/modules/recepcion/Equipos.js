// routes/equipos.js
// backend/src/routes/modules/secretaria/Equipos.js
import { Router } from 'express';
const router = Router();
// No olvides el .js al final del import
import { getEquipos, createEquipo, updateEquipo, deleteEquipo } from '../../../controllers/recepcion/equiposController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';

router.use(authMiddleware, requirePermission(PERMISSIONS.EQUIPOS_GESTIONAR));

router.get('/', getEquipos);
router.post('/', createEquipo);
router.put('/:id', updateEquipo);
router.delete('/:id', deleteEquipo);

export default router;
