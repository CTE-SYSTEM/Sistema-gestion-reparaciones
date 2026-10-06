export const mapEquipo = (equipo) => [equipo?.tipo || 'Equipo', equipo?.marca, equipo?.modelo].filter(Boolean).join(' ');
export const ordenCerrada = (orden) => ['FINALIZADO', 'ENTREGADO', 'CANCELADO'].includes(orden.estado)
  || (orden.estado === 'IRREPARABLE' && orden.irreparable_estado === 'APROBADO');
export const mapDiagnostico = (d) => ({
  id: d.id_diagnostico, equipo: mapEquipo(d.equipo), equipoTipo: d.equipo?.tipo || '',
  falla: d.falla_reportada || 'Sin falla reportada', prioridad: d.prioridad || 'NORMAL',
  estado: d.estado_del_diagnostico, diagnostico: d.diagnostico_real || '', solucion: d.solucion_propuesta || '',
  presupuesto: d.presupuesto_estimado ?? '', moneda_presupuesto: d.moneda_presupuesto || 'NIO', borrador: d.borrador_tecnico,
  fecha_hora: d.fecha_hora, fecha_asignacion: d.fecha_asignacion, fecha_inicio: d.fecha_inicio,
  fecha_completado: d.fecha_completado, fecha_borrador: d.fecha_borrador,
  ultimo_avance: d.ultimo_avance, horas_sin_avance: d.horas_sin_avance,
  recepcion: Object.fromEntries(['estado_cargador', 'estado_accesorios', 'estado_fisico', 'estado_encendido',
    'estado_alimentacion', 'estado_acceso', 'detalle_accesorios'].map((k) => [k, d[k]])),
});
export const mapOrden = (o) => ({
  id: o.id_orden, diagnostico_id: o.diagnostico_id, equipo: mapEquipo(o.diagnostico?.equipo),
  equipoTipo: o.diagnostico?.equipo?.tipo || '', falla: o.diagnostico?.falla_reportada || 'Sin falla reportada',
  prioridad: o.prioridad || o.diagnostico?.prioridad || 'NORMAL', estado: o.estado,
  diagnostico: o.diagnostico?.diagnostico_real || '', solucion: o.diagnostico?.solucion_propuesta || '',
  repuestos_usados: o.repuestos_usados || [], resultado_final: o.resultado_final,
  enciende_salida: o.enciende_salida, usa_corriente_ac_salida: o.usa_corriente_ac_salida,
  pruebas_salida: o.pruebas_salida, observacion_final: o.observacion_final,
  correccion_cierre: o.correccion_cierre,
  justificacion_irreparable: o.justificacion_irreparable, motivo_revision_irreparable: o.motivo_revision_irreparable,
  irreparable_estado: o.irreparable_estado || 'NO_SOLICITADO', fecha_revision_irreparable: o.fecha_revision_irreparable,
  requiere_piezas: o.requiere_piezas !== false, autorizacion_reparacion: o.autorizacion_reparacion,
  fecha_asignacion: o.fecha_asignacion, fecha_ingreso: o.fecha_ingreso,
  fecha_inicio_reparacion: o.fecha_inicio_reparacion, fecha_finalizacion: o.fecha_finalizacion,
  ultimo_avance: o.ultimo_avance, horas_sin_avance: o.horas_sin_avance,
  recepcion: mapDiagnostico(o.diagnostico || {}).recepcion,
});
export const mapSolicitud = (p) => ({
  id: p.id_detalle_repuesto, ordenId: p.orden_id, repuesto: p.repuesto?.nombre || p.pieza_solicitada,
  cantidad: p.cantidad_usada, estado: p.estado_aprobacion, estadoEntrega: p.estado_entrega,
  pendienteInventario: !p.repuesto_id, motivo: p.motivo_rechazo,
  fecha_solicitud: p.fecha_solicitud, fecha_aprobacion: p.fecha_aprobacion, fecha_entrega: p.fecha_entrega,
  aprobador: p.usuario_aprobador?.nombre_usuario, entregador: p.usuario_entregador?.nombre_usuario,
});
