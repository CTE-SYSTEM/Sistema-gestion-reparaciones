import { datosCorreccionCierre } from '../../utils/correccionCierre.js';

// Contrato público del técnico: nunca serializar entidades Prisma completas.
export const textoTecnico = (value, cliente) => {
  if (value === null || value === undefined) return value;
  let text = String(value);
  const privateValues = [cliente?.nombre, cliente?.telefono, cliente?.correo, cliente?.direccion, cliente?.contacto_secundario,
    ...[cliente?.nombre, cliente?.contacto_secundario].flatMap((name) => String(name || '').split(/\s+/).filter((word) => word.length >= 2))];
  const patterns = [...new Set(privateValues.map((v) => String(v || '').trim()).filter((v) => v.length >= 2))]
    .sort((a, b) => b.length - a.length).map((privateValue) => {
    const escaped = privateValue.normalize('NFD').replace(/\p{M}/gu, '')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[aeioun]/gi, (letter) => ({ a: '[aáàäâ]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöô]', u: '[uúùüû]', n: '[nñ]' })[letter.toLowerCase()]);
    return privateValue.length <= 2 ? `(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])` : escaped;
  });
  // Una sola sustitución evita volver a filtrar el marcador si un nombre coincide con sus palabras.
  if (patterns.length) text = text.replace(new RegExp(patterns.join('|'), 'giu'), '[dato reservado]');
  return text.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, '[contacto reservado]')
    .replace(/(?:https?:\/\/|www\.)\S+/giu, '[enlace reservado]')
    .replace(/(?<![\p{L}\d])(?:\+?\d[\s().-]*){8,15}(?![\p{L}\d])/gu, '[contacto reservado]');
};

const pick = (record, fields) => Object.fromEntries(fields.map((field) => [field, record?.[field] ?? null]));
const avanceFields = (r) => {
  const dates = [r.fecha_borrador, r.avances_tecnicos?.[0]?.fecha_hora, r.historial_estados?.[0]?.fecha_hora,
    r.fecha_asignacion, r.fecha_inicio_reparacion || r.fecha_inicio, r.fecha_ingreso || r.fecha_hora].filter(Boolean);
  const latest = dates.sort((a, b) => new Date(b) - new Date(a))[0] || null;
  return { ultimo_avance: latest, horas_sin_avance: latest ? Math.max(0, (Date.now() - new Date(latest)) / 3600000) : 0 };
};
const diagnosisFields = ['id_diagnostico', 'equipo_id', 'prioridad', 'estado_del_diagnostico',
  'presupuesto_estimado', 'fecha_hora', 'fecha_asignacion', 'fecha_inicio', 'fecha_completado',
  'fecha_borrador', 'estado_cargador', 'estado_accesorios', 'estado_fisico', 'estado_encendido',
  'estado_alimentacion', 'estado_acceso', 'deja_cargador', 'enciende', 'usa_corriente_ac'];
