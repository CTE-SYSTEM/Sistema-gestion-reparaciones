import { Prisma } from '@prisma/client';
import prisma from '../app/prismaClient.js';
import { dateRange } from '../utils/adminFilters.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.js';

const fail = (message) => { throw Object.assign(new Error(message), { statusCode: 400 }); };
const round = (value) => Math.round(Number(value || 0) * 100) / 100;
export const accountingTypes = ['COBRO', 'OTRO_INGRESO', 'COMPRA', 'DEVOLUCION', 'COSTO_RECLAMO', 'GASTO_OPERATIVO'];

export function accountingPeriod(query = {}) {
  const year = Number(query.anio || new Intl.DateTimeFormat('en', { timeZone: 'America/Managua', year: 'numeric' }).format(new Date()));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) fail('Año inválido');
  const range = dateRange(query);
  const from = range.start || `${year}-01-01`;
  const to = range.end || `${year}-12-31`;
  if (from > to) fail('El período inicial debe ser anterior al final');
  return { year, from, to, gte: new Date(`${from}T00:00:00-06:00`), lt: new Date(new Date(`${to}T00:00:00-06:00`).getTime() + 86400000) };
}

// Una sola fuente para gráficos, detalle de caja y reportes. Las facturas nuevas
// ya tienen su COBRO; el respaldo histórico solo se suma cuando ese asiento no existe.
export const ledgerSql = Prisma.sql`
  SELECT 'movimiento-' || m.id_movimiento AS id, m.id_movimiento, m.fecha_registro AS fecha,
    m.tipo, m.monto, m.metodo, m.referencia, m.motivo, m.factura_id, m.reclamo_id,
    NULL::integer AS compra_id, m.usuario_id,
    COALESCE(NULLIF(u.nombre_persona, ''), u.nombre_usuario) AS responsable,
    'Movimiento registrado'::text AS origen,
    CASE WHEN m.tipo IN ('COBRO','OTRO_INGRESO') THEN m.monto ELSE -m.monto END AS efecto_caja
  FROM "MovimientosContables" m JOIN "Usuarios" u ON u.id_usuario = m.usuario_id
  UNION ALL
  SELECT 'compra-' || c.id_compra, NULL::integer, c.fecha_obtencion, 'COMPRA',
    COALESCE(c.cantidad,0) * COALESCE(c.costo_unitario,0), c.metodo_pago, c.documento,
    'Compra de repuestos', NULL::integer, NULL::integer, c.id_compra, NULL::integer,
    'Registro de compra', 'Compra pagada según método registrado',
    -COALESCE(c.cantidad,0) * COALESCE(c.costo_unitario,0)
  FROM "Compras" c WHERE c.metodo_pago IN ('Efectivo','Transferencia','Tarjeta')
  UNION ALL
  SELECT 'factura-' || f.id_factura, NULL::integer, f.fecha_emision, 'COBRO', f.total,
    f.metodo_pago, NULL::text, 'Cobro histórico inferido de la factura', f.id_factura,
    NULL::integer, NULL::integer, NULL::integer, 'Registro histórico', 'Factura histórica', f.total
  FROM "Facturas" f WHERE f.metodo_pago IS NOT NULL AND f.metodo_pago <> 'Pendiente'
    AND f.total > 0 AND NOT EXISTS (SELECT 1 FROM "MovimientosContables" m
      WHERE m.factura_id=f.id_factura AND m.tipo='COBRO' AND m.motivo='Cobro registrado al emitir la factura')
`;

export function accountingWhere(query, period) {
  const conditions = [Prisma.sql`fecha >= (${period.gte.toISOString()}::timestamptz AT TIME ZONE 'UTC')`,
    Prisma.sql`fecha < (${period.lt.toISOString()}::timestamptz AT TIME ZONE 'UTC')`];
  if (query.tipo) {
    if (!accountingTypes.includes(query.tipo)) fail('Tipo de movimiento inválido');
    conditions.push(Prisma.sql`tipo = ${query.tipo}`);
  }
  if (query.metodo) {
    if (!['Efectivo', 'Transferencia', 'Tarjeta', 'SIN_METODO'].includes(query.metodo)) fail('Método inválido');
    conditions.push(query.metodo === 'SIN_METODO' ? Prisma.sql`metodo IS NULL` : Prisma.sql`metodo = ${query.metodo}`);
  }
  for (const key of ['usuario_id', 'factura_id', 'reclamo_id', 'compra_id']) {
    if (!query[key]) continue;
    const id = Number(query[key]);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) fail('Referencia inválida');
    conditions.push(Prisma.sql`${Prisma.raw(key)} = ${id}`);
  }
  const search = String(query.search || '').trim().slice(0, 150);
  if (search) {
    const term = `%${search}%`;
    conditions.push(Prisma.sql`(motivo ILIKE ${term} OR referencia ILIKE ${term} OR responsable ILIKE ${term}
      OR id ILIKE ${term} OR factura_id::text = ${search} OR reclamo_id::text = ${search} OR compra_id::text = ${search})`);
  }
  return Prisma.join(conditions, ' AND ');
}

