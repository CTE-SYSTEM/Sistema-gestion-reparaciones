import prisma from '../../app/prismaClient.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { METODOS_PAGO, parseNonNegativeMoney, parsePositiveId } from '../../utils/domainValidation.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';

const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
const errorResponse = (res, error) => res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo registrar el movimiento' });

export const saldoFactura = async (tx, factura) => {
  const movimientos = await tx.movimientosContables.findMany({ where: { factura_id: factura.id_factura }, select: { tipo: true, monto: true, motivo: true } });
  const cobrados = movimientos.filter((m) => m.tipo === 'COBRO').reduce((sum, m) => sum + Number(m.monto), 0);
  const devueltos = movimientos.filter((m) => m.tipo === 'DEVOLUCION').reduce((sum, m) => sum + Number(m.monto), 0);
  // Las facturas anteriores a este registro ya documentaban el cobro con metodo_pago.
  const cobroInicialRegistrado = movimientos.some((m) => m.tipo === 'COBRO' && m.motivo === 'Cobro registrado al emitir la factura');
  const cobroHistorico = !cobroInicialRegistrado && factura.metodo_pago && factura.metodo_pago !== 'Pendiente' && Number(factura.total || 0) > 0
    ? Number(factura.total) : 0;
  const total = Number(factura.total || 0);
  return { total, cobrado: Math.round((cobrados + cobroHistorico) * 100) / 100,
    devuelto: Math.round(devueltos * 100) / 100,
    pendiente: Math.max(0, Math.round((total - cobrados - cobroHistorico + devueltos) * 100) / 100),
    cobro_historico: cobroHistorico > 0 };
};

export const listarMovimientos = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const facturaId = req.query.factura_id ? parsePositiveId(req.query.factura_id) : null;
    const reclamoId = req.query.reclamo_id ? parsePositiveId(req.query.reclamo_id) : null;
    if ((req.query.factura_id && !facturaId) || (req.query.reclamo_id && !reclamoId)) fail(400, 'Identificador no válido');
    const where = { ...(facturaId ? { factura_id: facturaId } : {}), ...(reclamoId ? { reclamo_id: reclamoId } : {}) };
    const [data, total] = await Promise.all([
      prisma.movimientosContables.findMany({ where, include: { usuario: { select: { nombre_usuario: true } }, factura: { select: { id_factura: true, total: true } }, reclamo: { select: { id_reclamo: true } } }, orderBy: { id_movimiento: 'desc' }, skip: offset, take: pageSize }),
      prisma.movimientosContables.count({ where }),
    ]);
    res.json({ data: data.map((m) => ({ ...m, monto: Number(m.monto) })), meta: buildPaginationMeta({ page, pageSize, total }) });
  } catch (error) { errorResponse(res, error); }
};

export const consultarSaldo = async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) fail(400, 'Factura no válida');
    const factura = await prisma.facturas.findUnique({ where: { id_factura: id } });
    if (!factura) fail(404, 'Factura no encontrada');
    res.json({ data: await saldoFactura(prisma, factura) });
  } catch (error) { errorResponse(res, error); }
};

export const crearMovimiento = async (req, res) => {
  try {
    const tipo = String(req.body?.tipo || '').toUpperCase();
    const facturaId = req.body?.factura_id ? parsePositiveId(req.body.factura_id) : null;
    const reclamoId = req.body?.reclamo_id ? parsePositiveId(req.body.reclamo_id) : null;
    const monto = parseNonNegativeMoney(req.body?.monto, 'Monto');
    const motivo = String(req.body?.motivo || '').trim();
    const metodo = String(req.body?.metodo || '').trim();
    const referencia = String(req.body?.referencia || '').trim();
    if (!['COBRO', 'DEVOLUCION', 'COSTO_RECLAMO', 'GASTO_OPERATIVO', 'OTRO_INGRESO'].includes(tipo) || monto <= 0 || motivo.length < 5 || motivo.length > 2000) fail(400, 'Indique tipo, monto mayor que cero y motivo de 5 a 2000 caracteres');
    if (['COBRO', 'DEVOLUCION'].includes(tipo) && !facturaId) fail(400, 'Seleccione la factura');
    if (tipo === 'COSTO_RECLAMO' && !reclamoId) fail(400, 'Seleccione el reclamo');
    if (['GASTO_OPERATIVO', 'OTRO_INGRESO'].includes(tipo) && (facturaId || reclamoId)) fail(400, 'Este movimiento se registra sin factura ni reclamo');
    if (tipo !== 'COSTO_RECLAMO' && !METODOS_PAGO.filter((m) => m !== 'Pendiente').includes(metodo)) fail(400, 'Seleccione un método de pago válido');
    const data = await withAuditUser(req.user, async (tx) => {
      if (reclamoId && !await tx.reclamos.findUnique({ where: { id_reclamo: reclamoId }, select: { id_reclamo: true } })) fail(404, 'Reclamo no encontrado');
      if (facturaId) {
        await tx.$queryRaw`SELECT id_factura FROM "Facturas" WHERE id_factura = ${facturaId} FOR UPDATE`;
        const factura = await tx.facturas.findUnique({ where: { id_factura: facturaId } });
        if (!factura) fail(404, 'Factura no encontrada');
        const saldo = await saldoFactura(tx, factura);
        if (tipo === 'COBRO' && monto > saldo.pendiente) fail(409, `El saldo pendiente es ${saldo.pendiente.toFixed(2)}`);
        if (tipo === 'DEVOLUCION' && monto > saldo.cobrado - saldo.devuelto) fail(409, 'La devolución supera lo cobrado y no devuelto');
      }
      return tx.movimientosContables.create({ data: {
        tipo, monto, factura_id: facturaId, reclamo_id: reclamoId,
        usuario_id: req.user.id, metodo: tipo === 'COSTO_RECLAMO' ? null : metodo,
        referencia: referencia || null, motivo,
      } });
    });
    res.status(201).json({ data: { ...data, monto: Number(data.monto) } });
  } catch (error) { errorResponse(res, error); }
};
