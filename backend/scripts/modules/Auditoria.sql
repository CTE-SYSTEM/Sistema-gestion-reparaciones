CREATE TABLE IF NOT EXISTS "Auditoria_Movimientos" (
  id_auditoria BIGSERIAL PRIMARY KEY,
  tabla TEXT NOT NULL,
  operacion TEXT NOT NULL,
  registro_pk JSONB,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  usuario_id INT,
  usuario_nombre TEXT,
  origen TEXT DEFAULT 'database',
  observacion TEXT,
  fecha_movimiento TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_fecha
  ON "Auditoria_Movimientos" (tabla, fecha_movimiento DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_operacion_fecha
  ON "Auditoria_Movimientos" (operacion, fecha_movimiento DESC);

CREATE OR REPLACE FUNCTION auditoria_pk_json(p_table TEXT, p_row JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  CASE p_table
    WHEN 'Usuarios' THEN RETURN jsonb_build_object('id_usuario', p_row->'id_usuario');
    WHEN 'Tecnicos' THEN RETURN jsonb_build_object('id_tecnico', p_row->'id_tecnico');
    WHEN 'Clientes' THEN RETURN jsonb_build_object('id_cliente', p_row->'id_cliente');
    WHEN 'Equipos' THEN RETURN jsonb_build_object('id_equipo', p_row->'id_equipo');
    WHEN 'Diagnosticos' THEN RETURN jsonb_build_object('id_diagnostico', p_row->'id_diagnostico');
    WHEN 'Ordenes' THEN RETURN jsonb_build_object('id_orden', p_row->'id_orden');
    WHEN 'BitacoraTecnica' THEN RETURN jsonb_build_object('id_avance', p_row->'id_avance');
    WHEN 'ArchivosServicio' THEN RETURN jsonb_build_object('id_archivo', p_row->'id_archivo');
    WHEN 'Categorias_Repuestos' THEN RETURN jsonb_build_object('id_tipo_repuesto', p_row->'id_tipo_repuesto');
    WHEN 'Repuestos' THEN RETURN jsonb_build_object('id_repuesto', p_row->'id_repuesto');
    WHEN 'Ordenes_Repuestos' THEN RETURN jsonb_build_object('id_detalle_repuesto', p_row->'id_detalle_repuesto');
    WHEN 'Proveedores' THEN RETURN jsonb_build_object('id_proveedor', p_row->'id_proveedor');
    WHEN 'Compras' THEN RETURN jsonb_build_object('id_compra', p_row->'id_compra');
    WHEN 'Facturas' THEN RETURN jsonb_build_object('id_factura', p_row->'id_factura');
    WHEN 'Garantias' THEN RETURN jsonb_build_object('id_garantia', p_row->'id_garantia');
    ELSE RETURN NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION auditoria_registrar_movimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old JSONB;
  v_new JSONB;
  v_pk JSONB;
  v_usuario_id INT;
  v_usuario_nombre TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Auditoria_Movimientos' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_old := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  IF TG_TABLE_NAME = 'Usuarios' THEN
    v_old := v_old - 'contrasena_hash';
    v_new := v_new - 'contrasena_hash';
  END IF;
  v_pk := auditoria_pk_json(TG_TABLE_NAME, COALESCE(v_new, v_old));

  BEGIN
    v_usuario_id := NULLIF(current_setting('app.usuario_id', true), '')::INT;
  EXCEPTION WHEN others THEN
    v_usuario_id := NULL;
  END;

  v_usuario_nombre := NULLIF(current_setting('app.usuario_nombre', true), '');

  INSERT INTO "Auditoria_Movimientos" (
    tabla,
    operacion,
    registro_pk,
    datos_anteriores,
    datos_nuevos,
    usuario_id,
    usuario_nombre,
    origen,
    observacion
  )
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_pk,
    v_old,
    v_new,
    v_usuario_id,
    v_usuario_nombre,
    'trigger',
    CASE
      WHEN TG_OP = 'DELETE' THEN 'Borrado fisico detectado; revisar si debia ser desactivacion logica.'
      ELSE NULLIF(current_setting('app.observacion', true), '')
    END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE PROCEDURE auditoria_instalar_triggers()
LANGUAGE plpgsql
AS $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'Usuarios',
    'Tecnicos',
    'Clientes',
    'Equipos',
    'Diagnosticos',
    'Ordenes',
    'Categorias_Repuestos',
    'Repuestos',
    'Ordenes_Repuestos',
    'Proveedores',
    'Compras',
    'Facturas',
    'Garantias'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria_%s ON %I', lower(v_table), v_table);
    EXECUTE format(
      'CREATE TRIGGER trg_auditoria_%s AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION auditoria_registrar_movimiento()',
      lower(v_table),
      v_table
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION auditoria_capturar_estado_actual(p_observacion TEXT DEFAULT 'Carga inicial de datos actuales')
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_insertados INT := 0;
  v_count INT;
BEGIN
  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Usuarios', 'CARGA_INICIAL', auditoria_pk_json('Usuarios', to_jsonb(t)), to_jsonb(t) - 'contrasena_hash', 'snapshot', p_observacion FROM "Usuarios" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Tecnicos', 'CARGA_INICIAL', auditoria_pk_json('Tecnicos', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Tecnicos" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Clientes', 'CARGA_INICIAL', auditoria_pk_json('Clientes', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Clientes" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Equipos', 'CARGA_INICIAL', auditoria_pk_json('Equipos', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Equipos" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Diagnosticos', 'CARGA_INICIAL', auditoria_pk_json('Diagnosticos', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Diagnosticos" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Ordenes', 'CARGA_INICIAL', auditoria_pk_json('Ordenes', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Ordenes" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Categorias_Repuestos', 'CARGA_INICIAL', auditoria_pk_json('Categorias_Repuestos', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Categorias_Repuestos" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Repuestos', 'CARGA_INICIAL', auditoria_pk_json('Repuestos', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Repuestos" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Ordenes_Repuestos', 'CARGA_INICIAL', auditoria_pk_json('Ordenes_Repuestos', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Ordenes_Repuestos" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Proveedores', 'CARGA_INICIAL', auditoria_pk_json('Proveedores', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Proveedores" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Compras', 'CARGA_INICIAL', auditoria_pk_json('Compras', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Compras" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Facturas', 'CARGA_INICIAL', auditoria_pk_json('Facturas', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Facturas" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  INSERT INTO "Auditoria_Movimientos" (tabla, operacion, registro_pk, datos_nuevos, origen, observacion)
  SELECT 'Garantias', 'CARGA_INICIAL', auditoria_pk_json('Garantias', to_jsonb(t)), to_jsonb(t), 'snapshot', p_observacion FROM "Garantias" t;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_insertados := v_insertados + v_count;

  RETURN v_insertados;
END;
$$;

CALL auditoria_instalar_triggers();