const amounts = Prisma.sql`COUNT(*)::integer AS total,
  COALESCE(SUM(GREATEST(efecto_caja,0)),0) AS ingresos,
  COALESCE(SUM(GREATEST(-efecto_caja,0)),0) AS egresos,
  COALESCE(SUM(efecto_caja),0) AS neto`;

const receivablesSql = Prisma.sql`SELECT f.id_factura, f.fecha_emision, f.total, COALESCE(c.nombre,'Cliente sin nombre') AS cliente,
  GREATEST(0, COALESCE(f.total,0) - COALESCE(SUM(m.monto) FILTER (WHERE m.tipo='COBRO'),0)
    + COALESCE(SUM(m.monto) FILTER (WHERE m.tipo='DEVOLUCION'),0)
    - CASE WHEN f.metodo_pago IS NOT NULL AND f.metodo_pago <> 'Pendiente' AND f.total > 0
      AND COUNT(*) FILTER (WHERE m.tipo='COBRO' AND m.motivo='Cobro registrado al emitir la factura')=0 THEN f.total ELSE 0 END) AS pendiente
  FROM "Facturas" f LEFT JOIN "MovimientosContables" m ON m.factura_id=f.id_factura
  LEFT JOIN "Ordenes" o ON o.id_orden=f.orden_id
  LEFT JOIN "Diagnosticos" d ON d.id_diagnostico=COALESCE(f.diagnostico_id,o.diagnostico_id)
  LEFT JOIN "Equipos" e ON e.id_equipo=d.equipo_id LEFT JOIN "Clientes" c ON c.id_cliente=e.cliente_id
  GROUP BY f.id_factura,c.nombre`;

export async function getCurrentReceivables() {
  const rows = await prisma.$queryRaw`WITH balances AS (${receivablesSql}) SELECT * FROM balances WHERE pendiente > 0 ORDER BY fecha_emision,id_factura LIMIT 10001`;
  if (rows.length > 10000) fail('La cartera supera 10 000 facturas; consulte el detalle por cliente.');
  return rows.map(row=>({...row,total:round(row.total),pendiente:round(row.pendiente)}));
}

