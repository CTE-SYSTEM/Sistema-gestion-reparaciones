CREATE INDEX IF NOT EXISTS idx_clientes_activo_id
ON "Clientes" (activo, id_cliente DESC);

CREATE INDEX IF NOT EXISTS idx_proveedores_descontinuada_id
ON "Proveedores" (descontinuada, id_proveedor DESC);

CREATE INDEX IF NOT EXISTS idx_repuestos_descontinuada_activo_stock
ON "Repuestos" (descontinuada, activo, stock_actual, id_repuesto DESC);

CREATE INDEX IF NOT EXISTS idx_tipos_repuesto_id
ON "Categorias_Repuestos" (id_tipo_repuesto DESC);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_estado_fecha
ON "Diagnosticos" (estado_del_diagnostico, fecha_hora DESC, id_diagnostico DESC);

CREATE OR REPLACE FUNCTION get_secretaria_dashboard(p_periodo TEXT DEFAULT 'all')
RETURNS TABLE (data JSONB) AS $$
DECLARE
  v_periodo TEXT := lower(COALESCE(p_periodo, 'all'));
  v_inicio TIMESTAMP;
  v_fin TIMESTAMP;
  v_inicio_local TIMESTAMP;
  v_fin_local TIMESTAMP;
BEGIN
  IF v_periodo = 'week' THEN
    v_inicio_local := date_trunc('week', now() AT TIME ZONE 'America/Managua');
    v_fin_local := v_inicio_local + INTERVAL '1 week';
  ELSIF v_periodo = 'month' THEN
    v_inicio_local := date_trunc('month', now() AT TIME ZONE 'America/Managua');
    v_fin_local := v_inicio_local + INTERVAL '1 month';
  ELSIF v_periodo = 'year' THEN
    v_inicio_local := date_trunc('year', now() AT TIME ZONE 'America/Managua');
    v_fin_local := v_inicio_local + INTERVAL '1 year';
  ELSE
    v_periodo := 'all';
  END IF;
  IF v_inicio_local IS NOT NULL THEN
    v_inicio := (v_inicio_local AT TIME ZONE 'America/Managua') AT TIME ZONE 'UTC';
    v_fin := (v_fin_local AT TIME ZONE 'America/Managua') AT TIME ZONE 'UTC';
  END IF;

  RETURN QUERY
  WITH altas_periodo AS (
    SELECT tabla, COUNT(*)::int AS total
    FROM "Auditoria_Movimientos"
    WHERE operacion = 'INSERT'
      AND v_inicio IS NOT NULL
      AND fecha_movimiento >= v_inicio AND fecha_movimiento < v_fin
      AND tabla IN ('Clientes', 'Equipos', 'Proveedores', 'Repuestos', 'Categorias_Repuestos')
    GROUP BY tabla
  ), ordenes_filtradas AS (
    SELECT
      o.*,
      jsonb_build_object(
        'id_orden', o.id_orden,
        'diagnostico_id', o.diagnostico_id,
        'tecnico_id', o.tecnico_id,
        'prioridad', o.prioridad,
        'estado', o.estado,
        'fecha_ingreso', o.fecha_ingreso,
        'fecha_asignacion', o.fecha_asignacion,
        'resultado_final', o.resultado_final,
        'fecha_finalizacion', o.fecha_finalizacion,
        'requiere_piezas', o.requiere_piezas,
        'diagnostico', to_jsonb(d.*) || jsonb_build_object(
          'equipo', to_jsonb(e.*) || jsonb_build_object('cliente', to_jsonb(c.*))
        ),
        'tecnico', to_jsonb(t.*)
      ) AS data
    FROM "Ordenes" o
    JOIN "Diagnosticos" d ON d.id_diagnostico = o.diagnostico_id
    JOIN "Equipos" e ON e.id_equipo = d.equipo_id
    JOIN "Clientes" c ON c.id_cliente = e.cliente_id
    LEFT JOIN "Tecnicos" t ON t.id_tecnico = o.tecnico_id
    WHERE v_inicio IS NULL OR (o.fecha_ingreso >= v_inicio AND o.fecha_ingreso < v_fin)
  ),
  recent_orders AS (
    SELECT COALESCE(jsonb_agg(ofi.data ORDER BY ofi.fecha_ingreso DESC NULLS LAST, ofi.id_orden DESC), '[]'::jsonb) AS items
    FROM (
      SELECT *
      FROM ordenes_filtradas
      ORDER BY fecha_ingreso DESC NULLS LAST, id_orden DESC
      LIMIT 5
    ) ofi
  )
  SELECT jsonb_build_object(
    'periodo', v_periodo,
    'stats', jsonb_build_object(
      'clientes', CASE WHEN v_inicio IS NULL THEN (SELECT COUNT(*)::int FROM "Clientes" WHERE activo = true) ELSE COALESCE((SELECT total FROM altas_periodo WHERE tabla = 'Clientes'), 0) END,
      'equipos', CASE WHEN v_inicio IS NULL THEN (SELECT COUNT(*)::int FROM "Equipos") ELSE COALESCE((SELECT total FROM altas_periodo WHERE tabla = 'Equipos'), 0) END,
      'ordenes', (SELECT COUNT(*)::int FROM ordenes_filtradas),
      'proveedores', CASE WHEN v_inicio IS NULL THEN (SELECT COUNT(*)::int FROM "Proveedores" WHERE descontinuada = false) ELSE COALESCE((SELECT total FROM altas_periodo WHERE tabla = 'Proveedores'), 0) END,
      'repuestos', CASE WHEN v_inicio IS NULL THEN (SELECT COUNT(*)::int FROM "Repuestos" WHERE descontinuada = false) ELSE COALESCE((SELECT total FROM altas_periodo WHERE tabla = 'Repuestos'), 0) END,
      'tiposRepuesto', CASE WHEN v_inicio IS NULL THEN (SELECT COUNT(*)::int FROM "Categorias_Repuestos") ELSE COALESCE((SELECT total FROM altas_periodo WHERE tabla = 'Categorias_Repuestos'), 0) END,
      'facturas', (
        SELECT COUNT(*)::int
        FROM "Facturas" f
        WHERE v_inicio IS NULL OR (f.fecha_emision >= v_inicio AND f.fecha_emision < v_fin)
      ),
      'diagnosticos', (
        SELECT COUNT(*)::int
        FROM "Diagnosticos" d
        WHERE v_inicio IS NULL OR (d.fecha_hora >= v_inicio AND d.fecha_hora < v_fin)
      ),
      'equiposEnTaller', (
        SELECT COUNT(*)::int
        FROM "Ordenes" o
        WHERE COALESCE(o.estado, '') NOT IN ('FINALIZADO', 'ENTREGADO')
      ),
      'diagnosticosPendientes', (
        SELECT COUNT(*)::int
        FROM "Diagnosticos" d
        WHERE d.estado_del_diagnostico = 'PENDIENTE'
      ),
      'ingresosPeriodo', (
        SELECT COALESCE(SUM(f.total), 0)
        FROM "Facturas" f
        WHERE v_inicio IS NULL OR (f.fecha_emision >= v_inicio AND f.fecha_emision < v_fin)
      )
    ),
    'recentOrders', (SELECT items FROM recent_orders)
  );
END;
$$ LANGUAGE plpgsql;
