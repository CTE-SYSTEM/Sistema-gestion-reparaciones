// para dashboard secretaria
// backend/src/routes/modules/secretaria/Secretaria.js
import express from 'express';
const router = express.Router();

// Importamos las rutas específicas de Secretaría
import clientesRoutes from '../recepcion/Clientes.js';
import equiposRoutes from '../recepcion/Equipos.js';
import comprasRoutes from '../bodega/Compras.js';
import facturasRoutes from '../contabilidad/facturas.js';
import garantiasRoutes from '../garantias/garantias.js';
import diagnosticoRoutes from '../recepcion/Diagnostico.js';
import NuevaOrden from '../recepcion/NuevaOrden.js';

// Usamos las rutas específicas de Secretaría
router.use('/clientes', clientesRoutes);
router.use('/equipos', equiposRoutes);
router.use('/NuevaOrden', NuevaOrden);
router.use('/compras', comprasRoutes);
router.use('/facturas', facturasRoutes);
router.use('/garantias', garantiasRoutes);
router.use('/diagnostico', diagnosticoRoutes);

export default router;
