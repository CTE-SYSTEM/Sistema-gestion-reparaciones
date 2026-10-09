import { fail } from '../../utils/tecnicoWorkflow.js';

// Las reservas se calculan desde Ordenes_Repuestos. El descuento físico sigue al facturar.
export const stockDisponible = async (tx, repuestoId, excluirDetalle = 0) => {
  const [r] = await tx.$queryRaw`SELECT r.stock_actual - COALESCE((
    SELECT SUM(p.cantidad_usada) FROM "Ordenes_Repuestos" p
    JOIN "Ordenes" o ON o.id_orden = p.orden_id
    WHERE p.repuesto_id = r.id_repuesto AND p.estado_aprobacion = 'APROBADO'
      AND p.id_detalle_repuesto <> ${excluirDetalle} AND o.estado IS DISTINCT FROM 'CANCELADO'
      AND NOT EXISTS (SELECT 1 FROM "Facturas" f WHERE f.orden_id = o.id_orden)
  ), 0)::INT - COALESCE((
    SELECT SUM(d.cantidad) FROM "DevolucionesProveedor" d
    WHERE d.repuesto_id = r.id_repuesto AND d.origen = 'BODEGA' AND d.estado = 'CUARENTENA'
  ), 0)::INT AS disponible FROM "Repuestos" r WHERE r.id_repuesto = ${repuestoId} AND r.descontinuada = false`;
  if (!r) fail(404, 'El repuesto no existe o está descontinuado');
  return Number(r.disponible);
};
export const lockRepuestos = async (tx, ids) => {
  for (const id of [...new Set(ids.filter(Boolean))].sort((a, b) => a - b)) {
    await tx.$queryRaw`SELECT id_repuesto FROM "Repuestos" WHERE id_repuesto = ${id} FOR UPDATE`;
  }
};
export const catalogoDisponible = async (tx) => {
  const rows = await tx.repuestos.findMany({ where: { descontinuada: false }, orderBy: { nombre: 'asc' }, include: { categoria: true } });
  const [reserved, defective] = await Promise.all([
    tx.ordenes_Repuestos.groupBy({ by: ['repuesto_id'], where: { estado_aprobacion: 'APROBADO', repuesto_id: { not: null }, orden: { OR: [{ estado: null }, { estado: { not: 'CANCELADO' } }], facturas: { none: {} } } }, _sum: { cantidad_usada: true } }),
    tx.devolucionesProveedor.groupBy({ by: ['repuesto_id'], where: { origen: 'BODEGA', estado: 'CUARENTENA' }, _sum: { cantidad: true } }),
  ]);
  const quantities = new Map(reserved.map((r) => [r.repuesto_id, Number(r._sum.cantidad_usada || 0)]));
  const quarantine = new Map(defective.map((r) => [r.repuesto_id, Number(r._sum.cantidad || 0)]));
  return rows.map((r) => ({ ...r, stock_reservado: quantities.get(r.id_repuesto) || 0, stock_cuarentena: quarantine.get(r.id_repuesto) || 0,
    stock_disponible: Math.max(0, r.stock_actual - (quantities.get(r.id_repuesto) || 0) - (quarantine.get(r.id_repuesto) || 0)) }));
};
