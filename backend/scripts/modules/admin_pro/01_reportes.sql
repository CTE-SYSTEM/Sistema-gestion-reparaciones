CREATE OR REPLACE FUNCTION admin_pro.resumen_general(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin DATE DEFAULT NULL
)
RETURNS TABLE (
  total_clientes BIGINT,
  total_equipos BIGINT,
  total_tecnicos_activos BIGINT,
  total_diagnosticos BIGINT,
  total_ordenes BIGINT,
  ordenes_finalizadas BIGINT,
  repuestos_activos BIGINT,
  total_compras NUMERIC,
  total_facturado NUMERIC,
  garantias_vigentes BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM "Clientes" c WHERE c.activo = true),
    (SELECT COUNT(*) FROM "Equipos"),
    (SELECT COUNT(*) FROM "Tecnicos" t WHERE t.activo = true),
    (
      SELECT COUNT(*)
      FROM "Diagnosticos" d
      WHERE (p_fecha_inicio IS NULL OR d.fecha_hora::date >= p_fecha_inicio)
        AND (p_fecha_fin IS NULL OR d.fecha_hora::date <= p_fecha_fin)
    ),
    (
      SELECT COUNT(*)
      FROM "Ordenes" o
      WHERE (p_fecha_inicio IS NULL OR o.fecha_ingreso::date >= p_fecha_inicio)
        AND (p_fecha_fin IS NULL OR o.fecha_ingreso::date <= p_fecha_fin)
    ),
    (
      SELECT COUNT(*)
      FROM "Ordenes" o
      WHERE UPPER(COALESCE(o.estado, '')) IN ('FINALIZADO', 'ENTREGADO')
        AND (p_fecha_inicio IS NULL OR o.fecha_ingreso::date >= p_fecha_inicio)
        AND (p_fecha_fin IS NULL OR o.fecha_ingreso::date <= p_fecha_fin)
    ),
    (SELECT COUNT(*) FROM "Repuestos" r WHERE r.activo = true AND r.descontinuada = false),
    (
      SELECT COALESCE(SUM(COALESCE(c.cantidad, 0) * COALESCE(c.costo_unitario, 0)), 0)
      FROM "Compras" c
      WHERE (p_fecha_inicio IS NULL OR c.fecha_obtencion::date >= p_fecha_inicio)
        AND (p_fecha_fin IS NULL OR c.fecha_obtencion::date <= p_fecha_fin)
    ),
    (
      SELECT COALESCE(SUM(COALESCE(f.total, 0)), 0)
      FROM "Facturas" f
      WHERE (p_fecha_inicio IS NULL OR f.fecha_emision::date >= p_fecha_inicio)
        AND (p_fecha_fin IS NULL OR f.fecha_emision::date <= p_fecha_fin)
    ),
    (
      SELECT COUNT(*)
      FROM "Garantias" g
      WHERE g.fecha_vencimiento IS NOT NULL
        AND g.fecha_vencimiento::date >= CURRENT_DATE
    );
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.repuestos_usados_por_periodo(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin DATE DEFAULT NULL
)
RETURNS TABLE (
  id_repuesto INT,
  repuesto TEXT,
  categoria TEXT,
  cantidad_total BIGINT,
  ordenes_donde_se_uso BIGINT,
  costo_unitario NUMERIC,
  costo_estimado_total NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id_repuesto,
    COALESCE(r.nombre, orp.pieza_solicitada, 'Sin nombre')::TEXT AS repuesto,
    cr.nombre_tipo::TEXT AS categoria,
    COALESCE(SUM(COALESCE(orp.cantidad_usada, 1)), 0)::BIGINT AS cantidad_total,
    COUNT(DISTINCT orp.orden_id)::BIGINT AS ordenes_donde_se_uso,
    COALESCE(r.costo_individual, 0) AS costo_unitario,
    COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0) AS costo_estimado_total
  FROM "Ordenes_Repuestos" orp
  JOIN "Ordenes" o ON o.id_orden = orp.orden_id
  LEFT JOIN "Repuestos" r ON r.id_repuesto = orp.repuesto_id
  LEFT JOIN "Categorias_Repuestos" cr ON cr.id_tipo_repuesto = r.tipo_repuesto_id
  WHERE orp.estado_aprobacion = 'APROBADO'
    AND (p_fecha_inicio IS NULL OR o.fecha_ingreso::date >= p_fecha_inicio)
    AND (p_fecha_fin IS NULL OR o.fecha_ingreso::date <= p_fecha_fin)
  GROUP BY r.id_repuesto, COALESCE(r.nombre, orp.pieza_solicitada, 'Sin nombre'), cr.nombre_tipo, r.costo_individual
  ORDER BY cantidad_total DESC, repuesto ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.repuestos_usados_por_proveedor(
  p_proveedor_id INT DEFAULT NULL,
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin DATE DEFAULT NULL
)
RETURNS TABLE (
  id_proveedor INT,
  proveedor TEXT,
  id_repuesto INT,
  repuesto TEXT,
  cantidad_usada BIGINT,
  veces_comprado BIGINT,
  cantidad_comprada BIGINT,
  costo_promedio_compra NUMERIC,
  costo_total_compras NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH compras_agg AS (
    SELECT
      c.proveedor_id,
      c.repuesto_id,
      COUNT(*)::BIGINT AS veces_comprado,
      COALESCE(SUM(COALESCE(c.cantidad, 0)), 0)::BIGINT AS cantidad_comprada,
      COALESCE(AVG(c.costo_unitario), 0) AS costo_promedio_compra,
      COALESCE(SUM(COALESCE(c.cantidad, 0) * COALESCE(c.costo_unitario, 0)), 0) AS costo_total_compras
    FROM "Compras" c
    WHERE (p_fecha_inicio IS NULL OR c.fecha_obtencion::date >= p_fecha_inicio)
      AND (p_fecha_fin IS NULL OR c.fecha_obtencion::date <= p_fecha_fin)
    GROUP BY c.proveedor_id, c.repuesto_id
  ),
  usos_agg AS (
    SELECT
      orp.repuesto_id,
      COALESCE(SUM(COALESCE(orp.cantidad_usada, 1)), 0)::BIGINT AS cantidad_usada
    FROM "Ordenes_Repuestos" orp
    JOIN "Ordenes" o ON o.id_orden = orp.orden_id
    WHERE orp.estado_aprobacion = 'APROBADO'
      AND (p_fecha_inicio IS NULL OR o.fecha_ingreso::date >= p_fecha_inicio)
      AND (p_fecha_fin IS NULL OR o.fecha_ingreso::date <= p_fecha_fin)
    GROUP BY orp.repuesto_id
  )
  SELECT
    p.id_proveedor,
    p.nombre::TEXT AS proveedor,
    r.id_repuesto,
    r.nombre::TEXT AS repuesto,
    COALESCE(u.cantidad_usada, 0) AS cantidad_usada,
    ca.veces_comprado,
    ca.cantidad_comprada,
    ca.costo_promedio_compra,
    ca.costo_total_compras
  FROM "Proveedores" p
  JOIN compras_agg ca ON ca.proveedor_id = p.id_proveedor
  JOIN "Repuestos" r ON r.id_repuesto = ca.repuesto_id
  LEFT JOIN usos_agg u ON u.repuesto_id = r.id_repuesto
  WHERE (p_proveedor_id IS NULL OR p.id_proveedor = p_proveedor_id)
  ORDER BY proveedor ASC, cantidad_usada DESC, repuesto ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.compras_por_periodo(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin DATE DEFAULT NULL
)
RETURNS TABLE (
  id_compra INT,
  fecha_obtencion TIMESTAMP,
  proveedor TEXT,
  repuesto TEXT,
  documento TEXT,
  cantidad INT,
  costo_unitario NUMERIC,
  costo_total NUMERIC,
  metodo_pago TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id_compra,
    c.fecha_obtencion,
    p.nombre::TEXT AS proveedor,
    r.nombre::TEXT AS repuesto,
    c.documento::TEXT,
    c.cantidad,
    c.costo_unitario,
    COALESCE(c.cantidad, 0) * COALESCE(c.costo_unitario, 0) AS costo_total,
    c.metodo_pago::TEXT
  FROM "Compras" c
  JOIN "Proveedores" p ON p.id_proveedor = c.proveedor_id
  JOIN "Repuestos" r ON r.id_repuesto = c.repuesto_id
  WHERE (p_fecha_inicio IS NULL OR c.fecha_obtencion::date >= p_fecha_inicio)
    AND (p_fecha_fin IS NULL OR c.fecha_obtencion::date <= p_fecha_fin)
  ORDER BY c.fecha_obtencion DESC, c.id_compra DESC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.facturacion_por_periodo(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin DATE DEFAULT NULL
)
RETURNS TABLE (
  id_factura INT,
  fecha_emision TIMESTAMP,
  id_orden INT,
  cliente TEXT,
  equipo TEXT,
  tecnico TEXT,
  monto_repuestos NUMERIC,
  mano_obra NUMERIC,
  subtotal NUMERIC,
  impuestos NUMERIC,
  total NUMERIC,
  metodo_pago TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id_factura,
    f.fecha_emision,
    o.id_orden,
    cl.nombre::TEXT AS cliente,
    CONCAT_WS(' ', e.tipo, e.marca, e.modelo)::TEXT AS equipo,
    t.nombre::TEXT AS tecnico,
    f.monto_repuestos,
    f.mano_obra,
    f.subtotal,
    f.impuestos,
    f.total,
    f.metodo_pago::TEXT
  FROM "Facturas" f
  LEFT JOIN "Ordenes" o ON o.id_orden = f.orden_id
  JOIN "Diagnosticos" d ON d.id_diagnostico = COALESCE(f.diagnostico_id, o.diagnostico_id)
  JOIN "Equipos" e ON e.id_equipo = d.equipo_id
  JOIN "Clientes" cl ON cl.id_cliente = e.cliente_id
  LEFT JOIN "Tecnicos" t ON t.id_tecnico = o.tecnico_id
  WHERE (p_fecha_inicio IS NULL OR f.fecha_emision::date >= p_fecha_inicio)
    AND (p_fecha_fin IS NULL OR f.fecha_emision::date <= p_fecha_fin)
  ORDER BY f.fecha_emision DESC, f.id_factura DESC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.rendimiento_tecnicos(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin DATE DEFAULT NULL
)
RETURNS TABLE (
  id_tecnico INT,
  tecnico TEXT,
  diagnosticos_asignados BIGINT,
  diagnosticos_completados BIGINT,
  ordenes_asignadas BIGINT,
  ordenes_finalizadas BIGINT,
  total_facturado NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH diagnosticos_agg AS (
    SELECT
      d.tecnico_id,
      COUNT(*)::BIGINT AS diagnosticos_asignados,
      COUNT(*) FILTER (
        WHERE UPPER(COALESCE(d.estado_del_diagnostico, '')) IN ('COMPLETADO', 'DIAGNOSTICADO', 'APROBADO')
      )::BIGINT AS diagnosticos_completados
    FROM "Diagnosticos" d
    WHERE d.tecnico_id IS NOT NULL
      AND (p_fecha_inicio IS NULL OR d.fecha_hora::date >= p_fecha_inicio)
      AND (p_fecha_fin IS NULL OR d.fecha_hora::date <= p_fecha_fin)
    GROUP BY d.tecnico_id
  ),
  ordenes_agg AS (
    SELECT
      o.tecnico_id,
      COUNT(*)::BIGINT AS ordenes_asignadas,
      COUNT(*) FILTER (
        WHERE UPPER(COALESCE(o.estado, '')) IN ('FINALIZADO', 'ENTREGADO')
      )::BIGINT AS ordenes_finalizadas,
      COALESCE(SUM(COALESCE(f.total, 0)), 0) AS total_facturado
    FROM "Ordenes" o
    LEFT JOIN "Facturas" f ON f.orden_id = o.id_orden
    WHERE o.tecnico_id IS NOT NULL
      AND (p_fecha_inicio IS NULL OR o.fecha_ingreso::date >= p_fecha_inicio)
      AND (p_fecha_fin IS NULL OR o.fecha_ingreso::date <= p_fecha_fin)
    GROUP BY o.tecnico_id
  )
  SELECT
    t.id_tecnico,
    t.nombre::TEXT AS tecnico,
    COALESCE(da.diagnosticos_asignados, 0) AS diagnosticos_asignados,
    COALESCE(da.diagnosticos_completados, 0) AS diagnosticos_completados,
    COALESCE(oa.ordenes_asignadas, 0) AS ordenes_asignadas,
    COALESCE(oa.ordenes_finalizadas, 0) AS ordenes_finalizadas,
    COALESCE(oa.total_facturado, 0) AS total_facturado
  FROM "Tecnicos" t
  LEFT JOIN diagnosticos_agg da ON da.tecnico_id = t.id_tecnico
  LEFT JOIN ordenes_agg oa ON oa.tecnico_id = t.id_tecnico
  ORDER BY ordenes_finalizadas DESC, diagnosticos_completados DESC, tecnico ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.ordenes_por_estado(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin DATE DEFAULT NULL
)
RETURNS TABLE (
  estado TEXT,
  cantidad BIGINT,
  prioridad_normal BIGINT,
  prioridad_alta BIGINT,
  prioridad_urgente BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(o.estado, 'SIN_ESTADO')::TEXT AS estado,
    COUNT(*)::BIGINT AS cantidad,
    COUNT(*) FILTER (WHERE UPPER(COALESCE(o.prioridad, '')) = 'NORMAL')::BIGINT AS prioridad_normal,
    COUNT(*) FILTER (WHERE UPPER(COALESCE(o.prioridad, '')) = 'ALTA')::BIGINT AS prioridad_alta,
    COUNT(*) FILTER (WHERE UPPER(COALESCE(o.prioridad, '')) = 'URGENTE')::BIGINT AS prioridad_urgente
  FROM "Ordenes" o
  WHERE (p_fecha_inicio IS NULL OR o.fecha_ingreso::date >= p_fecha_inicio)
    AND (p_fecha_fin IS NULL OR o.fecha_ingreso::date <= p_fecha_fin)
  GROUP BY COALESCE(o.estado, 'SIN_ESTADO')
  ORDER BY cantidad DESC, estado ASC;
END;
$$;

-- diagnosticos_por_estado se carga en Tecnico/Presupuesto.sql con totales por moneda.

CREATE OR REPLACE FUNCTION admin_pro.equipos_por_cliente()
RETURNS TABLE (
  id_cliente INT,
  cliente TEXT,
  telefono TEXT,
  total_equipos BIGINT,
  total_diagnosticos BIGINT,
  total_ordenes BIGINT,
  ultima_visita TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id_cliente,
    c.nombre::TEXT AS cliente,
    c.telefono::TEXT,
    COUNT(DISTINCT e.id_equipo)::BIGINT AS total_equipos,
    COUNT(DISTINCT d.id_diagnostico)::BIGINT AS total_diagnosticos,
    COUNT(DISTINCT o.id_orden)::BIGINT AS total_ordenes,
    MAX(COALESCE(o.fecha_ingreso, d.fecha_hora)) AS ultima_visita
  FROM "Clientes" c
  LEFT JOIN "Equipos" e ON e.cliente_id = c.id_cliente
  LEFT JOIN "Diagnosticos" d ON d.equipo_id = e.id_equipo
  LEFT JOIN "Ordenes" o ON o.diagnostico_id = d.id_diagnostico
  GROUP BY c.id_cliente, c.nombre, c.telefono
  ORDER BY ultima_visita DESC NULLS LAST, total_equipos DESC, cliente ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.garantias_por_vencer(
  p_dias INT DEFAULT 30
)
RETURNS TABLE (
  id_garantia INT,
  id_factura INT,
  cliente TEXT,
  equipo TEXT,
  fecha_inicio TIMESTAMP,
  fecha_vencimiento TIMESTAMP,
  dias_restantes INT,
  condiciones TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id_garantia,
    f.id_factura,
    c.nombre::TEXT AS cliente,
    CONCAT_WS(' ', e.tipo, e.marca, e.modelo)::TEXT AS equipo,
    g.fecha_inicio,
    g.fecha_vencimiento,
    (g.fecha_vencimiento::date - CURRENT_DATE)::INT AS dias_restantes,
    g.condiciones::TEXT
  FROM "Garantias" g
  JOIN "Facturas" f ON f.id_factura = g.factura_id
  JOIN "Ordenes" o ON o.id_orden = f.orden_id
  JOIN "Diagnosticos" d ON d.id_diagnostico = o.diagnostico_id
  JOIN "Equipos" e ON e.id_equipo = d.equipo_id
  JOIN "Clientes" c ON c.id_cliente = e.cliente_id
  WHERE g.fecha_vencimiento IS NOT NULL
    AND g.fecha_vencimiento::date BETWEEN CURRENT_DATE AND CURRENT_DATE + COALESCE(p_dias, 30)
  ORDER BY g.fecha_vencimiento ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.inventario_repuestos()
RETURNS TABLE (
  id_repuesto INT,
  repuesto TEXT,
  categoria TEXT,
  activo BOOLEAN,
  descontinuada BOOLEAN,
  cantidad_comprada BIGINT,
  cantidad_usada BIGINT,
  stock_estimado BIGINT,
  ultimo_costo NUMERIC,
  costo_promedio NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH compras_agg AS (
    SELECT
      c.repuesto_id,
      COALESCE(SUM(COALESCE(c.cantidad, 0)), 0)::BIGINT AS cantidad_comprada,
      COALESCE(AVG(c.costo_unitario), 0) AS costo_promedio
    FROM "Compras" c
    GROUP BY c.repuesto_id
  ),
  usos_agg AS (
    SELECT
      orp.repuesto_id,
      COALESCE(SUM(COALESCE(orp.cantidad_usada, 1)), 0)::BIGINT AS cantidad_usada
    FROM "Ordenes_Repuestos" orp
    JOIN "Facturas" f ON f.orden_id = orp.orden_id
    WHERE orp.estado_aprobacion = 'APROBADO'
    GROUP BY orp.repuesto_id
  )
  SELECT
    r.id_repuesto,
    r.nombre::TEXT AS repuesto,
    cr.nombre_tipo::TEXT AS categoria,
    r.activo,
    r.descontinuada,
    COALESCE(ca.cantidad_comprada, 0) AS cantidad_comprada,
    COALESCE(u.cantidad_usada, 0) AS cantidad_usada,
    (COALESCE(ca.cantidad_comprada, 0) - COALESCE(u.cantidad_usada, 0))::BIGINT AS stock_estimado,
    COALESCE(r.costo_individual, 0) AS ultimo_costo,
    COALESCE(ca.costo_promedio, 0) AS costo_promedio
  FROM "Repuestos" r
  LEFT JOIN "Categorias_Repuestos" cr ON cr.id_tipo_repuesto = r.tipo_repuesto_id
  LEFT JOIN compras_agg ca ON ca.repuesto_id = r.id_repuesto
  LEFT JOIN usos_agg u ON u.repuesto_id = r.id_repuesto
  ORDER BY stock_estimado ASC, repuesto ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.productividad_mensual(
  p_anio INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
)
RETURNS TABLE (
  mes INT,
  etiqueta TEXT,
  diagnosticos INT,
  ordenes_finalizadas INT,
  facturas INT,
  total_facturado NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH meses AS (
    SELECT generate_series(1, 12) AS mes
  )
  SELECT
    m.mes::INT AS mes,
    TO_CHAR(MAKE_DATE(p_anio, m.mes::INT, 1), 'Mon')::TEXT AS etiqueta,
    (
      SELECT COUNT(*)::INT
      FROM "Diagnosticos" d
      WHERE d.fecha_hora IS NOT NULL
        AND EXTRACT(YEAR FROM d.fecha_hora)::INT = p_anio
        AND EXTRACT(MONTH FROM d.fecha_hora)::INT = m.mes
    ) AS diagnosticos,
    (
      SELECT COUNT(*)::INT
      FROM "Ordenes" o
      WHERE UPPER(COALESCE(o.estado, '')) IN ('FINALIZADO', 'ENTREGADO')
        AND COALESCE(o.fecha_cierre, o.fecha_ingreso) IS NOT NULL
        AND EXTRACT(YEAR FROM COALESCE(o.fecha_cierre, o.fecha_ingreso))::INT = p_anio
        AND EXTRACT(MONTH FROM COALESCE(o.fecha_cierre, o.fecha_ingreso))::INT = m.mes
    ) AS ordenes_finalizadas,
    (
      SELECT COUNT(*)::INT
      FROM "Facturas" f
      WHERE f.fecha_emision IS NOT NULL
        AND EXTRACT(YEAR FROM f.fecha_emision)::INT = p_anio
        AND EXTRACT(MONTH FROM f.fecha_emision)::INT = m.mes
    ) AS facturas,
    (
      SELECT COALESCE(SUM(COALESCE(f.total, 0)), 0)
      FROM "Facturas" f
      WHERE f.fecha_emision IS NOT NULL
        AND EXTRACT(YEAR FROM f.fecha_emision)::INT = p_anio
        AND EXTRACT(MONTH FROM f.fecha_emision)::INT = m.mes
    ) AS total_facturado
  FROM meses m
  ORDER BY m.mes ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.productividad_anual(
  p_anio_fin INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
  p_anios_atras INT DEFAULT 4
)
RETURNS TABLE (
  anio INT,
  diagnosticos INT,
  ordenes_finalizadas INT,
  total_facturado NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_anio_inicio INT;
BEGIN
  v_anio_inicio := p_anio_fin - GREATEST(COALESCE(p_anios_atras, 4), 1);

  RETURN QUERY
  WITH anios AS (
    SELECT generate_series(v_anio_inicio, p_anio_fin) AS anio
  )
  SELECT
    a.anio::INT AS anio,
    (
      SELECT COUNT(*)::INT
      FROM "Diagnosticos" d
      WHERE d.fecha_hora IS NOT NULL
        AND EXTRACT(YEAR FROM d.fecha_hora)::INT = a.anio
    ) AS diagnosticos,
    (
      SELECT COUNT(*)::INT
      FROM "Ordenes" o
      WHERE UPPER(COALESCE(o.estado, '')) IN ('FINALIZADO', 'ENTREGADO')
        AND COALESCE(o.fecha_cierre, o.fecha_ingreso) IS NOT NULL
        AND EXTRACT(YEAR FROM COALESCE(o.fecha_cierre, o.fecha_ingreso))::INT = a.anio
    ) AS ordenes_finalizadas,
    (
      SELECT COALESCE(SUM(COALESCE(f.total, 0)), 0)
      FROM "Facturas" f
      WHERE f.fecha_emision IS NOT NULL
        AND EXTRACT(YEAR FROM f.fecha_emision)::INT = a.anio
    ) AS total_facturado
  FROM anios a
  ORDER BY a.anio ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.ganancias_mensuales(
  p_fecha_inicio DATE DEFAULT DATE_TRUNC('year', CURRENT_DATE)::DATE,
  p_fecha_fin DATE DEFAULT (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day')::DATE
)
RETURNS TABLE (
  periodo TEXT,
  etiqueta TEXT,
  ingresos NUMERIC,
  gastos NUMERIC,
  costo_repuestos_usados NUMERIC,
  ganancia_neta NUMERIC,
  margen_servicio NUMERIC,
  facturas INT,
  compras INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH limites AS (
    SELECT
      DATE_TRUNC('month', p_fecha_inicio)::DATE AS inicio,
      DATE_TRUNC('month', p_fecha_fin)::DATE AS fin
  ),
  meses AS (
    SELECT generate_series(l.inicio, l.fin, INTERVAL '1 month')::DATE AS mes
    FROM limites l
  ),
  ingresos AS (
    SELECT
      DATE_TRUNC('month', f.fecha_emision)::DATE AS mes,
      COALESCE(SUM(COALESCE(f.total, 0)), 0) AS ingresos,
      COUNT(*)::INT AS facturas
    FROM "Facturas" f
    WHERE f.fecha_emision::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
    GROUP BY DATE_TRUNC('month', f.fecha_emision)::DATE
  ),
  gastos AS (
    SELECT
      DATE_TRUNC('month', c.fecha_obtencion)::DATE AS mes,
      COALESCE(SUM(COALESCE(c.cantidad, 0) * COALESCE(c.costo_unitario, 0)), 0) AS gastos_compras,
      COUNT(*)::INT AS compras
    FROM "Compras" c
    WHERE c.fecha_obtencion::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
    GROUP BY DATE_TRUNC('month', c.fecha_obtencion)::DATE
  ),
  costos_usados AS (
    SELECT
      DATE_TRUNC('month', COALESCE(o.fecha_cierre, o.fecha_ingreso))::DATE AS mes,
      COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0) AS costo_repuestos_usados
    FROM "Ordenes_Repuestos" orp
    JOIN "Ordenes" o ON o.id_orden = orp.orden_id
    LEFT JOIN "Repuestos" r ON r.id_repuesto = orp.repuesto_id
    WHERE orp.estado_aprobacion = 'APROBADO'
      AND COALESCE(o.fecha_cierre, o.fecha_ingreso)::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
    GROUP BY DATE_TRUNC('month', COALESCE(o.fecha_cierre, o.fecha_ingreso))::DATE
  )
  SELECT
    TO_CHAR(m.mes, 'YYYY-MM')::TEXT AS periodo,
    TO_CHAR(m.mes, 'Mon YYYY')::TEXT AS etiqueta,
    COALESCE(i.ingresos, 0) AS ingresos,
    COALESCE(g.gastos_compras, 0) AS gastos,
    COALESCE(cu.costo_repuestos_usados, 0) AS costo_repuestos_usados,
    COALESCE(i.ingresos, 0) - COALESCE(g.gastos_compras, 0) AS ganancia_neta,
    COALESCE(i.ingresos, 0) - COALESCE(cu.costo_repuestos_usados, 0) AS margen_servicio,
    COALESCE(i.facturas, 0)::INT AS facturas,
    COALESCE(g.compras, 0)::INT AS compras
  FROM meses m
  LEFT JOIN ingresos i ON i.mes = m.mes
  LEFT JOIN gastos g ON g.mes = m.mes
  LEFT JOIN costos_usados cu ON cu.mes = m.mes
  ORDER BY m.mes ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.ganancias_detalle(
  p_fecha_inicio DATE DEFAULT DATE_TRUNC('year', CURRENT_DATE)::DATE,
  p_fecha_fin DATE DEFAULT (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day')::DATE,
  p_limite INT DEFAULT 12
)
RETURNS TABLE (
  tipo TEXT,
  fecha TIMESTAMP,
  concepto TEXT,
  monto NUMERIC,
  metodo_pago TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM (
    SELECT
      'Ingreso'::TEXT AS tipo,
      f.fecha_emision AS fecha,
      CONCAT('Factura #', f.id_factura)::TEXT AS concepto,
      COALESCE(f.total, 0) AS monto,
      f.metodo_pago::TEXT AS metodo_pago
    FROM "Facturas" f
    WHERE f.fecha_emision::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
    UNION ALL
    SELECT
      'Gasto'::TEXT AS tipo,
      c.fecha_obtencion AS fecha,
      CONCAT('Compra #', c.id_compra, ' - ', COALESCE(r.nombre, 'Repuesto'))::TEXT AS concepto,
      COALESCE(c.cantidad, 0) * COALESCE(c.costo_unitario, 0) AS monto,
      c.metodo_pago::TEXT AS metodo_pago
    FROM "Compras" c
    LEFT JOIN "Repuestos" r ON r.id_repuesto = c.repuesto_id
    WHERE c.fecha_obtencion::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
  ) movimientos
  ORDER BY fecha DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limite, 12), 1);
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.ganancias_fuentes(
  p_fecha_inicio DATE DEFAULT DATE_TRUNC('year', CURRENT_DATE)::DATE,
  p_fecha_fin DATE DEFAULT (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day')::DATE,
  p_limite INT DEFAULT 100
)
RETURNS TABLE (
  fuente TEXT,
  fecha TIMESTAMP,
  referencia TEXT,
  cliente TEXT,
  equipo TEXT,
  tecnico TEXT,
  estado TEXT,
  ingreso_total NUMERIC,
  mano_obra NUMERIC,
  ingreso_repuestos NUMERIC,
  costo_repuestos NUMERIC,
  ganancia_repuestos NUMERIC,
  ganancia_total NUMERIC,
  margen_porcentaje NUMERIC,
  motivo TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
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
      'Ganancia por diagnóstico ', COALESCE(f.monto_diagnostico, 0),
      ', mano de obra ', COALESCE(f.mano_obra, 0),
      ' y margen de repuestos ', COALESCE(f.monto_repuestos, 0) - COALESCE(SUM(COALESCE(orp.cantidad_usada, 1) * COALESCE(r.costo_individual, 0)), 0)
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
  WHERE f.fecha_emision::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
    AND (o.id_orden IS NULL OR UPPER(COALESCE(o.estado, '')) IN ('FINALIZADO', 'ENTREGADO', 'IRREPARABLE'))
  GROUP BY o.id_orden, d.id_diagnostico, d.estado_del_diagnostico, f.id_factura, f.fecha_emision, cl.nombre, e.tipo, e.marca, e.modelo, f.total, f.mano_obra, f.monto_repuestos, f.monto_diagnostico, t.nombre, dt.nombre, o.estado
  ORDER BY ganancia_total DESC, f.fecha_emision DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limite, 100), 1);
END;
$$;

CREATE OR REPLACE FUNCTION admin_pro.perdidas_fuentes(
  p_fecha_inicio DATE DEFAULT DATE_TRUNC('year', CURRENT_DATE)::DATE,
  p_fecha_fin DATE DEFAULT (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day')::DATE,
  p_limite INT DEFAULT 100
)
RETURNS TABLE (
  tipo TEXT,
  fecha TIMESTAMP,
  referencia TEXT,
  cliente TEXT,
  equipo TEXT,
  tecnico TEXT,
  concepto TEXT,
  monto NUMERIC,
  razon TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
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
      AND COALESCE(f.fecha_emision, o.fecha_cierre, o.fecha_ingreso)::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
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
      AND COALESCE(o.fecha_cierre, o.fecha_ingreso)::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
  ) fuentes
  ORDER BY monto DESC, fecha DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limite, 100), 1);
END;
$$;
