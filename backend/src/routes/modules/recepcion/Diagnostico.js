// backend/src/routes/modules/recepcion/Diagnostico.js
import express from 'express';
const router = express.Router();

// Importamos todas las funciones necesarias del controlador
// Asegurate de que los nombres coincidan con lo que hay en diagnosticoController.js
import { 
    createDiagnostico, 
    getDiagnosticos, 
    updateDiagnostico,
    updateEstadoDiagnostico
} from '../../../controllers/recepcion/diagnosticoController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { descargarDocumentoDiagnostico, getHistorialDiagnostico, registrarContacto, registrarRetiroSinReparar } from '../../../controllers/recepcion/flujoServicioController.js';

// Montada en /api/recepcion/diagnostico y en el alias heredado /api/secretaria/diagnostico.
// --------------------------------------------------
router.use(authMiddleware, requirePermission(PERMISSIONS.DIAGNOSTICOS_GESTIONAR));

// POST /create -> Para crear uno nuevo
router.post('/create', createDiagnostico);

// GET / -> Para listar todos
router.get('/', getDiagnosticos);
router.get('/:id/documento', descargarDocumentoDiagnostico);
router.get('/:id/historial', getHistorialDiagnostico);
router.patch('/:id/contacto', registrarContacto);
router.patch('/:id/retiro', registrarRetiroSinReparar);

router.patch('/:id/estado', updateEstadoDiagnostico);

// PUT /:id -> Para actualizar el diagnóstico completo
router.put('/:id', updateDiagnostico);

export default router;
