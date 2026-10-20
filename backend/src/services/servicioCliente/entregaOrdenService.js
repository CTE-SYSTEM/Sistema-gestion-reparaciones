import { saldoFactura } from '../../controllers/contabilidad/movimientosController.js';

const fail = (message) => { throw Object.assign(new Error(message), { statusCode: 409 }); };

// Usa la transacción del llamador: facturar y entregar se confirman o revierten juntos.
export const entregarOrden = async (tx, { ordenId, usuarioId, persona, observacion }) => {
  await tx.$queryRaw`SELECT id_orden FROM "Ordenes" WHERE id_orden = ${ordenId} FOR UPDATE`;
  const orden = await tx.ordenes.findUnique({ where: { id_orden: ordenId }, include: { facturas: true } });
  if (!orden) return null;
  if (!['FINALIZADO', 'IRREPARABLE'].includes(orden.estado) || !orden.facturas.length) fail('La orden debe estar finalizada y facturada antes de entregarla');
  if (orden.estado === 'FINALIZADO' && !['APROBADO', 'NO_REQUERIDO'].includes(orden.calidad_estado)) fail('Control de calidad debe aprobar la orden antes de la entrega');
  const saldo = await saldoFactura(tx, orden.facturas[0]);
  if (saldo.pendiente > 0) fail('Registre el pago completo antes de entregar el equipo');
  const entregada = await tx.ordenes.update({ where: { id_orden: ordenId }, data: {
    estado: 'ENTREGADO', entregado_por_id: usuarioId, persona_recibe: persona,
    observacion_entrega: String(observacion || '').trim() || null,
  } });
  await tx.$executeRaw`UPDATE "Garantias" g SET fecha_inicio = ${entregada.fecha_entrega},
    fecha_vencimiento = ${entregada.fecha_entrega} + (COALESCE(g.duracion_meses, 3) || ' months')::interval
    FROM "Facturas" f WHERE g.factura_id = f.id_factura AND f.orden_id = ${ordenId}`;
  return entregada;
};
