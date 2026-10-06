-- La columna se crea con Prisma; los registros anteriores conservan NIO.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"Diagnosticos"'::regclass AND conname = 'diagnosticos_moneda_presupuesto_check') THEN
    ALTER TABLE "Diagnosticos" ADD CONSTRAINT diagnosticos_moneda_presupuesto_check CHECK (moneda_presupuesto IN ('NIO', 'USD'));
  END IF;
END;
$$;

-- Cambia la firma del resultado para identificar la moneda sin sumar NIO con USD.
DROP FUNCTION IF EXISTS admin_pro.diagnosticos_por_estado(DATE, DATE);
CREATE FUNCTION admin_pro.diagnosticos_por_estado(
  p_fecha_inicio DATE DEFAULT NULL,
  p_fecha_fin DATE DEFAULT NULL
)
RETURNS TABLE (
  estado TEXT,
  aprobacion TEXT,
  cantidad BIGINT,
  moneda TEXT,
  presupuesto_total NUMERIC,
  presupuesto_promedio NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(d.estado_del_diagnostico, 'SIN_ESTADO')::TEXT AS estado,
    COALESCE(d."Estado_aprobacion", 'SIN_APROBACION')::TEXT AS aprobacion,
    COUNT(*)::BIGINT AS cantidad,
    d.moneda_presupuesto::TEXT AS moneda,
    COALESCE(SUM(d.presupuesto_estimado), 0) AS presupuesto_total,
    COALESCE(AVG(d.presupuesto_estimado), 0) AS presupuesto_promedio
  FROM "Diagnosticos" d
  WHERE (p_fecha_inicio IS NULL OR d.fecha_hora::date >= p_fecha_inicio)
    AND (p_fecha_fin IS NULL OR d.fecha_hora::date <= p_fecha_fin)
  GROUP BY COALESCE(d.estado_del_diagnostico, 'SIN_ESTADO'), COALESCE(d."Estado_aprobacion", 'SIN_APROBACION'), d.moneda_presupuesto
  ORDER BY cantidad DESC, estado ASC, aprobacion ASC, moneda ASC;
END;
$$;
