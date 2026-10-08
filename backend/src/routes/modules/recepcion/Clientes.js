// backend/src/routes/modules/secretaria/Clientes.js
import { Router } from 'express';
import { getClientes, createCliente, updateCliente, deleteCliente } from '../../../controllers/recepcion/clientesController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';

const router = Router();

router.use(authMiddleware, requirePermission(PERMISSIONS.CLIENTES_GESTIONAR));

router.get('/', getClientes);
router.post('/', createCliente);
router.put('/:id', updateCliente);
router.delete('/:id', deleteCliente);

export default router;
