import express from 'express';
import authMiddleware from '../../../middlewares/authMiddleware.js';
import { autorizarArchivos, autorizarContenido, descargarArchivo, galeriaServicio, listarArchivos, subirArchivo, revisarVisibilidadTecnica } from '../../../controllers/servicios/archivosServicioController.js';
import { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { photoBodyLimit } from '../../../utils/photoLimit.js';

const router = express.Router();
const photoBody = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: photoBodyLimit });
router.use(authMiddleware);
router.get('/galeria', requirePermission(PERMISSIONS.DIAGNOSTICOS_GESTIONAR), galeriaServicio);
router.get('/diagnosticos/:id', autorizarArchivos('diagnostico'), listarArchivos('diagnostico'));
router.post('/diagnosticos/:id', autorizarArchivos('diagnostico'), photoBody, subirArchivo('diagnostico'));
router.get('/ordenes/:id', autorizarArchivos('orden'), listarArchivos('orden'));
router.post('/ordenes/:id', autorizarArchivos('orden'), photoBody, subirArchivo('orden'));
router.get('/:id/contenido', autorizarContenido, descargarArchivo);
router.patch('/:id/visibilidad-tecnica', revisarVisibilidadTecnica);
export default router;
