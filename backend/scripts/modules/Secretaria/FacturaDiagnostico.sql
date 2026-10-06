-- Vincula facturas históricas al diagnóstico de su orden para evitar cargos duplicados.
UPDATE "Facturas" f SET diagnostico_id = o.diagnostico_id
FROM "Ordenes" o WHERE f.orden_id = o.id_orden AND f.diagnostico_id IS NULL;

ALTER TABLE "Facturas" DROP CONSTRAINT IF EXISTS chk_factura_servicio;
ALTER TABLE "Facturas" ADD CONSTRAINT chk_factura_servicio CHECK (diagnostico_id IS NOT NULL);

ALTER TABLE "Facturas" DROP CONSTRAINT IF EXISTS chk_factura_diagnostico_positivo;
ALTER TABLE "Facturas" ADD CONSTRAINT chk_factura_diagnostico_positivo CHECK
  (COALESCE(monto_diagnostico, 0) >= 0);
