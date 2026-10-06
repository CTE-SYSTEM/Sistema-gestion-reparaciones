import { Prisma } from '@prisma/client';
import prisma from '../../app/prismaClient.js';
import { getBusinessSettings } from '../../services/adminSettingsService.js';

const normalizeRows = (rows) =>
  JSON.parse(JSON.stringify(rows, (_, value) => (typeof value === 'bigint' ? Number(value) : value)));

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getYear = (req) => {
  const now = new Date();
  const year = toNumber(req.query.year, now.getFullYear());
  return Math.min(Math.max(year, 2000), now.getFullYear() + 1);
};

const periodConfig = {
  semanal: {
    trunc: Prisma.raw("'week'"),
    step: Prisma.sql`INTERVAL '1 week'`,
    label: Prisma.sql`TO_CHAR(p.periodo, 'IYYY-"S"IW')`,
  },
  mensual: {
    trunc: Prisma.raw("'month'"),
    step: Prisma.sql`INTERVAL '1 month'`,
    label: Prisma.sql`TO_CHAR(p.periodo, 'Mon YYYY')`,
  },
  anual: {
    trunc: Prisma.raw("'year'"),
    step: Prisma.sql`INTERVAL '1 year'`,
    label: Prisma.sql`TO_CHAR(p.periodo, 'YYYY')`,
  },
};

