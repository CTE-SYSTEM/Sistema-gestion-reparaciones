import { Router } from 'express';
import {
  actualizarDiagnosticoAsignado,
  iniciarDiagnosticoAsignado,
  actualizarEstadoOrden,
  corregirCierre,
  createTecnico,
  getMisDiagnosticos,
  getMisOrdenes,
  getTecnicos,
  solicitarRepuesto,
} from '../../../controllers/Tecnico/tecnicosController.js';
import authMiddleware, { requireRole } from '../../../middlewares/authMiddleware.js';
import { getResumenTecnico, getSolicitudesTecnico, getCatalogoTecnico, getDetalleTecnico, postAvanceTecnico, putBorradorTecnico,
  patchDiagnosticoTecnico, patchAvanceTecnico, patchIrreparableTecnico, patchSolicitudTecnico } from '../../../controllers/Tecnico/tecnicosController.js';

const router = Router();

router.use(authMiddleware);
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/resumen', requireRole('Tecnico'), getResumenTecnico);
router.get('/solicitudes', requireRole('Tecnico'), getSolicitudesTecnico);
router.get('/catalogo', requireRole('Tecnico'), getCatalogoTecnico);
router.get('/diagnosticos/:id', requireRole('Tecnico'), getDetalleTecnico('diagnostico'));
router.get('/ordenes/:id', requireRole('Tecnico'), getDetalleTecnico('orden'));
router.put('/diagnosticos/:id/borrador', requireRole('Tecnico'), putBorradorTecnico);
router.post('/diagnosticos/:id/avances', requireRole('Tecnico'), postAvanceTecnico('diagnostico'));
router.post('/ordenes/:id/avances', requireRole('Tecnico'), postAvanceTecnico('orden'));
router.patch('/diagnosticos/:id/correccion', requireRole('Tecnico'), patchDiagnosticoTecnico);
router.patch('/diagnosticos/:id/avances/:avanceId', requireRole('Tecnico'), patchAvanceTecnico('diagnostico'));
router.patch('/ordenes/:id/avances/:avanceId', requireRole('Tecnico'), patchAvanceTecnico('orden'));
router.patch('/ordenes/:id/irreparable', requireRole('Tecnico'), patchIrreparableTecnico);
router.patch('/solicitudes/:id', requireRole('Tecnico'), patchSolicitudTecnico);

router.get('/', requireRole('Secretaria', 'Recepcion', 'ServicioCliente', 'TecnicoJefe', 'Administrador', 'admin_pro'), getTecnicos);
router.get('/mis-diagnosticos/:username', requireRole('Tecnico'), getMisDiagnosticos);
router.get('/mis-ordenes/:username', requireRole('Tecnico'), getMisOrdenes);
router.put('/diagnosticos/:id', requireRole('Tecnico'), actualizarDiagnosticoAsignado);
router.patch('/diagnosticos/:id/iniciar', requireRole('Tecnico'), iniciarDiagnosticoAsignado);
router.patch('/ordenes/:id/estado', requireRole('Tecnico'), actualizarEstadoOrden);
router.patch('/ordenes/:id/correccion-cierre', requireRole('Tecnico'), corregirCierre);
router.post('/ordenes/:id/repuestos', requireRole('Tecnico'), solicitarRepuesto);
router.post('/', requireRole('Secretaria', 'Administrador', 'admin_pro'), createTecnico);

export default router;
