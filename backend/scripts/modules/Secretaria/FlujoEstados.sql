-- Fechas e historial de las transiciones. Se instala despues de sincronizar Prisma.
ALTER TABLE "Diagnosticos" DROP CONSTRAINT IF EXISTS chk_diagnosticos_contacto;
ALTER TABLE "Diagnosticos" ADD CONSTRAINT chk_diagnosticos_contacto CHECK
  (estado_contacto IN ('PENDIENTE_CONTACTAR', 'DOCUMENTO_ENVIADO', 'ESPERANDO_RESPUESTA', 'APROBADO', 'RECHAZADO', 'SIN_RESPUESTA'));
ALTER TABLE "Diagnosticos" DROP CONSTRAINT IF EXISTS chk_diagnosticos_equipo;
ALTER TABLE "Diagnosticos" ADD CONSTRAINT chk_diagnosticos_equipo CHECK
  (estado_equipo IN ('EN_TALLER', 'ESPERANDO_RETIRO', 'RETIRADO_SIN_REPARAR'));
ALTER TABLE "Diagnosticos" DROP CONSTRAINT IF EXISTS chk_recepcion_cargador;
ALTER TABLE "Diagnosticos" ADD CONSTRAINT chk_recepcion_cargador CHECK
  (estado_cargador IS NULL OR estado_cargador IN ('ENTREGADO', 'NO_ENTREGADO', 'NO_INCLUIDO', 'NO_VERIFICADO'));
ALTER TABLE "Diagnosticos" DROP CONSTRAINT IF EXISTS chk_recepcion_accesorios;
ALTER TABLE "Diagnosticos" ADD CONSTRAINT chk_recepcion_accesorios CHECK
  (estado_accesorios IS NULL OR estado_accesorios IN ('COMPLETOS', 'INCOMPLETOS', 'SIN_ACCESORIOS', 'NO_VERIFICADOS'));
ALTER TABLE "Diagnosticos" DROP CONSTRAINT IF EXISTS chk_recepcion_fisico;
ALTER TABLE "Diagnosticos" ADD CONSTRAINT chk_recepcion_fisico CHECK
  (estado_fisico IS NULL OR estado_fisico IN ('SIN_DANOS', 'DANOS_LEVES', 'DANOS_GRAVES', 'NO_VERIFICADO'));
ALTER TABLE "Diagnosticos" DROP CONSTRAINT IF EXISTS chk_recepcion_encendido;
ALTER TABLE "Diagnosticos" ADD CONSTRAINT chk_recepcion_encendido CHECK
  (estado_encendido IS NULL OR estado_encendido IN ('ENCIENDE', 'NO_ENCIENDE', 'INTERMITENTE', 'NO_PROBADO'));
ALTER TABLE "Diagnosticos" DROP CONSTRAINT IF EXISTS chk_recepcion_alimentacion;
ALTER TABLE "Diagnosticos" ADD CONSTRAINT chk_recepcion_alimentacion CHECK
  (estado_alimentacion IS NULL OR estado_alimentacion IN ('FUNCIONA', 'NO_FUNCIONA', 'INTERMITENTE', 'NO_PROBADA'));
ALTER TABLE "Diagnosticos" DROP CONSTRAINT IF EXISTS chk_recepcion_acceso;
ALTER TABLE "Diagnosticos" ADD CONSTRAINT chk_recepcion_acceso CHECK
  (estado_acceso IS NULL OR estado_acceso IN ('NO_REQUIERE', 'ENTREGADO', 'NO_ENTREGADO', 'NO_VERIFICADO'));
ALTER TABLE "Repuestos" DROP CONSTRAINT IF EXISTS chk_repuestos_stock_minimo;
ALTER TABLE "Repuestos" ADD CONSTRAINT chk_repuestos_stock_minimo CHECK (stock_minimo >= 0);
ALTER TABLE "ArchivosServicio" DROP CONSTRAINT IF EXISTS chk_archivos_servicio_origen;
ALTER TABLE "ArchivosServicio" ADD CONSTRAINT chk_archivos_servicio_origen CHECK
  ((diagnostico_id IS NOT NULL AND orden_id IS NULL) OR (diagnostico_id IS NULL AND orden_id IS NOT NULL));
