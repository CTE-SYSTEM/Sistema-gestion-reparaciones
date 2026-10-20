import { sendReportExcel } from '../../utils/reportExport.js';
import prisma from '../../app/prismaClient.js';
import { loadAdminReport, REPORT_CATALOG } from '../../services/adminReportsService.js';
import { getBusinessSettings } from '../../services/adminSettingsService.js';

const handleError = (res, error) => {
  console.error('[Reportes]', error.message);
  const status = error.statusCode || error.status;
  res.status(status || 500).json({ error: status ? error.message : 'No se pudo generar el reporte.' });
};
export const getReportCatalog = async (req, res) => {
  try { res.json({ data: REPORT_CATALOG, defaults: (await getBusinessSettings()).reglas }); }
  catch (error) { handleError(res, error); }
};
export const getReporteAdminPro = async (req, res) => {
  try { res.json(await loadAdminReport(req.params.tipo, req.query)); }
  catch (error) { handleError(res, error); }
};
export const downloadReportExcel = async (req, res) => {
  try {
    return await sendReportExcel(res, await loadAdminReport(req.params.tipo, req.query), req.user.username);
  } catch (error) { handleError(res, error); }
};
export const getReportOptions = async (req, res) => {
  try {
    const [clientes, equipos, repuestos, proveedores, tecnicos] = await Promise.all([
      prisma.clientes.findMany({ select: { id_cliente: true, nombre: true }, orderBy: { nombre: 'asc' } }),
      prisma.equipos.findMany({ select: { id_equipo: true, tipo: true, marca: true, modelo: true, cliente: { select: { nombre: true } } }, orderBy: { id_equipo: 'desc' } }),
      prisma.repuestos.findMany({ select: { id_repuesto: true, nombre: true }, orderBy: { nombre: 'asc' } }),
      prisma.proveedores.findMany({ select: { id_proveedor: true, nombre: true }, orderBy: { nombre: 'asc' } }),
      prisma.tecnicos.findMany({ select: { id_tecnico: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    ]);
    res.json({ data: { clientes, equipos: equipos.map((e) => ({ id_equipo: e.id_equipo, nombre: `#${e.id_equipo} ${[e.tipo, e.marca, e.modelo].filter(Boolean).join(' ')} · ${e.cliente.nombre}` })), repuestos, proveedores, tecnicos } });
  } catch (error) { handleError(res, error); }
};

