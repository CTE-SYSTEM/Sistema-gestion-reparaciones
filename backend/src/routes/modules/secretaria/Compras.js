import express, { Router } from 'express';
import { getCompras, createCompra, updateCompra } from '../../../controllers/Secretaria/comprasController.js';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { descargarFotoCompra, listarFotosCompra, subirFotoCompra } from '../../../controllers/Secretaria/archivosCompraController.js';
import { photoBodyLimit } from '../../../utils/photoLimit.js';

const router = Router();

router.use(authMiddleware, requirePermission(PERMISSIONS.COMPRAS_GESTIONAR));
const photoBody = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: photoBodyLimit });

router.get('/fotos', listarFotosCompra);
router.get('/fotos/:id/contenido', descargarFotoCompra);
router.get('/:id/fotos', listarFotosCompra);
router.post('/:id/fotos', photoBody, subirFotoCompra);
router.get('/', getCompras);
router.post('/', createCompra);
router.put('/:id', updateCompra);

export default router;