ALTER TABLE "ArchivosServicio" DROP CONSTRAINT IF EXISTS chk_archivos_servicio_tipo;
ALTER TABLE "ArchivosServicio" ADD CONSTRAINT chk_archivos_servicio_tipo CHECK
  ((diagnostico_id IS NOT NULL AND tipo_archivo IN ('FOTO_RECEPCION', 'FOTO_DIAGNOSTICO', 'FOTO_SALIDA_SIN_REPARAR'))
   OR (orden_id IS NOT NULL AND tipo_archivo IN ('FOTO_REPARACION', 'FOTO_ENTREGA')));
ALTER TABLE "Ordenes" DROP CONSTRAINT IF EXISTS chk_ordenes_monto_autorizado;
ALTER TABLE "Ordenes" ADD CONSTRAINT chk_ordenes_monto_autorizado CHECK (monto_autorizado IS NULL OR monto_autorizado > 0);
ALTER TABLE "Ordenes" DROP CONSTRAINT IF EXISTS chk_ordenes_cancelacion_motivo;
ALTER TABLE "Ordenes" ADD CONSTRAINT chk_ordenes_cancelacion_motivo CHECK
  (estado IS DISTINCT FROM 'CANCELADO' OR NULLIF(BTRIM(motivo_cancelacion), '') IS NOT NULL);

