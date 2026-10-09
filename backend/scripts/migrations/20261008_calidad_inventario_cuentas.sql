BEGIN;

ALTER TABLE "Diagnosticos" ADD COLUMN IF NOT EXISTS "calidad_estado" TEXT NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "nombre_persona" TEXT;

-- Los diagnósticos que ya generaron órdenes o facturas conservan su recorrido histórico.
UPDATE "Diagnosticos" AS d SET "calidad_estado" = 'APROBADO'
WHERE d."estado_del_diagnostico" IN ('COMPLETADO', 'DIAGNOSTICADO')
  AND d."calidad_estado" = 'PENDIENTE'
  AND (EXISTS (SELECT 1 FROM "Ordenes" AS o WHERE o."diagnostico_id" = d."id_diagnostico")
    OR EXISTS (SELECT 1 FROM "Facturas" AS f WHERE f."diagnostico_id" = d."id_diagnostico"));

CREATE TABLE IF NOT EXISTS "DevolucionesProveedor" (
  "id_devolucion" SERIAL PRIMARY KEY,
  "repuesto_id" INTEGER NOT NULL REFERENCES "Repuestos"("id_repuesto"),
  "compra_id" INTEGER NOT NULL REFERENCES "Compras"("id_compra"),
  "reclamo_id" INTEGER REFERENCES "Reclamos"("id_reclamo") ON DELETE SET NULL,
  "usuario_id" INTEGER NOT NULL REFERENCES "Usuarios"("id_usuario"),
  "cantidad" INTEGER NOT NULL CHECK ("cantidad" > 0),
  "origen" TEXT NOT NULL CHECK ("origen" IN ('BODEGA', 'RECLAMO')),
  "estado" TEXT NOT NULL DEFAULT 'CUARENTENA' CHECK ("estado" IN ('CUARENTENA', 'DEVUELTO')),
  "motivo" TEXT NOT NULL,
  "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_devolucion" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "DevolucionesProveedor_repuesto_id_estado_idx" ON "DevolucionesProveedor"("repuesto_id", "estado");
CREATE INDEX IF NOT EXISTS "DevolucionesProveedor_compra_id_idx" ON "DevolucionesProveedor"("compra_id");

COMMIT;
