-- Un avance pertenece exactamente a un trabajo; las fotos solo se publican tras revisión.
ALTER TABLE "BitacoraTecnica" DROP CONSTRAINT IF EXISTS chk_bitacora_origen;
ALTER TABLE "BitacoraTecnica" ADD CONSTRAINT chk_bitacora_origen CHECK ((diagnostico_id IS NULL) <> (orden_id IS NULL));
DROP TRIGGER IF EXISTS trg_auditoria_bitacora_tecnica ON "BitacoraTecnica";
CREATE TRIGGER trg_auditoria_bitacora_tecnica AFTER INSERT OR UPDATE OR DELETE ON "BitacoraTecnica"
FOR EACH ROW EXECUTE FUNCTION auditoria_registrar_movimiento();
DROP TRIGGER IF EXISTS trg_auditoria_archivos_servicio ON "ArchivosServicio";
CREATE TRIGGER trg_auditoria_archivos_servicio AFTER INSERT OR UPDATE OR DELETE ON "ArchivosServicio"
FOR EACH ROW EXECUTE FUNCTION auditoria_registrar_movimiento();
