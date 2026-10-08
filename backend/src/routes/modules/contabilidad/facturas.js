import { Router } from 'express';
import { getFacturas, createFactura, createFacturaDiagnostico, getDiagnosticosParaFacturar, getOrdenesParaFacturar, getTarifasFacturacion } from '../../../controllers/contabilidad/facturacionController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS, hasPermission } from '../../../utils/permissions.js';
import { consultarSaldo } from '../../../controllers/contabilidad/movimientosController.js';

const router = Router();

router.use(authMiddleware);
router.get('/', (req, res, next) => {
  if (!hasPermission(req.user.rol, PERMISSIONS.FACTURAS_VER)) return res.status(403).json({ error: 'No autorizado para esta accion' });
  next();
}, getFacturas);
router.get('/:id/saldo', requirePermission(PERMISSIONS.FACTURAS_VER), consultarSaldo);
router.use(requirePermission(PERMISSIONS.FACTURAS_GESTIONAR));

router.get('/ordenes-disponibles', getOrdenesParaFacturar);
router.get('/diagnosticos-disponibles', getDiagnosticosParaFacturar);
router.get('/tarifas', getTarifasFacturacion);
router.post('/diagnosticos', createFacturaDiagnostico);
router.post('/', createFactura);

export default router;
