import { Router } from 'express';
import {
  createTipoRepuesto,
  deleteTipoRepuesto,
  getTiposRepuesto,
  updateTipoRepuesto,
} from '../../../controllers/bodega/tipoRepuestoController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';

const router = Router();

router.use(authMiddleware, requirePermission(PERMISSIONS.REPUESTOS_GESTIONAR));

router.get('/', getTiposRepuesto);
router.post('/', createTipoRepuesto);
router.put('/:id', updateTipoRepuesto);
router.delete('/:id', deleteTipoRepuesto);

export default router;
