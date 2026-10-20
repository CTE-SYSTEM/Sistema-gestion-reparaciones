import { Router } from 'express';
import authMiddleware, { requireRole } from '../../../middlewares/authMiddleware.js';
import { loadAdminReport, REPORT_CATALOG } from '../../../services/adminReportsService.js';
import { sendReportExcel, sendReportPdf } from '../../../utils/reportExport.js';
import { parsePagination, buildPaginationMeta } from '../../../utils/pagination.js';

const router = Router();
router.use(authMiddleware, requireRole('Secretaria'));
const reportIds = new Set([
  'ordenes_estado', 'ordenes_detalle', 'diagnosticos_estado', 'diagnosticos_detalle',
  'facturacion', 'actividad_financiera', 'inventario', 'stock_bajo', 'compras',
  'devoluciones_proveedor', 'calidad_diagnosticos', 'calidad_ordenes', 'reclamos',
  'garantias', 'tecnicos',
]);
router.get('/catalogo', (_req, res) => res.json({ data: REPORT_CATALOG.filter((item) => reportIds.has(item.id)) }));
for (const [format, send] of [['excel', sendReportExcel], ['pdf', sendReportPdf]]) {
  router.get(`/:tipo/${format}`, async (req, res, next) => {
    try {
      if (!reportIds.has(req.params.tipo)) return res.status(404).json({ error: 'Reporte operativo no disponible' });
      await send(res, await loadAdminReport(req.params.tipo, req.query));
    } catch (error) { next(error); }
  });
}
router.get('/:tipo', async (req, res, next) => {
  try {
    if (!reportIds.has(req.params.tipo)) return res.status(404).json({ error: 'Reporte operativo no disponible' });
    const result = await loadAdminReport(req.params.tipo, req.query);
    const { page, pageSize, offset } = parsePagination(req.query);
    return res.json({ ...result, data: result.data.slice(offset, offset + pageSize), meta: buildPaginationMeta({ page, pageSize, total: result.total }) });
  } catch (error) { return next(error); }
});
export default router;
