import { Router } from 'express';
import { getFacturas, createFactura, createFacturaDiagnostico, getDiagnosticosParaFacturar, getOrdenesParaFacturar, getTarifasFacturacion } from '../../../controllers/Secretaria/facturacionController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';

const router = Router();

router.use(authMiddleware, requirePermission(PERMISSIONS.FACTURAS_GESTIONAR));

router.get('/ordenes-disponibles', getOrdenesParaFacturar);
router.get('/diagnosticos-disponibles', getDiagnosticosParaFacturar);
router.get('/tarifas', getTarifasFacturacion);
router.post('/diagnosticos', createFacturaDiagnostico);
router.get('/', getFacturas);
router.post('/', createFactura);

export default router;