CREATE OR REPLACE FUNCTION secretaria_fechas_diagnostico()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado_del_diagnostico = 'EN_REVISION' AND OLD.estado_del_diagnostico IS DISTINCT FROM NEW.estado_del_diagnostico THEN
    NEW.fecha_inicio := COALESCE(NEW.fecha_inicio, now());
  END IF;
  IF NEW.estado_del_diagnostico IN ('DIAGNOSTICADO', 'COMPLETADO') AND OLD.estado_del_diagnostico IS DISTINCT FROM NEW.estado_del_diagnostico THEN
    NEW.fecha_completado := COALESCE(NEW.fecha_completado, now());
  END IF;
  IF NEW.estado_contacto IN ('DOCUMENTO_ENVIADO', 'ESPERANDO_RESPUESTA') AND OLD.estado_contacto IS DISTINCT FROM NEW.estado_contacto THEN
    NEW.fecha_envio_documento := COALESCE(NEW.fecha_envio_documento, now());
  END IF;
  IF NEW.estado_contacto IN ('APROBADO', 'RECHAZADO') AND OLD.estado_contacto IS DISTINCT FROM NEW.estado_contacto THEN
    NEW.fecha_respuesta_cliente := COALESCE(NEW.fecha_respuesta_cliente, now());
  END IF;
  IF NEW.estado_equipo = 'RETIRADO_SIN_REPARAR' AND OLD.estado_equipo IS DISTINCT FROM NEW.estado_equipo THEN
    NEW.fecha_retiro_sin_reparar := COALESCE(NEW.fecha_retiro_sin_reparar, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION secretaria_fechas_orden()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'EN_REPARACION' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    NEW.fecha_inicio_reparacion := COALESCE(NEW.fecha_inicio_reparacion, now());
  END IF;
  IF (NEW.estado = 'FINALIZADO' OR (NEW.estado = 'IRREPARABLE' AND NEW.irreparable_estado = 'APROBADO'))
     AND (OLD.estado IS DISTINCT FROM NEW.estado OR OLD.irreparable_estado IS DISTINCT FROM NEW.irreparable_estado) THEN
    NEW.fecha_finalizacion := COALESCE(NEW.fecha_finalizacion, now());
  END IF;
  IF NEW.estado = 'ENTREGADO' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    NEW.fecha_entrega := COALESCE(NEW.fecha_entrega, now());
    NEW.fecha_cierre := COALESCE(NEW.fecha_cierre, now());
  END IF;
  IF NEW.estado = 'CANCELADO' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    NEW.fecha_cancelacion := COALESCE(NEW.fecha_cancelacion, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION secretaria_fechas_repuesto()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.fecha_solicitud := COALESCE(NEW.fecha_solicitud, now());
  ELSIF NEW.estado_aprobacion IS DISTINCT FROM OLD.estado_aprobacion THEN
    IF NEW.estado_aprobacion = 'APROBADO' THEN NEW.fecha_aprobacion := now(); END IF;
    IF NEW.estado_aprobacion = 'DENEGADO' THEN NEW.fecha_rechazo := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION secretaria_historial_diagnostico()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_actor INT;
BEGIN
  BEGIN v_actor := NULLIF(current_setting('app.usuario_id', true), '')::INT;
  EXCEPTION WHEN others THEN v_actor := NULL; END;
  IF TG_OP = 'INSERT' OR OLD.estado_del_diagnostico IS DISTINCT FROM NEW.estado_del_diagnostico THEN
    INSERT INTO "HistorialDiagnosticos" (diagnostico_id, proceso, estado_anterior, estado_nuevo, usuario_id)
    VALUES (NEW.id_diagnostico, 'TECNICO', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.estado_del_diagnostico END, NEW.estado_del_diagnostico, v_actor);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.estado_contacto IS DISTINCT FROM NEW.estado_contacto THEN
    INSERT INTO "HistorialDiagnosticos" (diagnostico_id, proceso, estado_anterior, estado_nuevo, usuario_id, observacion)
    VALUES (NEW.id_diagnostico, 'CONTACTO', OLD.estado_contacto, NEW.estado_contacto, v_actor, NEW.observacion_respuesta);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.estado_equipo IS DISTINCT FROM NEW.estado_equipo THEN
    INSERT INTO "HistorialDiagnosticos" (diagnostico_id, proceso, estado_anterior, estado_nuevo, usuario_id, observacion)
    VALUES (NEW.id_diagnostico, 'EQUIPO', OLD.estado_equipo, NEW.estado_equipo, v_actor, NEW.observacion_retiro);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION secretaria_historial_orden()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_actor INT;
BEGIN
  BEGIN v_actor := NULLIF(current_setting('app.usuario_id', true), '')::INT;
  EXCEPTION WHEN others THEN v_actor := NULL; END;
  IF TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO "HistorialOrdenes" (orden_id, estado_anterior, estado_nuevo, usuario_id, observacion)
    VALUES (NEW.id_orden, CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.estado END, NEW.estado, v_actor,
      CASE WHEN NEW.estado = 'CANCELADO' THEN NEW.motivo_cancelacion WHEN NEW.estado = 'ENTREGADO' THEN NEW.observacion_entrega ELSE NULLIF(current_setting('app.observacion', true), '') END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_secretaria_fechas_diagnostico ON "Diagnosticos";
CREATE TRIGGER trg_secretaria_fechas_diagnostico BEFORE UPDATE ON "Diagnosticos" FOR EACH ROW EXECUTE FUNCTION secretaria_fechas_diagnostico();
DROP TRIGGER IF EXISTS trg_secretaria_fechas_orden ON "Ordenes";
CREATE TRIGGER trg_secretaria_fechas_orden BEFORE UPDATE ON "Ordenes" FOR EACH ROW EXECUTE FUNCTION secretaria_fechas_orden();
DROP TRIGGER IF EXISTS trg_secretaria_fechas_repuesto ON "Ordenes_Repuestos";
CREATE TRIGGER trg_secretaria_fechas_repuesto BEFORE INSERT OR UPDATE ON "Ordenes_Repuestos" FOR EACH ROW EXECUTE FUNCTION secretaria_fechas_repuesto();
DROP TRIGGER IF EXISTS trg_secretaria_historial_diagnostico ON "Diagnosticos";
CREATE TRIGGER trg_secretaria_historial_diagnostico AFTER INSERT OR UPDATE ON "Diagnosticos" FOR EACH ROW EXECUTE FUNCTION secretaria_historial_diagnostico();
DROP TRIGGER IF EXISTS trg_secretaria_historial_orden ON "Ordenes";
CREATE TRIGGER trg_secretaria_historial_orden AFTER INSERT OR UPDATE ON "Ordenes" FOR EACH ROW EXECUTE FUNCTION secretaria_historial_orden();
