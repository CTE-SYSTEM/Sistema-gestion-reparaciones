CREATE OR REPLACE FUNCTION secretaria_emitir_garantia_factura()
RETURNS TRIGGER AS $$
DECLARE
  condiciones_garantia TEXT;
  fecha_entrega_equipo TIMESTAMP;
  estado_orden TEXT;
BEGIN
  IF NEW.orden_id IS NULL THEN RETURN NEW; END IF;
  SELECT o.fecha_entrega, o.estado INTO fecha_entrega_equipo, estado_orden FROM "Ordenes" o WHERE o.id_orden = NEW.orden_id;
  IF estado_orden IS DISTINCT FROM 'FINALIZADO' THEN RETURN NEW; END IF;
  condiciones_garantia :=
    'Garantia de 3 meses sujeta a la reparacion realizada y a los repuestos instalados por el centro tecnico. '
    || 'Cubre fallas directamente relacionadas con el trabajo facturado. '
    || 'No cubre golpes, humedad, derrames, variaciones electricas, mala manipulacion, software, virus, perdida de informacion, accesorios externos ni reparaciones realizadas por terceros.';

  INSERT INTO "Garantias" (
    factura_id,
    condiciones,
    duracion_meses,
    fecha_inicio,
    fecha_vencimiento
  )
  VALUES (
    NEW.id_factura,
    condiciones_garantia,
    3,
    fecha_entrega_equipo,
    fecha_entrega_equipo + INTERVAL '3 months'
  )
  ON CONFLICT (factura_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emitir_garantia_factura ON "Facturas";

CREATE TRIGGER trg_emitir_garantia_factura
AFTER INSERT ON "Facturas"
FOR EACH ROW
EXECUTE FUNCTION secretaria_emitir_garantia_factura();

CREATE INDEX IF NOT EXISTS idx_garantias_fecha_vencimiento
ON "Garantias" (fecha_vencimiento ASC, id_garantia DESC);

CREATE INDEX IF NOT EXISTS idx_garantias_factura_id
ON "Garantias" (factura_id);

CREATE OR REPLACE VIEW secretaria_garantias_detalle AS
SELECT
  g.id_garantia,
  g.fecha_vencimiento,
  jsonb_build_object(
    'id_garantia', g.id_garantia,
    'factura_id', g.factura_id,
    'condiciones', g.condiciones,
    'duracion_meses', g.duracion_meses,
    'fecha_inicio', g.fecha_inicio,
    'fecha_vencimiento', g.fecha_vencimiento,
    'factura', f.data - 'garantias'
  ) AS data
FROM "Garantias" g
JOIN secretaria_facturas_detalle f ON f.id_factura = g.factura_id;
