import { Router } from 'express';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { REPORT_CATALOG, loadAdminReport } from '../../../services/adminReportsService.js';
import { getAccountingSummary } from '../../../services/contabilidadService.js';
import { sendReportExcel, sendReportPdf } from '../../../utils/reportExport.js';
import { parsePagination, buildPaginationMeta } from '../../../utils/pagination.js';

const router = Router();
router.use(authMiddleware, requirePermission(PERMISSIONS.CONTABILIDAD_MOVIMIENTOS));
const handle = (res, next, error) => error.statusCode || error.status ? res.status(error.statusCode || error.status).json({ error: error.message }) : next(error);
router.get('/', async (req,res,next) => { try { res.json({ data: await getAccountingSummary(req.query) }); } catch(error) { handle(res,next,error); } });
router.get('/excel', async (req,res,next) => {
  try {
    const data=await getAccountingSummary(req.query);
    await sendReportExcel(res,{reporte:{id:'resumen-contable',nombre:'Resumen contable'},data:data.months,total:data.months.length,
      columns:Object.keys(data.months[0] || {}).map(accessor=>({accessor,header:accessor.replaceAll('_',' ')})),
      filtros:data.filtros,generado_en:data.generado_en,summary:data.totals,nota:data.method});
  } catch(error) { handle(res,next,error); }
});
router.get('/reportes/catalogo',(_req,res)=>res.json({data:REPORT_CATALOG.filter(item=>item.categoria==='Finanzas')}));
const financialReport=async(req)=>{
  if(!REPORT_CATALOG.some(item=>item.id===req.params.tipo && item.categoria==='Finanzas'))throw Object.assign(new Error('Reporte financiero no disponible'),{statusCode:404});
  return loadAdminReport(req.params.tipo,req.query);
};
router.get('/reportes/:tipo/excel',async(req,res,next)=>{try{await sendReportExcel(res,await financialReport(req));}catch(error){handle(res,next,error);}});
router.get('/reportes/:tipo/pdf',async(req,res,next)=>{try{await sendReportPdf(res,await financialReport(req));}catch(error){handle(res,next,error);}});
router.get('/reportes/:tipo',async(req,res,next)=>{
  try { const result=await financialReport(req),{page,pageSize,offset}=parsePagination(req.query);
    res.json({...result,data:result.data.slice(offset,offset+pageSize),meta:buildPaginationMeta({page,pageSize,total:result.total})});
  } catch(error) { handle(res,next,error); }
});
export default router;
