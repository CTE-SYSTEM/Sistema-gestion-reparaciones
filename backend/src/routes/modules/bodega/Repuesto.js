// backend/src/routes/modules/secretaria/Repuesto.js
import { Router } from 'express';
import { 
  getRepuestos, 
  createRepuesto, 
  updateRepuesto, 
  deleteRepuesto 
} from '../../../controllers/bodega/repuestoController.js';
import authMiddleware, { requireRole, requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';

const router = Router();

router.use(authMiddleware);

const allowedRoles = requireRole('Secretaria', 'Bodega', 'Tecnico', 'TecnicoJefe', 'Administrador', 'admin_pro');

router.get('/', allowedRoles, getRepuestos);
router.post('/', requirePermission(PERMISSIONS.REPUESTOS_GESTIONAR), createRepuesto);
router.put('/:id', requirePermission(PERMISSIONS.REPUESTOS_GESTIONAR), updateRepuesto);
router.delete('/:id', requirePermission(PERMISSIONS.REPUESTOS_GESTIONAR), deleteRepuesto);

export default router;
