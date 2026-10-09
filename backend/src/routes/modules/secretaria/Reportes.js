import { Router } from 'express';
import authMiddleware, { requireRole } from '../../../middlewares/authMiddleware.js';
import { loadAdminReport, REPORT_CATALOG } from '../../../services/adminReportsService.js';

const router = Router();
router.use(authMiddleware, requireRole('Secretaria'));
const reportIds = new Set([
  'ordenes_estado', 'ordenes_detalle', 'diagnosticos_estado', 'diagnosticos_detalle',
  'facturacion', 'actividad_financiera', 'inventario', 'stock_bajo', 'compras',
  'devoluciones_proveedor', 'calidad_diagnosticos', 'calidad_ordenes', 'reclamos',
  'garantias', 'tecnicos',
]);
router.get('/catalogo', (_req, res) => res.json({ data: REPORT_CATALOG.filter((item) => reportIds.has(item.id)) }));
router.get('/:tipo', async (req, res, next) => {
  try {
    if (!reportIds.has(req.params.tipo)) return res.status(404).json({ error: 'Reporte operativo no disponible' });
    return res.json(await loadAdminReport(req.params.tipo, req.query));
  } catch (error) { return next(error); }
});
export default router;
