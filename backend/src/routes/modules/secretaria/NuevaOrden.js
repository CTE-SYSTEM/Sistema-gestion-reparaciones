// backend/src/routes/modules/secretaria/NuevaOrden.js
import express from 'express';
const router = express.Router();
import {
  createOrden,
  createOrdenDirecta,
  deleteOrden,
  getDiagnosticosListosParaOrden,
  getOrdenes,
  updateOrden,
} from '../../../controllers/Secretaria/nuevaOrdenController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { cancelarOrden, getHistorialOrden, registrarEntregaOrden } from '../../../controllers/Secretaria/flujoServicioController.js';

router.use(authMiddleware, requirePermission(PERMISSIONS.ORDENES_GESTIONAR));

router.get('/diagnosticos-listos', getDiagnosticosListosParaOrden);
router.post('/directa', createOrdenDirecta);
router.get('/:id/historial', getHistorialOrden);
router.patch('/:id/entrega', registrarEntregaOrden);
router.patch('/:id/cancelar', cancelarOrden);
router.get('/', getOrdenes);
router.post('/', createOrden);
router.post('/create', createOrden);
router.put('/:id', updateOrden);
router.delete('/:id', deleteOrden);

export default router;
