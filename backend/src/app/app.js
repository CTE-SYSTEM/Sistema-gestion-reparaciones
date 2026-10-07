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
import clientesRoutes from '../routes/modules/secretaria/Clientes.js';
import tecnicosRoutes from '../routes/modules/Tecnico/tecnicos.js';
import equiposRoutes from '../routes/modules/secretaria/Equipos.js';
import createOrden from '../routes/modules/secretaria/NuevaOrden.js';
import repuestosRoutes from '../routes/modules/secretaria/Repuesto.js';
import tiposRepuestoRoutes from '../routes/modules/secretaria/TipoRepuesto.js';
import proveedoresRoutes from '../routes/modules/secretaria/Proveedores.js';
import comprasRoutes from '../routes/modules/secretaria/Compras.js';
import facturasRoutes from '../routes/modules/secretaria/facturas.js';
import garantiasRoutes from '../routes/modules/secretaria/garantias.js';
import diagnosticoRoutes from '../routes/modules/secretaria/Diagnostico.js';
import secretariaDashboardRoutes from '../routes/modules/secretaria/Dashboard.js';
import archivosServicioRoutes from '../routes/modules/secretaria/ArchivosServicio.js';
import diagnosticoRoutesJefe from '../routes/modules/JefeTecnico/Diagnostico.js';
import supervisionRoutes from '../routes/modules/JefeTecnico/Supervision.js';
import adminProRoutes from '../routes/modules/admin_pro/adminPro.js';
import flujoAtencionRoutes from '../routes/modules/flujoAtencion.js';
import healthRoutes from '../routes/health.js';
import notificacionesRoutes from '../routes/modules/notificaciones.js';
import photoTransferRoutes from '../routes/modules/photoTransfer.js';
import photoTransferRemoteRoutes from '../routes/modules/photoTransferRemote.js';
import internalBackupRoutes from '../routes/internalBackup.js';

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

app.use('/api/auth', authRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/tecnicos', tecnicosRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/ordenes', createOrden);
app.use('/api/repuestos', repuestosRoutes);
app.use('/api/tipos-repuesto', tiposRepuestoRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/garantias', garantiasRoutes);
app.use('/api/secretaria/dashboard', secretariaDashboardRoutes);
app.use('/api/archivos-servicio', archivosServicioRoutes);
app.use('/api/secretaria/diagnostico', diagnosticoRoutes);
app.use('/api/diagnosticos', diagnosticoRoutesJefe);
app.use('/api/jefe-tecnico', supervisionRoutes);
app.use('/api/admin_pro', adminProRoutes);
app.use('/api/flujo-atencion', flujoAtencionRoutes);
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
