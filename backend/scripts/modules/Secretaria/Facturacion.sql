CREATE INDEX IF NOT EXISTS idx_ordenes_estado_fecha_ingreso
ON "Ordenes" (estado, fecha_ingreso DESC, id_orden DESC);

CREATE INDEX IF NOT EXISTS idx_ordenes_diagnostico_id
ON "Ordenes" (diagnostico_id);

CREATE INDEX IF NOT EXISTS idx_facturas_fecha_emision_id
ON "Facturas" (fecha_emision DESC, id_factura DESC);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_equipo_id
ON "Diagnosticos" (equipo_id);

CREATE INDEX IF NOT EXISTS idx_equipos_cliente_id
ON "Equipos" (cliente_id);

CREATE INDEX IF NOT EXISTS idx_ordenes_repuestos_orden_estado
ON "Ordenes_Repuestos" (orden_id, estado_aprobacion, repuesto_id);

CREATE OR REPLACE VIEW secretaria_facturas_detalle AS
SELECT
  f.id_factura,
  f.fecha_emision,
  jsonb_build_object(
    'id_factura', f.id_factura,
    'orden_id', f.orden_id,
    'diagnostico_id', COALESCE(f.diagnostico_id, o.diagnostico_id),
    'fecha_emision', f.fecha_emision,
    'monto_repuestos', f.monto_repuestos,
    'mano_obra', f.mano_obra,
    'monto_diagnostico', f.monto_diagnostico,
    'subtotal', f.subtotal,
    'impuestos', f.impuestos,
    'total', f.total,
    'metodo_pago', f.metodo_pago,
    'garantias', COALESCE(garantias.items, '[]'::jsonb),
    'diagnostico', to_jsonb(d.*) || jsonb_build_object(
      'equipo', to_jsonb(e.*) || jsonb_build_object('cliente', to_jsonb(c.*))
    ),
    'orden', CASE WHEN o.id_orden IS NULL THEN NULL ELSE to_jsonb(o.*) || jsonb_build_object(
      'diagnostico', to_jsonb(d.*) || jsonb_build_object(
        'equipo', to_jsonb(e.*) || jsonb_build_object('cliente', to_jsonb(c.*))
      )
    ) END
  ) AS data
FROM "Facturas" f
LEFT JOIN "Ordenes" o ON o.id_orden = f.orden_id
JOIN "Diagnosticos" d ON d.id_diagnostico = COALESCE(f.diagnostico_id, o.diagnostico_id)
JOIN "Equipos" e ON e.id_equipo = d.equipo_id
JOIN "Clientes" c ON c.id_cliente = e.cliente_id
LEFT JOIN LATERAL (
  SELECT jsonb_agg(to_jsonb(g.*) ORDER BY g.id_garantia) AS items
  FROM "Garantias" g
  WHERE g.factura_id = f.id_factura
) garantias ON TRUE;

