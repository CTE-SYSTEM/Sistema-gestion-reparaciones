-- Migración aditiva: conserva usuarios, operaciones y garantías existentes.
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS sesion_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "ConfiguracionAdministracion" (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  valores JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  actualizado_por INTEGER,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "EstadoRespaldos" (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  configuracion TEXT NOT NULL,
  proxima_ejecucion TIMESTAMPTZ,
  ultimo_intento TIMESTAMPTZ,
  ultimo_exito TIMESTAMPTZ,
  reintentos INTEGER NOT NULL DEFAULT 0,
  ultimo_error TEXT
);

CREATE OR REPLACE FUNCTION secretaria_emitir_garantia_factura()
RETURNS TRIGGER AS $$
DECLARE
  condiciones_garantia TEXT;
  fecha_entrega_equipo TIMESTAMP;
  meses_garantia INTEGER := 3;
  configuracion JSONB;
  estado_orden TEXT;
BEGIN
  IF NEW.orden_id IS NULL THEN RETURN NEW; END IF;
  SELECT o.estado, o.fecha_entrega INTO estado_orden, fecha_entrega_equipo FROM "Ordenes" o WHERE o.id_orden = NEW.orden_id;
  IF estado_orden IS DISTINCT FROM 'FINALIZADO' THEN RETURN NEW; END IF;
  SELECT valores->'negocio' INTO configuracion FROM "ConfiguracionAdministracion" WHERE id = 1;
  meses_garantia := COALESCE((configuracion->>'garantia_meses')::INTEGER, 3);
  condiciones_garantia := COALESCE(NULLIF(configuracion->>'garantia_condiciones', ''),
    'Cubre fallas relacionadas con la reparación y los repuestos instalados. No cubre golpes, humedad, variaciones eléctricas, mala manipulación ni intervenciones de terceros.');
  INSERT INTO "Garantias" (factura_id, condiciones, duracion_meses, fecha_inicio, fecha_vencimiento)
  VALUES (NEW.id_factura, condiciones_garantia, meses_garantia, fecha_entrega_equipo,
    fecha_entrega_equipo + make_interval(months => meses_garantia))
  ON CONFLICT (factura_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
