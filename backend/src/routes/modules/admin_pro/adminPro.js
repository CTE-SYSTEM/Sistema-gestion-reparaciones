import { Router } from 'express';
import authMiddleware from '../../../middlewares/authMiddleware.js';
import { onlyAdminPro } from '../../../controllers/admin_pro/accessController.js';
import { getEquiposAvanzado, getEquipoUltimoDiagnostico, updateEquipoAdmin } from '../../../controllers/admin_pro/equiposController.js';
import { getRepuestosAvanzado, updateRepuestoAdmin } from '../../../controllers/admin_pro/repuestosController.js';
import {
  getOrdenesAvanzado,
  updateOrdenAdmin,
  getRepuestosPorOrdenAdmin,
  downloadRepuestosPorOrdenAdmin,
} from '../../../controllers/admin_pro/ordenesController.js';
import { getFacturasAvanzado } from '../../../controllers/admin_pro/facturasController.js';
import {
  getGarantiasAdmin,
  createGarantiaAdmin,
  updateGarantiaAdmin,
  renewGarantiaAdmin,
} from '../../../controllers/admin_pro/garantiasController.js';
import {
  getUsuarios,
  createUsuario,
  updateUsuario,
  updateUsuarioPassword,
  deleteUsuario,
} from '../../../controllers/admin_pro/usuariosController.js';
import { getMonitoreoGeneral, getDashboardResumen } from '../../../controllers/admin_pro/dashboardController.js';
import { getBackups, triggerBackupNow, downloadBackupFile, verifyBackupFiles } from '../../../controllers/admin_pro/backupController.js';
import {
  downloadDiagnosticosReporteAdmin,
  getDiagnosticosAdmin,
  updateDiagnosticoAdmin,
  updateDiagnosticoEstadoAdmin,
} from '../../../controllers/admin_pro/diagnosticosController.js';
import { getHistorialEquipo, getHistorialRepuesto } from '../../../controllers/admin_pro/historialController.js';
import { getReporteAdminPro, getReportCatalog, downloadReportExcel, getReportOptions } from '../../../controllers/admin_pro/reportesController.js';
import { getMyAccount, updateMyAccount, changeMyPassword, revokeMySessions, getConfiguration,
  updateConfiguration, getBusinessRules, getAudit } from '../../../controllers/admin_pro/administracionController.js';
import { getGananciasAdmin, getProductividadAdmin } from '../../../controllers/admin_pro/analiticaController.js';

const router = Router();

router.use(authMiddleware);
router.use(onlyAdminPro);

router.get('/mi-cuenta', getMyAccount);
router.put('/mi-cuenta', updateMyAccount);
router.put('/mi-cuenta/password', changeMyPassword);
router.post('/mi-cuenta/cerrar-sesiones', revokeMySessions);
router.get('/configuracion', getConfiguration);
router.put('/configuracion', updateConfiguration);
router.get('/reglas', getBusinessRules);
router.get('/auditoria', getAudit);

router.get('/equipos', getEquiposAvanzado);
router.get('/equipos/:id/historial', getHistorialEquipo);
router.put('/equipos/:id', updateEquipoAdmin);
router.get('/repuestos', getRepuestosAvanzado);
router.get('/repuestos/:id/historial', getHistorialRepuesto);
router.get('/ordenes', getOrdenesAvanzado);
router.get('/ordenes/:id/repuestos', getRepuestosPorOrdenAdmin);
router.get('/ordenes/:id/repuestos/reporte', downloadRepuestosPorOrdenAdmin);
router.post('/ordenes/crear', async (req, res, next) => {
  try {
    const { createOrden } = await import('../../../controllers/Secretaria/nuevaOrdenController.js');
    return createOrden(req, res);
  } catch (error) {
    next(error);
  }
});
router.get('/equipos/:id/diagnostico', getEquipoUltimoDiagnostico);
router.get('/diagnosticos', getDiagnosticosAdmin);
router.get('/diagnosticos/reporte', downloadDiagnosticosReporteAdmin);
router.put('/diagnosticos/:id', updateDiagnosticoAdmin);
router.patch('/diagnosticos/:id/estado', updateDiagnosticoEstadoAdmin);
router.get('/facturas', getFacturasAvanzado);
router.get('/garantias', getGarantiasAdmin);
router.post('/garantias', createGarantiaAdmin);
router.put('/garantias/:id', updateGarantiaAdmin);
router.post('/garantias/:id/renovar', renewGarantiaAdmin);

router.get('/usuarios', getUsuarios);
router.post('/usuarios', createUsuario);
router.put('/usuarios/:id', updateUsuario);
router.put('/usuarios/:id/password', updateUsuarioPassword);
router.delete('/usuarios/:id', deleteUsuario);

router.get('/dashboard', getDashboardResumen);
router.get('/backups', getBackups);
router.post('/backups/manual', triggerBackupNow);
router.get('/backups/:month/:file/descargar', downloadBackupFile);
router.post('/backups/:month/:file/verificar', verifyBackupFiles);
router.get('/analitica/productividad', getProductividadAdmin);
router.get('/analitica/ganancias', getGananciasAdmin);
router.put('/ordenes/:id', updateOrdenAdmin);
router.put('/repuestos/:id', updateRepuestoAdmin);
router.get('/monitoreo', getMonitoreoGeneral);
router.get('/reportes/catalogo', getReportCatalog);
router.get('/reportes/opciones', getReportOptions);
router.get('/reportes/:tipo/excel', downloadReportExcel);
router.get('/reportes/:tipo', getReporteAdminPro);

export default router;