export const diagnosticoTecnico = (record) => {
  if (!record) return null;
  const cliente = record.equipo?.cliente;
  const safe = pick(record, diagnosisFields);
  safe.moneda_presupuesto = record.moneda_presupuesto === 'USD' ? 'USD' : 'NIO';
  for (const key of diagnosisFields) if (typeof safe[key] === 'string') safe[key] = textoTecnico(safe[key], cliente);
  Object.assign(safe, avanceFields(record));
  for (const key of ['falla_reportada', 'diagnostico_real', 'solucion_propuesta', 'detalle_accesorios']) {
    safe[key] = textoTecnico(record[key] ?? '', cliente);
  }
  const full = String(record.diagnostico_real || ''), suffix = '\n\nSolución: ' + String(record.solucion_propuesta || '');
  if (record.solucion_propuesta && full.endsWith(suffix)) safe.diagnostico_real = textoTecnico(full.slice(0, -suffix.length), cliente);
  // Las notas administrativas de recepción/contacto no forman parte de este contrato.
  safe.equipo = pick(record.equipo, ['id_equipo', 'tipo', 'marca', 'modelo']);
  for (const key of ['tipo', 'marca', 'modelo']) safe.equipo[key] = textoTecnico(safe.equipo[key], cliente);
  safe.borrador_tecnico = record.borrador_tecnico ? {
    diagnostico: textoTecnico(record.borrador_tecnico.diagnostico || '', cliente),
    solucion: textoTecnico(record.borrador_tecnico.solucion || '', cliente),
    presupuesto: typeof record.borrador_tecnico.presupuesto === 'number' && Number.isFinite(record.borrador_tecnico.presupuesto) && record.borrador_tecnico.presupuesto >= 0
      ? Number(record.borrador_tecnico.presupuesto) : '',
    moneda_presupuesto: ['NIO', 'USD'].includes(record.borrador_tecnico.moneda_presupuesto) ? record.borrador_tecnico.moneda_presupuesto : safe.moneda_presupuesto,
  } : null;
  return safe;
};
export const solicitudTecnica = (record, cliente) => ({
  ...pick(record, ['id_detalle_repuesto', 'orden_id', 'repuesto_id', 'cantidad_usada', 'estado_aprobacion',
    'estado_entrega', 'fecha_solicitud', 'fecha_aprobacion', 'fecha_rechazo', 'fecha_entrega']),
  pieza_solicitada: textoTecnico(record.pieza_solicitada || '', cliente),
  motivo_rechazo: textoTecnico(record.motivo_rechazo || '', cliente),
  repuesto: record.repuesto ? {
    id_repuesto: record.repuesto.id_repuesto,
    nombre: textoTecnico(record.repuesto.nombre, cliente),
    descripcion: textoTecnico(record.repuesto.descripcion, cliente),
  } : null,
  usuario_aprobador: record.usuario_aprobador ? { nombre_usuario: record.usuario_aprobador.nombre_usuario } : null,
  usuario_entregador: record.usuario_entregador ? { nombre_usuario: record.usuario_entregador.nombre_usuario } : null,
});
export const ordenTecnica = (record, reglas = {}) => {
  if (!record) return null;
  const cliente = record.diagnostico?.equipo?.cliente;
  const safe = pick(record, ['id_orden', 'diagnostico_id', 'prioridad', 'estado', 'fecha_ingreso',
    'fecha_asignacion', 'fecha_inicio_reparacion', 'fecha_cierre', 'fecha_finalizacion', 'fecha_entrega',
    'fecha_cancelacion', 'resultado_final', 'enciende_salida', 'usa_corriente_ac_salida',
    'requiere_piezas', 'irreparable_estado', 'fecha_revision_irreparable']);
  for (const key of Object.keys(safe)) if (typeof safe[key] === 'string') safe[key] = textoTecnico(safe[key], cliente);
  for (const key of ['observacion_final', 'justificacion_irreparable', 'motivo_revision_irreparable']) {
    safe[key] = textoTecnico(record[key] || '', cliente);
  }
  safe.pruebas_salida = record.pruebas_salida ? Object.fromEntries(['encendido', 'alimentacion', 'funcion_principal', 'carga', 'pantalla', 'conectividad']
    .filter((key) => ['CORRECTO', 'FALLA', 'NO_APLICA'].includes(record.pruebas_salida[key])).map((key) => [key, record.pruebas_salida[key]])) : null;
  safe.diagnostico = diagnosticoTecnico(record.diagnostico);
  Object.assign(safe, avanceFields(record));
  safe.repuestos_usados = (record.repuestos_usados || []).map((p) => solicitudTecnica(p, cliente));
  safe.autorizacion_reparacion = Boolean(record.fecha_aprobacion_cliente || record.monto_autorizado != null);
  safe.correccion_cierre = datosCorreccionCierre(record, reglas);
  return safe;
};
export const historialTecnico = (records, cliente) => records.map((r) => ({
  ...pick(r, ['id_historial', 'proceso', 'estado_anterior', 'estado_nuevo', 'fecha_hora']),
  usuario: r.usuario ? { nombre_usuario: r.usuario.nombre_usuario } : null,
  // Motivos libres de terceros pueden contener datos administrativos del cliente.
}));
export const avanceTecnico = (r, cliente) => ({
  id_avance: r.id_avance, fecha_hora: r.fecha_hora,
  observacion: textoTecnico(r.observacion, cliente),
  usuario: r.usuario ? { nombre_usuario: r.usuario.nombre_usuario } : null,
});