const getPeriodQuery = (granularidad, fechaInicio, fechaFin) => {
  const config = periodConfig[granularidad];

  return Prisma.sql`
    WITH periodos AS (
      SELECT generate_series(
        DATE_TRUNC(${config.trunc}, CAST(${fechaInicio} AS DATE))::DATE,
        DATE_TRUNC(${config.trunc}, CAST(${fechaFin} AS DATE))::DATE,
        ${config.step}
      )::DATE AS periodo
    ),
    ingresos AS (
      SELECT
        DATE_TRUNC(${config.trunc}, f.fecha_emision)::DATE AS periodo,
        COALESCE(SUM(COALESCE(f.total, 0)), 0) AS ingresos,
        COUNT(*)::INT AS facturas
      FROM "Facturas" f
      WHERE f.fecha_emision::DATE BETWEEN CAST(${fechaInicio} AS DATE) AND CAST(${fechaFin} AS DATE)
      GROUP BY DATE_TRUNC(${config.trunc}, f.fecha_emision)::DATE
    ),
    compras AS (
      SELECT
        DATE_TRUNC(${config.trunc}, c.fecha_obtencion)::DATE AS periodo,
        COALESCE(SUM(COALESCE(c.cantidad, 0) * COALESCE(c.costo_unitario, 0)), 0) AS compras_inventario,
        COUNT(*)::INT AS compras
      FROM "Compras" c
      WHERE c.fecha_obtencion::DATE BETWEEN CAST(${fechaInicio} AS DATE) AND CAST(${fechaFin} AS DATE)
      GROUP BY DATE_TRUNC(${config.trunc}, c.fecha_obtencion)::DATE
    ),
    costos_ordenes AS (
      SELECT
        DATE_TRUNC(${config.trunc}, COALESCE(f.fecha_emision, o.fecha_cierre, o.fecha_ingreso))::DATE AS periodo,
        COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0) AS costo_repuestos_usados,
        COUNT(DISTINCT o.id_orden)::INT AS ordenes_procesadas
      FROM "Ordenes" o
      JOIN "Facturas" f ON f.orden_id = o.id_orden
      LEFT JOIN "Ordenes_Repuestos" orp ON orp.orden_id = o.id_orden AND orp.estado_aprobacion = 'APROBADO'
      LEFT JOIN "Repuestos" r ON r.id_repuesto = orp.repuesto_id
      WHERE COALESCE(f.fecha_emision, o.fecha_cierre, o.fecha_ingreso)::DATE BETWEEN CAST(${fechaInicio} AS DATE) AND CAST(${fechaFin} AS DATE)
      GROUP BY DATE_TRUNC(${config.trunc}, COALESCE(f.fecha_emision, o.fecha_cierre, o.fecha_ingreso))::DATE
    ),
    perdidas_reales AS (
      SELECT
        DATE_TRUNC(${config.trunc}, COALESCE(o.fecha_cierre, o.fecha_ingreso))::DATE AS periodo,
        COALESCE(SUM(COALESCE(f.mano_obra, 0)), 0) AS perdidas_reales,
        COUNT(*)::INT AS ordenes_irreparables
      FROM "Ordenes" o
      LEFT JOIN "Facturas" f ON f.orden_id = o.id_orden
      WHERE UPPER(COALESCE(o.estado, '')) = 'IRREPARABLE'
        AND COALESCE(o.fecha_cierre, o.fecha_ingreso)::DATE BETWEEN CAST(${fechaInicio} AS DATE) AND CAST(${fechaFin} AS DATE)
      GROUP BY DATE_TRUNC(${config.trunc}, COALESCE(o.fecha_cierre, o.fecha_ingreso))::DATE
    )
    SELECT
      ${granularidad}::TEXT AS granularidad,
      p.periodo::DATE AS periodo,
      ${config.label}::TEXT AS etiqueta,
      COALESCE(i.ingresos, 0) AS ingresos,
      COALESCE(c.compras_inventario, 0) AS gastos,
      COALESCE(c.compras_inventario, 0) AS compras_inventario,
      COALESCE(co.costo_repuestos_usados, 0) AS costo_repuestos_usados,
      COALESCE(pr.perdidas_reales, 0) AS perdidas_reales,
      COALESCE(co.costo_repuestos_usados, 0) + COALESCE(pr.perdidas_reales, 0) AS perdidas_operativas,
      COALESCE(i.ingresos, 0) - COALESCE(co.costo_repuestos_usados, 0) - COALESCE(pr.perdidas_reales, 0) AS ganancia_neta,
      COALESCE(i.ingresos, 0) - COALESCE(co.costo_repuestos_usados, 0) AS margen_servicio,
      CASE WHEN COALESCE(i.ingresos, 0) > 0
        THEN ROUND(((COALESCE(i.ingresos, 0) - COALESCE(co.costo_repuestos_usados, 0)) / COALESCE(i.ingresos, 0)) * 100, 2)
        ELSE 0
      END AS rentabilidad_porcentaje,
      COALESCE(i.facturas, 0)::INT AS facturas,
      COALESCE(c.compras, 0)::INT AS compras,
      COALESCE(co.ordenes_procesadas, 0)::INT AS ordenes_procesadas,
      COALESCE(pr.ordenes_irreparables, 0)::INT AS ordenes_irreparables
    FROM periodos p
    LEFT JOIN ingresos i ON i.periodo = p.periodo
    LEFT JOIN compras c ON c.periodo = p.periodo
    LEFT JOIN costos_ordenes co ON co.periodo = p.periodo
    LEFT JOIN perdidas_reales pr ON pr.periodo = p.periodo
    ORDER BY p.periodo ASC
  `;
};

