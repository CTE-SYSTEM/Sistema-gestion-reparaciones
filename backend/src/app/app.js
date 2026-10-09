import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from '../config/env.js';
import {
  errorHandler,
  notFoundHandler,
  requestId,
  securityHeaders,
} from '../middlewares/securityMiddleware.js';

import authRoutes from '../routes/auth/auth.js';
import clientesRoutes from '../routes/modules/recepcion/Clientes.js';
import tecnicosRoutes from '../routes/modules/Tecnico/tecnicos.js';
import equiposRoutes from '../routes/modules/recepcion/Equipos.js';
import createOrden from '../routes/modules/servicioCliente/NuevaOrden.js';
import contactoServicioClienteRoutes from '../routes/modules/servicioCliente/Contacto.js';
import repuestosRoutes from '../routes/modules/bodega/Repuesto.js';
import tiposRepuestoRoutes from '../routes/modules/bodega/TipoRepuesto.js';
import proveedoresRoutes from '../routes/modules/bodega/Proveedores.js';
import comprasRoutes from '../routes/modules/bodega/Compras.js';
import trazabilidadRoutes from '../routes/modules/bodega/Trazabilidad.js';
import bodegaResumenRoutes from '../routes/modules/bodega/Resumen.js';
import bodegaInventarioRoutes from '../routes/modules/bodega/Inventario.js';
import facturasRoutes from '../routes/modules/contabilidad/facturas.js';
import movimientosRoutes from '../routes/modules/contabilidad/movimientos.js';
import contabilidadResumenRoutes from '../routes/modules/contabilidad/resumen.js';
import garantiasRoutes from '../routes/modules/garantias/garantias.js';
import reclamosRoutes from '../routes/modules/reclamos/reclamos.js';
import diagnosticoRoutes from '../routes/modules/recepcion/Diagnostico.js';
import secretariaDashboardRoutes from '../routes/modules/secretaria/Dashboard.js';
import archivosServicioRoutes from '../routes/modules/servicios/ArchivosServicio.js';
import diagnosticoRoutesJefe from '../routes/modules/JefeTecnico/Diagnostico.js';
import supervisionRoutes from '../routes/modules/JefeTecnico/Supervision.js';
import adminProRoutes from '../routes/modules/admin_pro/adminPro.js';
import flujoAtencionRoutes from '../routes/modules/recepcion/FlujoAtencion.js';
import reportesIntegralesRoutes from '../routes/modules/secretaria/Reportes.js';
import calidadRoutes from '../routes/modules/calidad/ordenes.js';
import healthRoutes from '../routes/health.js';
import notificacionesRoutes from '../routes/modules/notificaciones.js';
import photoTransferRoutes from '../routes/modules/photoTransfer.js';
import photoTransferRemoteRoutes from '../routes/modules/photoTransferRemote.js';
import internalBackupRoutes from '../routes/internalBackup.js';
import { isBackupRestoreInProgress } from '../services/backupRestoreService.js';

const app = express();

app.disable('x-powered-by');
app.use(requestId);
app.use(securityHeaders);
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

app.use(cors({
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(Object.assign(new Error(`CORS blocked origin: ${origin}`), { status: 403 }));
  },
  credentials: true,
}));

app.use(express.json({ limit: env.requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.requestBodyLimit }));

app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

app.use('/api', (req, res, next) => {
  if (isBackupRestoreInProgress()) return res.status(503).json({ error: 'Se está restaurando la base de datos. Intente de nuevo en unos minutos.' });
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/tecnicos', tecnicosRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/ordenes', createOrden);
app.use('/api/servicio-cliente/diagnostico', contactoServicioClienteRoutes);
app.use('/api/repuestos', repuestosRoutes);
app.use('/api/tipos-repuesto', tiposRepuestoRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/bodega/trazabilidad', trazabilidadRoutes);
app.use('/api/bodega/inventario', bodegaInventarioRoutes);
app.use('/api/bodega', bodegaResumenRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/contabilidad/movimientos', movimientosRoutes);
app.use('/api/contabilidad/resumen', contabilidadResumenRoutes);
app.use('/api/garantias', garantiasRoutes);
app.use('/api/reclamos', reclamosRoutes);
app.use('/api/secretaria/dashboard', secretariaDashboardRoutes);
app.use('/api/secretaria/reportes', reportesIntegralesRoutes);
app.use('/api/archivos-servicio', archivosServicioRoutes);
app.use('/api/secretaria/diagnostico', diagnosticoRoutes);
app.use('/api/recepcion/diagnostico', diagnosticoRoutes);
app.use('/api/diagnosticos', diagnosticoRoutesJefe);
app.use('/api/jefe-tecnico', supervisionRoutes);
app.use('/api/admin_pro', adminProRoutes);
app.use('/api/flujo-atencion', flujoAtencionRoutes);
app.use('/api/calidad', calidadRoutes);
app.use('/api/photo-transfer', process.env.VERCEL === '1' ? photoTransferRemoteRoutes : photoTransferRoutes);
app.use('/api/internal', internalBackupRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'SGR Backend',
    status: 'running',
    health: '/health',
    api: '/api',
    allowedOrigins: env.allowedOrigins,
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
