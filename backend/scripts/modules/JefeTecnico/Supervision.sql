-- Coordinación del taller: las acciones se validan en Prisma; SQL conserva integridad e historial.
ALTER TABLE "Diagnosticos" DROP CONSTRAINT IF EXISTS chk_diagnosticos_estado;
ALTER TABLE "Diagnosticos" ADD CONSTRAINT chk_diagnosticos_estado CHECK
 (estado_del_diagnostico IN ('PENDIENTE','INGRESADO','ASIGNADO','EN_REVISION','DIAGNOSTICADO','COMPLETADO','APROBADO','RECHAZADO'));
ALTER TABLE "Ordenes" DROP CONSTRAINT IF EXISTS chk_ordenes_estado;
ALTER TABLE "Ordenes" ADD CONSTRAINT chk_ordenes_estado CHECK
 (estado IS NULL OR estado IN ('PENDIENTE','ASIGNADO','APROBADO','EN_REPARACION','ESPERANDO_PIEZA','FINALIZADO','IRREPARABLE','ENTREGADO','CANCELADO'));
UPDATE "Ordenes" SET irreparable_estado = 'NO_SOLICITADO'
 WHERE irreparable_estado = 'PENDIENTE' AND estado IS DISTINCT FROM 'IRREPARABLE' AND NULLIF(BTRIM(justificacion_irreparable),'') IS NULL;
ALTER TABLE "Tecnicos" DROP CONSTRAINT IF EXISTS chk_tecnico_disponibilidad;
ALTER TABLE "Tecnicos" ADD CONSTRAINT chk_tecnico_disponibilidad CHECK (disponibilidad IN ('DISPONIBLE','AUSENTE','NO_DISPONIBLE'));
ALTER TABLE "Ordenes" DROP CONSTRAINT IF EXISTS chk_revision_irreparable;
ALTER TABLE "Ordenes" ADD CONSTRAINT chk_revision_irreparable CHECK (irreparable_estado IN ('NO_SOLICITADO','PENDIENTE','APROBADO','RECHAZADO'));
ALTER TABLE "HistorialAsignaciones" DROP CONSTRAINT IF EXISTS chk_asignacion_origen;
ALTER TABLE "HistorialAsignaciones" ADD CONSTRAINT chk_asignacion_origen CHECK ((diagnostico_id IS NULL) <> (orden_id IS NULL));
ALTER TABLE "IntervencionesTecnicas" DROP CONSTRAINT IF EXISTS chk_intervencion_origen;
ALTER TABLE "IntervencionesTecnicas" ADD CONSTRAINT chk_intervencion_origen CHECK ((diagnostico_id IS NULL) <> (orden_id IS NULL));
-- Correcciones.sql, cargado a continuación, valida los tipos y motivos de intervención.

CREATE OR REPLACE FUNCTION jefe_historial_asignacion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_old INT; v_actor INT; v_note TEXT; v_exception BOOLEAN;
BEGIN
 IF TG_OP = 'INSERT' THEN v_old := NULL; ELSE v_old := OLD.tecnico_id; END IF;
 IF v_old IS NOT DISTINCT FROM NEW.tecnico_id THEN RETURN NEW; END IF;
 v_actor := NULLIF(current_setting('app.usuario_id',true),'')::INT;
 v_note := COALESCE(NULLIF(current_setting('app.observacion',true),''),'Cambio de asignación');
 v_exception := COALESCE(NULLIF(current_setting('app.excepcion_tecnica',true),'')::BOOLEAN,false);
 INSERT INTO "HistorialAsignaciones" (diagnostico_id,orden_id,tecnico_anterior_id,tecnico_nuevo_id,tecnico_anterior_nombre,tecnico_nuevo_nombre,usuario_id,motivo,es_excepcion)
 VALUES (CASE WHEN TG_TABLE_NAME = 'Diagnosticos' THEN (to_jsonb(NEW)->>'id_diagnostico')::INT ELSE NULL END,
 CASE WHEN TG_TABLE_NAME = 'Ordenes' THEN (to_jsonb(NEW)->>'id_orden')::INT ELSE NULL END,v_old,NEW.tecnico_id,
 (SELECT nombre FROM "Tecnicos" WHERE id_tecnico = v_old),(SELECT nombre FROM "Tecnicos" WHERE id_tecnico = NEW.tecnico_id),v_actor,v_note,v_exception);
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_jefe_asignacion_diagnostico ON "Diagnosticos";
CREATE TRIGGER trg_jefe_asignacion_diagnostico AFTER INSERT OR UPDATE ON "Diagnosticos" FOR EACH ROW EXECUTE FUNCTION jefe_historial_asignacion();
DROP TRIGGER IF EXISTS trg_jefe_asignacion_orden ON "Ordenes";
CREATE TRIGGER trg_jefe_asignacion_orden AFTER INSERT OR UPDATE ON "Ordenes" FOR EACH ROW EXECUTE FUNCTION jefe_historial_asignacion();
-- Las asignaciones existentes se identifican como registros heredados, sin inventar el usuario histórico.
INSERT INTO "HistorialAsignaciones" (diagnostico_id,tecnico_nuevo_id,tecnico_nuevo_nombre,motivo,fecha_hora)
 SELECT d.id_diagnostico,d.tecnico_id,t.nombre,'Asignación existente al habilitar el historial; usuario histórico no disponible',COALESCE(d.fecha_asignacion,d.fecha_hora,now())
 FROM "Diagnosticos" d JOIN "Tecnicos" t ON t.id_tecnico=d.tecnico_id
 WHERE NOT EXISTS (SELECT 1 FROM "HistorialAsignaciones" h WHERE h.diagnostico_id=d.id_diagnostico);
INSERT INTO "HistorialAsignaciones" (orden_id,tecnico_nuevo_id,tecnico_nuevo_nombre,motivo,fecha_hora)
 SELECT o.id_orden,o.tecnico_id,t.nombre,'Asignación existente al habilitar el historial; usuario histórico no disponible',COALESCE(o.fecha_asignacion,o.fecha_ingreso,now())
 FROM "Ordenes" o JOIN "Tecnicos" t ON t.id_tecnico=o.tecnico_id
 WHERE NOT EXISTS (SELECT 1 FROM "HistorialAsignaciones" h WHERE h.orden_id=o.id_orden);