CREATE OR REPLACE VIEW secretaria_ordenes_facturables AS
SELECT
  o.id_orden,
  o.fecha_ingreso,
  jsonb_build_object(
    'id_orden', o.id_orden,
    'diagnostico_id', o.diagnostico_id,
    'tecnico_id', o.tecnico_id,
    'prioridad', o.prioridad,
    'estado', o.estado,
    'fecha_ingreso', o.fecha_ingreso,
    'fecha_asignacion', o.fecha_asignacion,
    'resultado_final', o.resultado_final,
    'enciende_salida', o.enciende_salida,
    'usa_corriente_ac_salida', o.usa_corriente_ac_salida,
    'observacion_final', o.observacion_final,
    'fecha_cierre', o.fecha_cierre,
    'fecha_finalizacion', o.fecha_finalizacion,
    'requiere_piezas', o.requiere_piezas,
    'justificacion_irreparable', o.justificacion_irreparable,
    'irreparable_estado', o.irreparable_estado,
    'facturas', '[]'::jsonb,
    'monto_repuestos_calculado',
      CASE
        WHEN upper(COALESCE(o.estado, '')) = 'IRREPARABLE' THEN 0
        ELSE COALESCE(repuestos.monto_repuestos, 0)
      END,
    'repuestos_facturacion', COALESCE(repuestos.items, '[]'::jsonb),
    'repuestos_usados', COALESCE(repuestos.items, '[]'::jsonb),
    'repuestos_pendientes_count', COALESCE(repuestos.pendientes_count, 0),
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
LEFT JOIN "Facturas" f ON f.orden_id = o.id_orden
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id_detalle_repuesto', orp.id_detalle_repuesto,
        'orden_id', orp.orden_id,
        'repuesto_id', orp.repuesto_id,
        'pieza_solicitada', orp.pieza_solicitada,
        'cantidad_usada', orp.cantidad_usada,
        'estado_entrega', orp.estado_entrega,
        'fecha_entrega', orp.fecha_entrega,
        'estado_aprobacion', orp.estado_aprobacion,
        'repuesto', to_jsonb(r.*),
        'precio_unitario', ROUND(
          (
            COALESCE(r.costo_individual, 0)
            + CASE
                WHEN COALESCE(r.ganancia_cordobas, 0) > 0 THEN COALESCE(r.ganancia_cordobas, 0)
                WHEN COALESCE(r.porcentaje_de_ganacia, 0) > 0 THEN COALESCE(r.costo_individual, 0) * COALESCE(r.porcentaje_de_ganacia, 0) / 100
                ELSE 0
              END
          )::numeric,
          2
        ),
        'total', ROUND(
          (
            COALESCE(orp.cantidad_usada, 0)
            * (
              COALESCE(r.costo_individual, 0)
              + CASE
                  WHEN COALESCE(r.ganancia_cordobas, 0) > 0 THEN COALESCE(r.ganancia_cordobas, 0)
                  WHEN COALESCE(r.porcentaje_de_ganacia, 0) > 0 THEN COALESCE(r.costo_individual, 0) * COALESCE(r.porcentaje_de_ganacia, 0) / 100
                  ELSE 0
                END
            )
          )::numeric,
          2
        )
      )
      ORDER BY orp.id_detalle_repuesto
    ) AS items,
    ROUND(
      COALESCE(SUM(
        CASE
          WHEN upper(COALESCE(orp.estado_aprobacion, '')) = 'APROBADO' THEN
            COALESCE(orp.cantidad_usada, 0)
            * (
              COALESCE(r.costo_individual, 0)
              + CASE
                  WHEN COALESCE(r.ganancia_cordobas, 0) > 0 THEN COALESCE(r.ganancia_cordobas, 0)
                  WHEN COALESCE(r.porcentaje_de_ganacia, 0) > 0 THEN COALESCE(r.costo_individual, 0) * COALESCE(r.porcentaje_de_ganacia, 0) / 100
                  ELSE 0
                END
            )
          ELSE 0
        END
      ), 0)::numeric,
      2
    ) AS monto_repuestos,
    COUNT(*) FILTER (
      WHERE upper(COALESCE(orp.estado_aprobacion, '')) NOT IN ('APROBADO', 'DENEGADO')
        OR (orp.estado_aprobacion = 'APROBADO' AND orp.repuesto_id IS NULL)
    )::int AS pendientes_count
  FROM "Ordenes_Repuestos" orp
  LEFT JOIN "Repuestos" r ON r.id_repuesto = orp.repuesto_id
  WHERE orp.orden_id = o.id_orden
) repuestos ON TRUE
WHERE f.id_factura IS NULL
  AND upper(COALESCE(o.estado, '')) IN ('FINALIZADO', 'IRREPARABLE')
  AND (
    upper(COALESCE(o.estado, '')) = 'IRREPARABLE'
    OR COALESCE(repuestos.pendientes_count, 0) = 0
  );
