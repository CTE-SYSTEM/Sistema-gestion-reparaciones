import { Router } from 'express';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import {
  descargarDocumentoDiagnostico,
  getHistorialDiagnostico,
  registrarContacto,
  registrarRetiroSinReparar,
} from '../../../controllers/servicioCliente/flujoServicioController.js';

const router = Router();
router.use(authMiddleware, requirePermission(PERMISSIONS.DIAGNOSTICOS_ATENDER));
router.get('/:id/documento', descargarDocumentoDiagnostico);
router.get('/:id/historial', getHistorialDiagnostico);
router.patch('/:id/contacto', registrarContacto);
router.patch('/:id/retiro', registrarRetiroSinReparar);

export default router;
