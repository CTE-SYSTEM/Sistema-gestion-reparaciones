import { Router } from 'express';
import authMiddleware, { requirePermission } from '../../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../../utils/permissions.js';
import { consultarSaldo, crearMovimiento, listarMovimientos } from '../../../controllers/contabilidad/movimientosController.js';
import prisma from '../../../app/prismaClient.js';
import { getAccountingActivity } from '../../../services/contabilidadService.js';
import { sendReportExcel, sendReportPdf } from '../../../utils/reportExport.js';

const router = Router();
router.use(authMiddleware, requirePermission(PERMISSIONS.CONTABILIDAD_MOVIMIENTOS));
const handle = (res, next, error) => error.statusCode || error.status ? res.status(error.statusCode || error.status).json({ error: error.message }) : next(error);
router.get('/opciones', async (_req, res, next) => {
  try { const data = await prisma.usuarios.findMany({ where: { movimientos_contables: { some: {} } },
    select: { id_usuario: true, nombre_persona: true, nombre_usuario: true }, orderBy: { nombre_usuario: 'asc' } });
    res.json({ data: data.map(user => ({ id_usuario: user.id_usuario, nombre: user.nombre_persona || user.nombre_usuario })) });
  } catch (error) { next(error); }
});
router.get('/actividad', async (req,res,next) => {
  try { res.json(await getAccountingActivity(req.query)); } catch(error) { handle(res,next,error); }
});
const exportActivity = async (req,res,next,format) => {
  try {
    const result = await getAccountingActivity(req.query,{complete:true});
    const report={...result,reporte:{id:'movimientos-contables',nombre:'Movimientos contables'},total:result.meta.total,
      nota:'Entradas y salidas del período filtrado. Incluye compras pagadas según método registrado y cobros históricos inferidos; se identifica su origen. El flujo neto no equivale a utilidad.',
      columns:[['fecha','Fecha'],['tipo','Tipo'],['origen','Origen'],['factura_id','Factura'],['compra_id','Compra'],['reclamo_id','Reclamo'],
        ['monto','Monto C$'],['efecto_caja','Efecto de caja C$'],['metodo','Método'],['responsable','Responsable'],['referencia','Referencia'],['motivo','Motivo']].map(([accessor,header])=>({accessor,header}))};
    await (format==='pdf'?sendReportPdf:sendReportExcel)(res,report);
  } catch(error) { handle(res,next,error); }
};
router.get('/actividad/excel',(req,res,next)=>exportActivity(req,res,next,'excel'));
router.get('/actividad/pdf',(req,res,next)=>exportActivity(req,res,next,'pdf'));
router.get('/', listarMovimientos);
router.get('/facturas/:id/saldo', consultarSaldo);
router.post('/', crearMovimiento);
export default router;
