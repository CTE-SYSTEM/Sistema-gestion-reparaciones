-- Prueba transaccional: no conserva clientes, equipos ni órdenes de prueba.
BEGIN;
DO $$
DECLARE
  v_cliente INT;
  v_equipo INT;
  v_diagnostico INT;
  v_orden INT;
  v_actor INT;
  v_count INT;
  v_pieza INT;
BEGIN
  SELECT MIN(id_usuario) INTO v_actor FROM "Usuarios";
  IF v_actor IS NOT NULL THEN
    PERFORM set_config('app.usuario_id', v_actor::TEXT, true);
  END IF;

  INSERT INTO "Clientes" (nombre) VALUES ('Prueba temporal historial') RETURNING id_cliente INTO v_cliente;
  INSERT INTO "Equipos" (cliente_id, tipo) VALUES (v_cliente, 'Prueba') RETURNING id_equipo INTO v_equipo;
  INSERT INTO "Diagnosticos" (equipo_id, falla_reportada) VALUES (v_equipo, 'Prueba') RETURNING id_diagnostico INTO v_diagnostico;
  SELECT COUNT(*) INTO v_count FROM "HistorialDiagnosticos" WHERE diagnostico_id = v_diagnostico AND proceso = 'TECNICO' AND estado_nuevo = 'PENDIENTE';
  IF v_count <> 1 THEN RAISE EXCEPTION 'No se guardó el estado inicial del diagnóstico'; END IF;

  UPDATE "Diagnosticos" SET estado_del_diagnostico = 'EN_REVISION' WHERE id_diagnostico = v_diagnostico;
  IF NOT EXISTS (SELECT 1 FROM "Diagnosticos" WHERE id_diagnostico = v_diagnostico AND fecha_inicio IS NOT NULL) THEN
    RAISE EXCEPTION 'No se guardó el inicio del diagnóstico';
  END IF;
  UPDATE "Diagnosticos" SET estado_del_diagnostico = 'COMPLETADO', diagnostico_real = 'Revisado', presupuesto_estimado = 100 WHERE id_diagnostico = v_diagnostico;
  UPDATE "Diagnosticos" SET estado_contacto = 'DOCUMENTO_ENVIADO' WHERE id_diagnostico = v_diagnostico;
  IF NOT EXISTS (SELECT 1 FROM "Diagnosticos" WHERE id_diagnostico = v_diagnostico AND fecha_completado IS NOT NULL AND fecha_envio_documento IS NOT NULL) THEN
    RAISE EXCEPTION 'Faltan fechas del diagnóstico o envío';
  END IF;
  SELECT COUNT(*) INTO v_count FROM "HistorialDiagnosticos" WHERE diagnostico_id = v_diagnostico;
  IF v_count <> 4 THEN RAISE EXCEPTION 'Historial de diagnóstico incompleto: %', v_count; END IF;
  INSERT INTO "ArchivosServicio" (diagnostico_id, tipo_archivo, ruta_archivo, nombre_original, tipo_mime)
  VALUES (v_diagnostico, 'FOTO_DIAGNOSTICO', 'prueba-temporal.jpg', 'prueba.jpg', 'image/jpeg');

  INSERT INTO "Ordenes" (diagnostico_id, estado, monto_autorizado) VALUES (v_diagnostico, 'PENDIENTE', 100) RETURNING id_orden INTO v_orden;
  INSERT INTO "Ordenes_Repuestos" (orden_id, pieza_solicitada, cantidad_usada)
  VALUES (v_orden, 'Pieza de prueba', 1) RETURNING id_detalle_repuesto INTO v_pieza;
  UPDATE "Ordenes_Repuestos" SET estado_aprobacion = 'DENEGADO', motivo_rechazo = 'No compatible' WHERE id_detalle_repuesto = v_pieza;
  IF NOT EXISTS (SELECT 1 FROM "Ordenes_Repuestos" WHERE id_detalle_repuesto = v_pieza AND fecha_solicitud IS NOT NULL AND fecha_rechazo IS NOT NULL) THEN
    RAISE EXCEPTION 'Faltan fechas de la solicitud de repuesto';
  END IF;
  UPDATE "Ordenes" SET estado = 'EN_REPARACION' WHERE id_orden = v_orden;
  UPDATE "Ordenes" SET estado = 'FINALIZADO' WHERE id_orden = v_orden;
  SELECT COUNT(*) INTO v_count FROM secretaria_ordenes_facturables WHERE id_orden = v_orden;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Un repuesto denegado bloqueó incorrectamente la facturación'; END IF;
  UPDATE "Ordenes" SET estado = 'ENTREGADO' WHERE id_orden = v_orden;
  IF NOT EXISTS (SELECT 1 FROM "Ordenes" WHERE id_orden = v_orden AND fecha_inicio_reparacion IS NOT NULL AND fecha_finalizacion IS NOT NULL AND fecha_entrega IS NOT NULL) THEN
    RAISE EXCEPTION 'Faltan fechas de la orden';
  END IF;
  SELECT COUNT(*) INTO v_count FROM "HistorialOrdenes" WHERE orden_id = v_orden;
  IF v_count <> 4 THEN RAISE EXCEPTION 'Historial de orden incompleto: %', v_count; END IF;
  IF v_actor IS NOT NULL AND EXISTS (SELECT 1 FROM "HistorialOrdenes" WHERE orden_id = v_orden AND usuario_id IS DISTINCT FROM v_actor) THEN
    RAISE EXCEPTION 'No se registró correctamente el actor';
  END IF;
END;
$$;
ROLLBACK;
