-- Ampliación del historial existente sin alterar trabajos, solicitudes o cantidades.
ALTER TABLE "IntervencionesTecnicas" DROP CONSTRAINT IF EXISTS chk_intervencion_tipo_motivo;
ALTER TABLE "IntervencionesTecnicas" ADD CONSTRAINT chk_intervencion_tipo_motivo CHECK (
  tipo IN ('REASIGNACION','FINALIZACION','CORRECCION_REPUESTO','RETIRAR_APROBACION',
    'REABRIR_SOLICITUD','CORREGIR_ENTREGA','DEVOLUCION_REPUESTO',
    'CORRECCION_CIERRE','ACLARACION_CIERRE','CORRECCION_FOTO_CIERRE','REAPERTURA_CIERRE')
  AND NULLIF(BTRIM(motivo),'') IS NOT NULL
  AND (tipo = 'REASIGNACION' OR orden_id IS NOT NULL)
);
