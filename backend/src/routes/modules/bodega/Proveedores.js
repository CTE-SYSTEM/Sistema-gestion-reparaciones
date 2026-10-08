// backend/src/routes/modules/secretaria/Proveedores.js
import { Router } from 'express';
import { 
  getProveedores, 
  createProveedor, 
  updateProveedor, 
  deleteProveedor 
} from '../../../controllers/bodega/proveedoresController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';

const router = Router();

router.use(authMiddleware, requirePermission(PERMISSIONS.PROVEEDORES_GESTIONAR));

router.get('/', getProveedores);
router.post('/', createProveedor);
router.put('/:id', updateProveedor);
router.delete('/:id', deleteProveedor);

export default router;
