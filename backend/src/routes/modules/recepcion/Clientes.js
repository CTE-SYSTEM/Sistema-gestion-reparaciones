// backend/src/routes/modules/secretaria/Clientes.js
import { Router } from 'express';
import { getClientes, createCliente, updateCliente, deleteCliente } from '../../../controllers/recepcion/clientesController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS, requireAnyPermission } from '../../../utils/permissions.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requireAnyPermission(PERMISSIONS.CLIENTES_GESTIONAR, PERMISSIONS.ORDENES_GESTIONAR), getClientes);
router.post('/', requirePermission(PERMISSIONS.CLIENTES_GESTIONAR), createCliente);
router.put('/:id', requirePermission(PERMISSIONS.CLIENTES_GESTIONAR), updateCliente);
router.delete('/:id', requirePermission(PERMISSIONS.CLIENTES_GESTIONAR), deleteCliente);

export default router;