export async function getAccountingActivity(query = {}, { complete = false } = {}) {
  const period = accountingPeriod(query), where = accountingWhere(query, period);
  const pagination = parsePagination(query, 10);
  return prisma.$transaction(async (tx) => {
    const [summary] = await tx.$queryRaw`WITH ledger AS (${ledgerSql}) SELECT ${amounts} FROM ledger WHERE ${where}`;
    if (complete && summary.total > 10000) fail('Seleccione un período menor: el reporte supera 10 000 registros.');
    const rows = await tx.$queryRaw`WITH ledger AS (${ledgerSql}) SELECT * FROM ledger WHERE ${where}
      ORDER BY fecha DESC, id DESC LIMIT ${complete ? 10000 : pagination.pageSize} OFFSET ${complete ? 0 : pagination.offset}`;
    return { data: rows.map((row) => ({ ...row, monto: round(row.monto), efecto_caja: round(row.efecto_caja) })),
      meta: buildPaginationMeta({ ...pagination, total: summary.total }),
      summary: { ingresos: round(summary.ingresos), egresos: round(summary.egresos), neto: round(summary.neto) },
      filtros: { ...query, fecha_inicio: period.from, fecha_fin: period.to }, generado_en: new Date().toISOString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function getAccountingSummary(query = {}) {
  const period = accountingPeriod(query), where = accountingWhere({}, period);
  return prisma.$transaction(async (tx) => {
    const grouped = await tx.$queryRaw`WITH ledger AS (${ledgerSql})
      SELECT EXTRACT(MONTH FROM fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Managua')::integer AS mes,
        EXTRACT(YEAR FROM fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Managua')::integer AS anio,
        tipo, COALESCE(SUM(monto),0) AS monto FROM ledger WHERE ${where} GROUP BY 1,2,3 ORDER BY 2,1`;
    const [invoiceTotals] = await tx.$queryRaw`SELECT COALESCE(SUM(total),0) AS facturado FROM "Facturas"
      WHERE fecha_emision >= (${period.gte.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        AND fecha_emision < (${period.lt.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
    const purchases = await tx.$queryRaw`SELECT EXTRACT(MONTH FROM fecha_obtencion AT TIME ZONE 'UTC' AT TIME ZONE 'America/Managua')::integer AS mes,
      EXTRACT(YEAR FROM fecha_obtencion AT TIME ZONE 'UTC' AT TIME ZONE 'America/Managua')::integer AS anio,
      COALESCE(SUM(COALESCE(cantidad,0)*COALESCE(costo_unitario,0)),0) AS total,
      COALESCE(SUM(CASE WHEN metodo_pago IS NULL OR metodo_pago NOT IN ('Efectivo','Transferencia','Tarjeta')
        THEN COALESCE(cantidad,0)*COALESCE(costo_unitario,0) ELSE 0 END),0) AS sin_pago
      FROM "Compras" WHERE fecha_obtencion >= (${period.gte.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        AND fecha_obtencion < (${period.lt.toISOString()}::timestamptz AT TIME ZONE 'UTC') GROUP BY 1,2`;
    const [receivables] = await tx.$queryRaw`WITH balances AS (${receivablesSql}) SELECT COALESCE(SUM(pendiente),0) AS total,
      COALESCE(SUM(pendiente) FILTER (WHERE fecha_emision >= (${period.gte.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        AND fecha_emision < (${period.lt.toISOString()}::timestamptz AT TIME ZONE 'UTC')),0) AS periodo,
      COUNT(*) FILTER (WHERE pendiente > 0)::integer AS facturas FROM balances`;
    const months = [];
    const first = new Date(`${period.from.slice(0,7)}-01T12:00:00Z`), last = period.to.slice(0,7);
    for (const date = first; date.toISOString().slice(0,7) <= last; date.setUTCMonth(date.getUTCMonth()+1)) {
      months.push({ anio: date.getUTCFullYear(), mes: date.getUTCMonth()+1, cobros: 0, otros_ingresos: 0, compras: 0,
        compras_pagadas: 0, devoluciones: 0, reclamos: 0, gastos_operativos: 0, ingresos: 0, egresos: 0, neto: 0, acumulado: 0 });
    }
    const fields = { COBRO: 'cobros', OTRO_INGRESO: 'otros_ingresos', COMPRA: 'compras_pagadas', DEVOLUCION: 'devoluciones', COSTO_RECLAMO: 'reclamos', GASTO_OPERATIVO: 'gastos_operativos' };
    for (const row of grouped) { const month = months.find((m) => m.anio === row.anio && m.mes === row.mes); if (month && fields[row.tipo]) month[fields[row.tipo]] = round(row.monto); }
    for (const row of purchases) { const month = months.find((m) => m.anio === row.anio && m.mes === row.mes); if (month) month.compras = round(row.total); }
    let accumulated = 0;
    for (const month of months) {
      month.ingresos = round(month.cobros + month.otros_ingresos);
      month.egresos = round(month.compras_pagadas + month.devoluciones + month.reclamos + month.gastos_operativos);
      month.neto = round(month.ingresos-month.egresos); accumulated = round(accumulated+month.neto); month.acumulado=accumulated;
    }
    const sum = (key) => round(months.reduce((n,m) => n+m[key],0));
    return { year: period.year, filtros: { fecha_inicio: period.from, fecha_fin: period.to }, generado_en: new Date().toISOString(), months,
      totals: { ingresos: sum('ingresos'), egresos: sum('egresos'), neto: sum('neto'), cobros: sum('cobros'), facturado: round(invoiceTotals.facturado),
        por_cobrar: round(receivables.periodo), cartera_total: round(receivables.total), facturas_pendientes: receivables.facturas,
        compras_registradas: sum('compras'), compras_pagadas: sum('compras_pagadas'), compras_sin_pago: round(purchases.reduce((n,r)=>n+Number(r.sin_pago),0)) },
      method: 'Flujo registrado: cobros y otros ingresos menos compras pagadas, devoluciones, reclamos y gastos. Las compras se reconocen en la fecha de obtención según el método de pago registrado; las facturas históricas conservan su cobro inferido. El flujo acumulado no es saldo bancario ni utilidad. La cartera es el saldo actual, incluidos años anteriores.' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