export const getProductividadAdmin = async (req, res) => {
  try {
    const year = getYear(req);
    const yearsBack = Math.min(Math.max(toNumber(req.query.years_back, 4), 1), 10);

    const [monthlyRows, yearlyRows] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`SELECT * FROM admin_pro.productividad_mensual(CAST(${year} AS INT))`),
      prisma.$queryRaw(
        Prisma.sql`SELECT * FROM admin_pro.productividad_anual(CAST(${year} AS INT), CAST(${yearsBack} AS INT))`
      ),
    ]);

    res.json({
      data: {
        year,
        monthly: normalizeRows(monthlyRows),
        yearly: normalizeRows(yearlyRows),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productividad admin', details: error.message });
  }
};

export const getGananciasData = async (query = {}) => {
    const req = { query };
    const settings = (await getBusinessSettings()).reglas;
    const now = new Date();
    const fechaInicio = req.query.fecha_inicio || `${now.getFullYear()}-01-01`;
    const fechaFin = req.query.fecha_fin || `${now.getFullYear()}-12-31`;
    const detalleLimite = Math.min(Math.max(toNumber(req.query.detalle_limite, 12), 5), 10001);
    const fuentesLimite = Math.min(Math.max(toNumber(req.query.fuentes_limite, 100), 5), 10001);

    const [
      weeklyRows,
      monthlyRows,
      yearlyRows,
      detalleRows,
      ordenRows,
      activosRows,
      perdidasRows,
      gananciasFuentesRows,
      perdidasFuentesRows,
    ] = await Promise.all([
      prisma.$queryRaw(getPeriodQuery('semanal', fechaInicio, fechaFin)),
      prisma.$queryRaw(getPeriodQuery('mensual', fechaInicio, fechaFin)),
      prisma.$queryRaw(getPeriodQuery('anual', fechaInicio, fechaFin)),
      prisma.$queryRaw(
        Prisma.sql`SELECT * FROM admin_pro.ganancias_detalle(CAST(${fechaInicio} AS DATE), CAST(${fechaFin} AS DATE), CAST(${detalleLimite} AS INT))`
      ),
      prisma.$queryRaw(Prisma.sql`
        SELECT
          o.id_orden,
          f.id_factura,
          f.fecha_emision,
          COALESCE(cl.nombre, 'Sin cliente') AS cliente,
          TRIM(CONCAT(COALESCE(e.tipo, 'Equipo'), ' ', COALESCE(e.marca, ''), ' ', COALESCE(e.modelo, ''))) AS equipo,
          COALESCE(f.total, 0) AS total_facturado,
          COALESCE(f.monto_diagnostico, 0) AS monto_diagnostico,
          COALESCE(f.mano_obra, 0) AS mano_obra,
          COALESCE(f.monto_repuestos, 0) AS monto_repuestos,
          COALESCE(f.impuestos, 0) AS impuestos,
          COALESCE(t.nombre, dt.nombre, 'Sin asignar') AS tecnico,
          COALESCE(o.estado, d.estado_del_diagnostico, '-') AS estado,
          COALESCE(o.resultado_final, '-') AS resultado_final,
          COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0) AS costo_repuestos,
          COALESCE(f.monto_repuestos, 0) - COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0) AS ganancia_repuestos,
          COALESCE(f.mano_obra, 0) AS ganancia_mano_obra,
          COALESCE(f.total, 0) - COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0) AS ganancia_servicio,
          CASE WHEN COALESCE(f.total, 0) > 0
            THEN ROUND(((COALESCE(f.total, 0) - COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0)) / COALESCE(f.total, 0)) * 100, 2)
            ELSE 0
          END AS margen_porcentaje
        FROM "Facturas" f
        LEFT JOIN "Ordenes" o ON o.id_orden = f.orden_id
        JOIN "Diagnosticos" d ON d.id_diagnostico = COALESCE(f.diagnostico_id, o.diagnostico_id)
        JOIN "Equipos" e ON e.id_equipo = d.equipo_id
        JOIN "Clientes" cl ON cl.id_cliente = e.cliente_id
        LEFT JOIN "Tecnicos" t ON t.id_tecnico = o.tecnico_id
        LEFT JOIN "Tecnicos" dt ON dt.id_tecnico = d.tecnico_id
        LEFT JOIN "Ordenes_Repuestos" orp ON orp.orden_id = o.id_orden AND orp.estado_aprobacion = 'APROBADO'
        LEFT JOIN "Repuestos" r ON r.id_repuesto = orp.repuesto_id
        WHERE f.fecha_emision::DATE BETWEEN CAST(${fechaInicio} AS DATE) AND CAST(${fechaFin} AS DATE)
        GROUP BY o.id_orden, d.estado_del_diagnostico, f.id_factura, f.fecha_emision, cl.nombre, e.tipo, e.marca, e.modelo, f.total, f.mano_obra, f.monto_repuestos, f.monto_diagnostico, f.impuestos, t.nombre, dt.nombre, o.estado, o.resultado_final
        ORDER BY f.fecha_emision DESC, f.id_factura DESC
        LIMIT ${fuentesLimite}
      `),
      prisma.$queryRaw(Prisma.sql`
        SELECT
          (SELECT COUNT(*) FROM "Clientes" WHERE activo = true)::INT AS clientes_activos,
          (SELECT COUNT(*) FROM "Tecnicos" WHERE activo = true)::INT AS tecnicos_activos,
          (SELECT COUNT(*) FROM "Usuarios" WHERE activo = true)::INT AS usuarios_activos,
          (SELECT COUNT(*) FROM "Equipos")::INT AS equipos_registrados,
          (SELECT COUNT(*) FROM "Proveedores" WHERE descontinuada = false)::INT AS proveedores_activos,
          (SELECT COUNT(*) FROM "Repuestos" WHERE activo = true AND descontinuada = false)::INT AS repuestos_activos,
          (SELECT COALESCE(SUM(stock_actual), 0) FROM "Repuestos" WHERE activo = true AND descontinuada = false)::INT AS unidades_stock,
          (SELECT COALESCE(SUM(stock_actual * costo_individual), 0) FROM "Repuestos" WHERE activo = true AND descontinuada = false) AS valor_inventario_costo,
          (SELECT COALESCE(SUM(stock_actual * (COALESCE(costo_individual, 0) + COALESCE(ganancia_cordobas, 0))), 0) FROM "Repuestos" WHERE activo = true AND descontinuada = false) AS valor_inventario_venta,
          (SELECT COUNT(*) FROM "Repuestos" WHERE activo = true AND descontinuada = false AND stock_actual <= 0)::INT AS repuestos_sin_stock
      `),
      prisma.$queryRaw(Prisma.sql`
        SELECT *
        FROM (
          SELECT 'Compra de inventario'::TEXT AS accion, 'Inventario capitalizado'::TEXT AS clasificacion, c.fecha_obtencion AS fecha, COALESCE(c.cantidad, 0) * COALESCE(c.costo_unitario, 0) AS monto
          FROM "Compras" c
          WHERE c.fecha_obtencion::DATE BETWEEN CAST(${fechaInicio} AS DATE) AND CAST(${fechaFin} AS DATE)
          UNION ALL
          SELECT 'Costo de repuestos usados'::TEXT AS accion, 'Costo consumido'::TEXT AS clasificacion, COALESCE(f.fecha_emision, o.fecha_cierre, o.fecha_ingreso) AS fecha, COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0) AS monto
          FROM "Ordenes_Repuestos" orp
          JOIN "Ordenes" o ON o.id_orden = orp.orden_id
          JOIN "Facturas" f ON f.orden_id = o.id_orden
          LEFT JOIN "Repuestos" r ON r.id_repuesto = orp.repuesto_id
          WHERE orp.estado_aprobacion = 'APROBADO'
            AND COALESCE(f.fecha_emision, o.fecha_cierre, o.fecha_ingreso)::DATE BETWEEN CAST(${fechaInicio} AS DATE) AND CAST(${fechaFin} AS DATE)
          UNION ALL
          SELECT 'Orden irreparable'::TEXT AS accion, 'Perdida real'::TEXT AS clasificacion, COALESCE(o.fecha_cierre, o.fecha_ingreso) AS fecha, COALESCE(f.mano_obra, 0) AS monto
          FROM "Ordenes" o
          LEFT JOIN "Facturas" f ON f.orden_id = o.id_orden
          WHERE UPPER(COALESCE(o.estado, '')) = 'IRREPARABLE'
            AND COALESCE(o.fecha_cierre, o.fecha_ingreso)::DATE BETWEEN CAST(${fechaInicio} AS DATE) AND CAST(${fechaFin} AS DATE)
        ) perdidas
        ORDER BY fecha DESC NULLS LAST
        LIMIT ${fuentesLimite}
      `),
      prisma.$queryRaw(Prisma.sql`
        SELECT
          CASE WHEN o.id_orden IS NULL THEN 'Diagnóstico facturado' ELSE 'Orden facturada' END::TEXT AS fuente,
          f.fecha_emision AS fecha,
          CONCAT('Factura #', f.id_factura, CASE WHEN o.id_orden IS NULL THEN CONCAT(' / Diagnóstico #', d.id_diagnostico) ELSE CONCAT(' / Orden #', o.id_orden) END)::TEXT AS referencia,
          COALESCE(cl.nombre, 'Sin cliente')::TEXT AS cliente,
          TRIM(CONCAT(COALESCE(e.tipo, 'Equipo'), ' ', COALESCE(e.marca, ''), ' ', COALESCE(e.modelo, '')))::TEXT AS equipo,
          COALESCE(t.nombre, dt.nombre, 'Sin asignar')::TEXT AS tecnico,
          COALESCE(o.estado, d.estado_del_diagnostico, '-')::TEXT AS estado,
          COALESCE(f.total, 0) AS ingreso_total,
          COALESCE(f.mano_obra, 0) AS mano_obra,
          COALESCE(f.monto_repuestos, 0) AS ingreso_repuestos,
          COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0) AS costo_repuestos,
          COALESCE(f.monto_repuestos, 0) - COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0) AS ganancia_repuestos,
          COALESCE(f.total, 0) - COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0) AS ganancia_total,
          CASE WHEN COALESCE(f.total, 0) > 0
            THEN ROUND(((COALESCE(f.total, 0) - COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0)) / COALESCE(f.total, 0)) * 100, 2)
            ELSE 0
          END AS margen_porcentaje,
          CONCAT(
            'Diagnóstico: ', COALESCE(f.monto_diagnostico, 0),
            ' / Mano de obra: ', COALESCE(f.mano_obra, 0),
            ' / Margen repuestos: ', COALESCE(f.monto_repuestos, 0) - COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0)
          )::TEXT AS motivo
        FROM "Facturas" f
        LEFT JOIN "Ordenes" o ON o.id_orden = f.orden_id
        JOIN "Diagnosticos" d ON d.id_diagnostico = COALESCE(f.diagnostico_id, o.diagnostico_id)
        JOIN "Equipos" e ON e.id_equipo = d.equipo_id
        JOIN "Clientes" cl ON cl.id_cliente = e.cliente_id
        LEFT JOIN "Tecnicos" t ON t.id_tecnico = o.tecnico_id
        LEFT JOIN "Tecnicos" dt ON dt.id_tecnico = d.tecnico_id
        LEFT JOIN "Ordenes_Repuestos" orp ON orp.orden_id = o.id_orden AND orp.estado_aprobacion = 'APROBADO'
        LEFT JOIN "Repuestos" r ON r.id_repuesto = orp.repuesto_id
        WHERE f.fecha_emision::DATE BETWEEN CAST(${fechaInicio} AS DATE) AND CAST(${fechaFin} AS DATE)
          AND (o.id_orden IS NULL OR UPPER(COALESCE(o.estado, '')) IN ('FINALIZADO', 'ENTREGADO', 'IRREPARABLE'))
        GROUP BY o.id_orden, d.id_diagnostico, d.estado_del_diagnostico, f.id_factura, f.fecha_emision, cl.nombre, e.tipo, e.marca, e.modelo, f.total, f.mano_obra, f.monto_repuestos, f.monto_diagnostico, t.nombre, dt.nombre, o.estado
        ORDER BY ganancia_total DESC, f.fecha_emision DESC NULLS LAST
        LIMIT ${fuentesLimite}
      `),
      prisma.$queryRaw(Prisma.sql`
        SELECT *
        FROM (
          SELECT
            'Costo consumido'::TEXT AS tipo,
            COALESCE(f.fecha_emision, o.fecha_cierre, o.fecha_ingreso) AS fecha,
            CONCAT('Orden #', o.id_orden, COALESCE(' / Factura #' || f.id_factura, ''))::TEXT AS referencia,
            COALESCE(cl.nombre, 'Sin cliente')::TEXT AS cliente,
            TRIM(CONCAT(COALESCE(e.tipo, 'Equipo'), ' ', COALESCE(e.marca, ''), ' ', COALESCE(e.modelo, '')))::TEXT AS equipo,
            COALESCE(t.nombre, dt.nombre, 'Sin asignar')::TEXT AS tecnico,
            CONCAT(COALESCE(r.nombre, orp.pieza_solicitada, 'Repuesto'), ' x', COALESCE(orp.cantidad_usada, 1))::TEXT AS concepto,
            COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0) AS monto,
            'Costo de repuesto aprobado y usado en una orden facturada.'::TEXT AS razon
          FROM "Ordenes_Repuestos" orp
          JOIN "Ordenes" o ON o.id_orden = orp.orden_id
          JOIN "Diagnosticos" d ON d.id_diagnostico = o.diagnostico_id
          JOIN "Equipos" e ON e.id_equipo = d.equipo_id
          JOIN "Clientes" cl ON cl.id_cliente = e.cliente_id
          JOIN "Facturas" f ON f.orden_id = o.id_orden
          LEFT JOIN "Tecnicos" t ON t.id_tecnico = o.tecnico_id
          LEFT JOIN "Tecnicos" dt ON dt.id_tecnico = d.tecnico_id
          LEFT JOIN "Repuestos" r ON r.id_repuesto = orp.repuesto_id
          WHERE orp.estado_aprobacion = 'APROBADO'
            AND COALESCE(f.fecha_emision, o.fecha_cierre, o.fecha_ingreso)::DATE BETWEEN CAST(${fechaInicio} AS DATE) AND CAST(${fechaFin} AS DATE)
          UNION ALL
          SELECT
            'Perdida real'::TEXT AS tipo,
            COALESCE(o.fecha_cierre, o.fecha_ingreso) AS fecha,
            CONCAT('Orden #', o.id_orden)::TEXT AS referencia,
            COALESCE(cl.nombre, 'Sin cliente')::TEXT AS cliente,
            TRIM(CONCAT(COALESCE(e.tipo, 'Equipo'), ' ', COALESCE(e.marca, ''), ' ', COALESCE(e.modelo, '')))::TEXT AS equipo,
            COALESCE(t.nombre, dt.nombre, 'Sin asignar')::TEXT AS tecnico,
            'Orden irreparable'::TEXT AS concepto,
            COALESCE(f.mano_obra, 0) AS monto,
            COALESCE(NULLIF(o.justificacion_irreparable, ''), NULLIF(o.observacion_final, ''), NULLIF(o.resultado_final, ''), 'Orden marcada como irreparable.')::TEXT AS razon
          FROM "Ordenes" o
          JOIN "Diagnosticos" d ON d.id_diagnostico = o.diagnostico_id
          JOIN "Equipos" e ON e.id_equipo = d.equipo_id
          JOIN "Clientes" cl ON cl.id_cliente = e.cliente_id
          LEFT JOIN "Facturas" f ON f.orden_id = o.id_orden
          LEFT JOIN "Tecnicos" t ON t.id_tecnico = o.tecnico_id
          LEFT JOIN "Tecnicos" dt ON dt.id_tecnico = d.tecnico_id
          WHERE UPPER(COALESCE(o.estado, '')) = 'IRREPARABLE'
            AND COALESCE(o.fecha_cierre, o.fecha_ingreso)::DATE BETWEEN CAST(${fechaInicio} AS DATE) AND CAST(${fechaFin} AS DATE)
        ) fuentes
        ORDER BY monto DESC, fecha DESC NULLS LAST
        LIMIT ${fuentesLimite}
      `),
    ]);

    const weekly = normalizeRows(weeklyRows);
    const monthly = normalizeRows(monthlyRows);
    const yearly = normalizeRows(yearlyRows);
    const periodRows = [...weekly, ...monthly, ...yearly];
    const totals = monthly.reduce(
      (acc, item) => {
        acc.ingresos += Number(item.ingresos) || 0;
        acc.gastos += Number(item.gastos) || 0;
        acc.compras_inventario += Number(item.compras_inventario) || 0;
        acc.costo_repuestos_usados += Number(item.costo_repuestos_usados) || 0;
        acc.perdidas_reales += Number(item.perdidas_reales) || 0;
        acc.ganancia_neta += Number(item.ganancia_neta) || 0;
        acc.margen_servicio += Number(item.margen_servicio) || 0;
        acc.perdidas_operativas += Number(item.perdidas_operativas) || 0;
        acc.facturas += Number(item.facturas) || 0;
        acc.compras += Number(item.compras) || 0;
        acc.ordenes_procesadas += Number(item.ordenes_procesadas) || 0;
        acc.ordenes_irreparables += Number(item.ordenes_irreparables) || 0;
        return acc;
      },
      {
        ingresos: 0,
        gastos: 0,
        compras_inventario: 0,
        costo_repuestos_usados: 0,
        perdidas_reales: 0,
        ganancia_neta: 0,
        margen_servicio: 0,
        perdidas_operativas: 0,
        facturas: 0,
        compras: 0,
        ordenes_procesadas: 0,
        ordenes_irreparables: 0,
      }
    );
    totals.rentabilidad_porcentaje = totals.ingresos
      ? Math.round((totals.margen_servicio / totals.ingresos) * 10000) / 100
      : 0;

    const activos = normalizeRows(activosRows)[0] || {};
    activos.margen_inventario = Number(activos.valor_inventario_venta || 0) - Number(activos.valor_inventario_costo || 0);
    const orderMargins = normalizeRows(ordenRows);
    const alertas = [
      totals.ganancia_neta < 0
        ? { nivel: 'alto', titulo: 'Periodo con perdida neta', detalle: 'Los costos consumidos y perdidas reales superan los ingresos.' }
        : null,
      totals.rentabilidad_porcentaje > 0 && totals.rentabilidad_porcentaje < settings.rentabilidad_alerta_porcentaje
        ? { nivel: 'medio', titulo: 'Rentabilidad baja', detalle: `El margen de servicios está por debajo del ${settings.rentabilidad_alerta_porcentaje}%.` }
        : null,
      orderMargins.some((orden) => Number(orden.margen_porcentaje || 0) < settings.margen_orden_alerta_porcentaje)
        ? { nivel: 'medio', titulo: 'Servicios con margen bajo', detalle: `Hay órdenes facturadas con margen menor al ${settings.margen_orden_alerta_porcentaje}%.` }
        : null,
      Number(activos.repuestos_sin_stock || 0) > 0
        ? { nivel: 'medio', titulo: 'Inventario sin stock', detalle: `${activos.repuestos_sin_stock} repuestos activos estan sin unidades disponibles.` }
        : null,
      totals.ordenes_irreparables > 0
        ? { nivel: 'alto', titulo: 'Ordenes irreparables', detalle: `${totals.ordenes_irreparables} ordenes irreparables impactan el periodo.` }
        : null,
    ].filter(Boolean);

    return {
        fechaInicio,
        fechaFin,
        detalleLimite,
        totals,
        periods: {
          semanal: weekly,
          mensual: monthly,
          anual: yearly,
        },
        monthly,
        detail: normalizeRows(detalleRows),
        orderMargins,
        activos,
        perdidas: normalizeRows(perdidasRows),
        gananciasFuentes: normalizeRows(gananciasFuentesRows),
        perdidasFuentes: normalizeRows(perdidasFuentesRows),
        rentabilidad: normalizeRows(periodRows),
        alertas,
    };
};

export const getGananciasAdmin = async (req, res) => {
  try {
    res.json({ data: await getGananciasData(req.query) });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ganancias admin', details: error.message });
  }
};
