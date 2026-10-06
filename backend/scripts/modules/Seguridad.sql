DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_diagnosticos_estado') THEN
    ALTER TABLE "Diagnosticos"
      ADD CONSTRAINT chk_diagnosticos_estado
      CHECK (estado_del_diagnostico IN ('PENDIENTE', 'INGRESADO', 'ASIGNADO', 'EN_REVISION', 'DIAGNOSTICADO', 'COMPLETADO', 'APROBADO', 'RECHAZADO'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_diagnosticos_prioridad') THEN
    ALTER TABLE "Diagnosticos"
      ADD CONSTRAINT chk_diagnosticos_prioridad
      CHECK (prioridad IS NULL OR prioridad IN ('Normal', 'Alta', 'Urgente', 'NORMAL', 'ALTA', 'URGENTE'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_diagnosticos_presupuesto') THEN
    ALTER TABLE "Diagnosticos"
      ADD CONSTRAINT chk_diagnosticos_presupuesto
      CHECK (presupuesto_estimado IS NULL OR presupuesto_estimado >= 0);
  END IF;

  ALTER TABLE "Ordenes" DROP CONSTRAINT IF EXISTS chk_ordenes_estado;
  ALTER TABLE "Ordenes"
    ADD CONSTRAINT chk_ordenes_estado
    CHECK (estado IS NULL OR estado IN ('PENDIENTE', 'ASIGNADO', 'APROBADO', 'EN_REPARACION', 'ESPERANDO_PIEZA', 'FINALIZADO', 'IRREPARABLE', 'ENTREGADO', 'CANCELADO'));

  ALTER TABLE "Ordenes" DROP CONSTRAINT IF EXISTS chk_ordenes_resultado_final;
  ALTER TABLE "Ordenes"
    ADD CONSTRAINT chk_ordenes_resultado_final
    CHECK (resultado_final IS NULL OR resultado_final IN ('REPARADO', 'IRREPARABLE'));

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ordenes_prioridad') THEN
    ALTER TABLE "Ordenes"
      ADD CONSTRAINT chk_ordenes_prioridad
      CHECK (prioridad IS NULL OR prioridad IN ('Normal', 'Alta', 'Urgente', 'NORMAL', 'ALTA', 'URGENTE'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ordenes_repuestos_estado') THEN
    ALTER TABLE "Ordenes_Repuestos"
      ADD CONSTRAINT chk_ordenes_repuestos_estado
      CHECK (estado_aprobacion IN ('PENDIENTE', 'APROBADO', 'DENEGADO'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ordenes_repuestos_entrega') THEN
    ALTER TABLE "Ordenes_Repuestos"
      ADD CONSTRAINT chk_ordenes_repuestos_entrega
      CHECK (estado_entrega IN ('PENDIENTE', 'ENTREGADO'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ordenes_repuestos_cantidad') THEN
    ALTER TABLE "Ordenes_Repuestos"
      ADD CONSTRAINT chk_ordenes_repuestos_cantidad
      CHECK (cantidad_usada IS NULL OR cantidad_usada > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_facturas_montos') THEN
    ALTER TABLE "Facturas"
      ADD CONSTRAINT chk_facturas_montos
      CHECK (
        (monto_repuestos IS NULL OR monto_repuestos >= 0)
        AND (mano_obra IS NULL OR mano_obra >= 0)
        AND (subtotal IS NULL OR subtotal >= 0)
        AND (impuestos IS NULL OR impuestos >= 0)
        AND (total IS NULL OR total >= 0)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_compras_montos') THEN
    ALTER TABLE "Compras"
      ADD CONSTRAINT chk_compras_montos
      CHECK (
        (cantidad IS NULL OR cantidad > 0)
        AND (costo_unitario IS NULL OR costo_unitario > 0)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_compras_metodo_pago') THEN
    ALTER TABLE "Compras"
      ADD CONSTRAINT chk_compras_metodo_pago
      CHECK (metodo_pago IS NULL OR metodo_pago IN ('Efectivo', 'Transferencia', 'Tarjeta'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_facturas_metodo_pago') THEN
    ALTER TABLE "Facturas"
      ADD CONSTRAINT chk_facturas_metodo_pago
      CHECK (metodo_pago IS NULL OR metodo_pago IN ('Efectivo', 'Transferencia', 'Tarjeta'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_garantias_duracion') THEN
    ALTER TABLE "Garantias"
      ADD CONSTRAINT chk_garantias_duracion
      CHECK (duracion_meses IS NULL OR duracion_meses BETWEEN 1 AND 36);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_facturas_orden') THEN
    ALTER TABLE "Facturas"
      ADD CONSTRAINT uq_facturas_orden UNIQUE (orden_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_garantias_factura') THEN
    ALTER TABLE "Garantias"
      ADD CONSTRAINT uq_garantias_factura UNIQUE (factura_id);
  END IF;
END $$;
