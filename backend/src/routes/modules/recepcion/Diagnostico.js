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
import authMiddleware, { requirePermission, requireRole } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS, requireAnyPermission } from '../../../utils/permissions.js';
import { normalizeRole } from '../../../utils/roles.js';
import { descargarDocumentoDiagnostico, getHistorialDiagnostico, registrarContacto, registrarRetiroSinReparar } from '../../../controllers/servicioCliente/flujoServicioController.js';

// Montada en /api/recepcion/diagnostico y en el alias heredado /api/secretaria/diagnostico.
// --------------------------------------------------
router.use(authMiddleware);
const gestionar = requirePermission(PERMISSIONS.DIAGNOSTICOS_GESTIONAR);
const consultar = requireAnyPermission(PERMISSIONS.DIAGNOSTICOS_GESTIONAR, PERMISSIONS.DIAGNOSTICOS_ATENDER);
const atender = requirePermission(PERMISSIONS.DIAGNOSTICOS_ATENDER);
const soloIngreso = (req, res, next) => {
    if (normalizeRole(req.user.rol) !== 'recepcion') return next();
    const body = req.body || {};
    const camposTecnicos = ['tecnico_id', 'diagnostico_real', 'presupuesto_estimado', 'moneda_presupuesto', 'Estado_aprobacion', 'estado_del_diagnostico'];
    if (camposTecnicos.some((campo) => body[campo] !== undefined)
        || (body.estado && !['INGRESADO', 'PENDIENTE'].includes(body.estado))) {
        return res.status(403).json({ error: 'Recepción solo puede registrar datos de ingreso' });
    }
    return next();
};

// POST /create -> Para crear uno nuevo
router.post('/create', gestionar, soloIngreso, createDiagnostico);

// GET / -> Para listar todos
router.get('/', consultar, getDiagnosticos);
router.get('/:id/documento', consultar, descargarDocumentoDiagnostico);
router.get('/:id/historial', consultar, getHistorialDiagnostico);
router.patch('/:id/contacto', atender, registrarContacto);
router.patch('/:id/retiro', atender, registrarRetiroSinReparar);

router.patch('/:id/estado', gestionar, requireRole('Secretaria', 'Administrador', 'admin_pro', 'Admin'), updateEstadoDiagnostico);

// PUT /:id -> Para actualizar el diagnóstico completo
router.put('/:id', gestionar, soloIngreso, updateDiagnostico);

export default router;
