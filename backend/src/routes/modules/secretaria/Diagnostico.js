// backend/src/routes/modules/secretaria/Diagnostico.js
import express from 'express';
const router = express.Router();

// Importamos todas las funciones necesarias del controlador
// Asegurate de que los nombres coincidan con lo que hay en diagnosticoController.js
import { 
    createDiagnostico, 
    getDiagnosticos, 
    updateDiagnostico,
    updateEstadoDiagnostico
} from '../../../controllers/Secretaria/diagnosticoController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { descargarDocumentoDiagnostico, getHistorialDiagnostico, registrarContacto, registrarRetiroSinReparar } from '../../../controllers/Secretaria/flujoServicioController.js';

// Rutas configuradas para /api/secretaria/diagnostico
// --------------------------------------------------
router.use(authMiddleware, requirePermission(PERMISSIONS.DIAGNOSTICOS_GESTIONAR));

// POST /api/secretaria/diagnostico/create -> Para crear uno nuevo
router.post('/create', createDiagnostico);

// GET /api/secretaria/diagnostico -> Para listar todos (SOLUCIONA EL 404)
router.get('/', getDiagnosticos);
router.get('/:id/documento', descargarDocumentoDiagnostico);
router.get('/:id/historial', getHistorialDiagnostico);
router.patch('/:id/contacto', registrarContacto);
router.patch('/:id/retiro', registrarRetiroSinReparar);

router.patch('/:id/estado', updateEstadoDiagnostico);

// PUT /api/secretaria/diagnostico/:id -> Para actualizar el diagnóstico completo
router.put('/:id', updateDiagnostico);

export default router;
