import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, ChevronLeft, ChevronRight, ClipboardList, Eye, PackageCheck, SlidersHorizontal, X } from 'lucide-react';
import FotosServicio from '../../shared/components/FotosServicio';
import { formatoPresupuesto } from '../../../utils/monedaPresupuesto';

export const label = (v) => ({ EN_REVISION: 'En diagnóstico', EN_REPARACION: 'En reparación', ESPERANDO_PIEZA: 'Esperando pieza', NO_SOLICITADO: 'Sin solicitud', NO_DISPONIBLE: 'No disponible', DIAGNOSTICADO: 'Completado', DENEGADO: 'Rechazado' }[v] || String(v || 'Pendiente').toLowerCase().replaceAll('_', ' ').replace(/^./, (s) => s.toUpperCase()));
export const date = (v) => v ? new Date(v).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Managua' }) : 'Sin registrar';
export const interventionTitle = (tipo) => ({ REASIGNACION: 'Corrección de asignación', FINALIZACION: 'Finalización excepcional',
  CORRECCION_REPUESTO: 'Corrección de pieza o cantidad', RETIRAR_APROBACION: 'Aprobación retirada',
  REABRIR_SOLICITUD: 'Solicitud devuelta a revisión', CORREGIR_ENTREGA: 'Entrega registrada por error',
  DEVOLUCION_REPUESTO: 'Devolución física al almacén', CORRECCION_CIERRE: 'Informe de cierre corregido',
  ACLARACION_CIERRE: 'Aclaración del cierre', CORRECCION_FOTO_CIERRE: 'Foto añadida tras el cierre',
  REAPERTURA_CIERRE: 'Reapertura de reparación', CORRECCION_DIAGNOSTICO: 'Informe de diagnóstico corregido',
  ACLARACION_DIAGNOSTICO: 'Aclaración del diagnóstico', REAPERTURA_DIAGNOSTICO: 'Diagnóstico reabierto',
  CORRECCION_AVANCE: 'Nota de avance corregida', CORRECCION_SOLICITUD_TECNICO: 'Solicitud de pieza corregida',
  RETIRO_SOLICITUD_TECNICO: 'Solicitud de pieza retirada', CORRECCION_IRREPARABLE: 'Informe irreparable corregido',
  RETIRO_IRREPARABLE: 'Informe irreparable retirado', REVISION_FOTO_TECNICA: 'Visibilidad de fotografía revisada' }[tipo] || label(tipo));
const correctionActions = [
  ['retirar-aprobacion', 'puede_retirar_aprobacion', 'Retirar aprobación'],
  ['reabrir', 'puede_reabrir', 'Devolver a revisión'],
  ['corregir-entrega', 'puede_corregir_entrega', 'Corregir entrega'],
  ['devolver', 'puede_devolver', 'Registrar devolución'],
];
const changeLabels = { diagnostico_real: 'Informe del diagnóstico', solucion_propuesta: 'Solución propuesta', presupuesto_estimado: 'Presupuesto',
  moneda_presupuesto: 'Moneda', observacion_final: 'Informe de reparación', pruebas_salida: 'Pruebas de salida',
  enciende_salida: 'Encendido al salir', usa_corriente_ac_salida: 'Alimentación al salir', estado: 'Estado',
  resultado_final: 'Resultado', justificacion_irreparable: 'Justificación de irreparabilidad', observacion: 'Nota de avance',
  pieza_solicitada: 'Pieza solicitada', cantidad_usada: 'Cantidad', estado_aprobacion: 'Aprobación de pieza',
  estado_entrega: 'Entrega de pieza', repuesto_id: 'Repuesto', tecnico_id: 'Técnico asignado', prioridad: 'Prioridad',
  fecha_finalizacion: 'Finalización', fecha_completado: 'Informe completado', fecha_asignacion: 'Asignación',
  fecha_entrega: 'Entrega', fecha_aprobacion: 'Aprobación', fecha_rechazo: 'Rechazo', visible_tecnico: 'Visible para el técnico',
  irreparable_estado: 'Revisión de irreparabilidad', fecha_cierre: 'Cierre', retirada: 'Solicitud retirada' };
const changeValue = (key, value) => {
  if (value == null || value === '') return 'Sin registro';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (key.startsWith('fecha_')) return date(value);
  if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([name, result]) => `${label(name)}: ${label(result)}`).join(' · ');
  return String(value);
};
function CorrectionDetails({ movement }) {
  const before = movement.datos_anteriores || {}, after = movement.datos_nuevos || {};
  const changes = Object.keys(after).filter((key) => key in changeLabels && JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  return <div className="jefe-change">
    {after.aclaracion && <p className="whitespace-pre-wrap"><strong>Aclaración técnica:</strong> {after.aclaracion}</p>}
    {changes.map((key) => <p key={key} className="whitespace-pre-wrap"><strong>{changeLabels[key]}:</strong> {key in before ? `${changeValue(key, before[key])} → ` : ''}{changeValue(key, after[key])}</p>)}
    {movement.tipo === 'CORRECCION_FOTO_CIERRE' && after.id_archivo && <p>Fotografía #{after.id_archivo} añadida al expediente.</p>}
    {movement.tipo === 'REVISION_FOTO_TECNICA' && after.id_archivo && <p>Fotografía #{after.id_archivo} · {label(after.tipo_archivo)} · {after.visible_tecnico ? 'Autorizada para el técnico' : 'Retirada del expediente técnico'}</p>}
  </div>;
}
export const hours = (v) => Number(v || 0) >= 24 ? `${Math.floor(v / 24)} d ${Math.floor(v % 24)} h` : `${Math.floor(v || 0)} h`;
const initials = (name) => String(name || 'T').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('');
const equipoSolicitud = (row) => {
  const equipo = row.orden?.diagnostico?.equipo;
  return [equipo?.tipo, equipo?.marca, equipo?.modelo].filter(Boolean).join(' ') || 'Equipo sin datos';
};
export function Badge({ value }) {
  const s = String(value || '').toUpperCase();
  const tone = ['URGENTE', 'IRREPARABLE', 'DENEGADO', 'RECHAZADO', 'AUSENTE'].includes(s) ? 'red' : ['ESPERANDO_PIEZA', 'ALTA', 'PENDIENTE', 'NO_DISPONIBLE'].includes(s) ? 'amber' : ['FINALIZADO', 'ENTREGADO', 'COMPLETADO', 'APROBADO', 'DISPONIBLE'].includes(s) ? 'green' : 'indigo';
  return <span className={`jefe-badge ${tone}`}>{label(s)}</span>;
}
export function PagedTable({ rows, columns, empty = 'No hay registros para estos filtros.' }) {
  const [page, setPage] = useState(1);
  const rowKeys = rows.map((r) => r.key || r.id || r.id_detalle_repuesto || r.id_intervencion).join('|');
  useEffect(() => setPage(1), [rowKeys]);
  const pages = Math.max(1, Math.ceil(rows.length / 20)), current = Math.min(page, pages);
  return <><div className="jefe-table-wrap"><table className="jefe-table"><thead><tr>{columns.map((c) => <th key={c.name} scope="col">{c.name}</th>)}</tr></thead><tbody>{rows.slice((current - 1) * 20, current * 20).map((r) => <tr key={r.key || r.id || r.id_detalle_repuesto || r.id_intervencion}>{columns.map((c) => <td key={c.name} className={c.className}>{c.render(r)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={columns.length} className="jefe-empty"><ClipboardList size={25} /><p>{empty}</p></td></tr>}</tbody></table></div>{rows.length > 20 && <div className="jefe-pagination"><span>{(current - 1) * 20 + 1}–{Math.min(current * 20, rows.length)} de {rows.length}</span><div className="jefe-pagination-actions"><button className="jefe-icon-btn" aria-label="Página anterior" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft size={15} /></button><span>{current} / {pages}</span><button className="jefe-icon-btn" aria-label="Página siguiente" disabled={current >= pages} onClick={() => setPage(current + 1)}><ChevronRight size={15} /></button></div></div>}</>;
}
export function WorkTable({ rows, onAction, compact = false, assignment = false, irreparable = false, closed = false, correctionCount = () => 0 }) {
  return <PagedTable rows={rows} columns={[
    { name: 'Trabajo', render: (r) => <><strong className="jefe-reference">#{r.id}</strong><small>{r.tipo === 'orden' ? 'Orden de reparación' : 'Diagnóstico'}</small></> },
    { name: 'Equipo / cliente', className: 'equipment', render: (r) => <><strong>{r.equipo_nombre}</strong><small>{r.cliente_nombre}</small>{irreparable && <small>{r.justificacion_irreparable}</small>}</> },
    { name: 'Prioridad', render: (r) => <Badge value={r.prioridad} /> },
    { name: 'Responsable', render: (r) => <><strong>{r.tecnico?.nombre || 'Por asignar'}</strong><small>{r.tecnico?.especialidad || 'Sin técnico asignado'}</small></> },
    { name: 'Estado', render: (r) => <Badge value={r.estado} /> },
    ...(closed ? [{ name: 'Finalización', render: (r) => date(r.fecha_finalizacion) },
      { name: 'Correcciones', render: (r) => <strong>{correctionCount(r)}</strong> }] : !compact ? [{ name: 'Último avance', render: (r) => <><strong>{hours(r.horas_sin_avance)}</strong><small>{date(r.ultimo_avance)}</small></> }] : []),
    { name: 'Acciones', render: (r) => <div className="jefe-actions"><button className="jefe-btn" aria-label={`Ver ${r.tipo} ${r.id}`} onClick={() => onAction('detalle', r)}><Eye size={14} /></button>{assignment && r.puede_asignar && <button className="jefe-btn primary" onClick={() => onAction('asignar', r)}>Asignar <ArrowRight size={12} /></button>}{!compact && r.activo && <button className="jefe-btn" aria-label="Modificar prioridad" onClick={() => onAction('prioridad', r)}><SlidersHorizontal size={13} /></button>}{!compact && r.puede_intervenir && !assignment && !irreparable && <><button className="jefe-btn" onClick={() => onAction('reasignar', r)}>Corregir asignación</button>{r.tipo === 'orden' && <button className="jefe-btn danger" onClick={() => onAction('intervencion', r)}>Excepción</button>}</>}{irreparable && <button className="jefe-btn primary" onClick={() => onAction('irreparable', r)}>Revisar</button>}</div> },
  ]} />;
}
export function PartsTable({ rows, onAction }) {
  return <PagedTable rows={rows} columns={[
    { name: 'Orden y trabajo', className: 'equipment', render: (r) => <><strong className="jefe-reference">Orden #{r.orden_id}</strong><small>Solicitud #{r.id_detalle_repuesto}</small><strong>{equipoSolicitud(r)}</strong><small className="whitespace-pre-wrap">Falla: {r.orden?.diagnostico?.falla_reportada || 'Sin falla registrada'}</small></> },
    { name: 'Repuesto', className: 'equipment', render: (r) => <><strong>{r.repuesto?.nombre || r.pieza_solicitada}</strong><small>{r.cantidad_usada} unidad(es){!r.repuesto_id && ' · Pendiente de catálogo'}</small></> },
    { name: 'Solicitante', render: (r) => <><strong>{r.tecnico_solicitante?.nombre || r.orden?.tecnico?.nombre || 'Sin registrar'}</strong><small>{date(r.fecha_solicitud)}</small></> },
    { name: 'Aprobación', render: (r) => <><Badge value={r.estado_aprobacion} /><small>{r.usuario_aprobador?.nombre_usuario || r.motivo_rechazo || 'Pendiente de revisión'}</small></> },
    { name: 'Entrega', render: (r) => <><Badge value={r.estado_entrega} /><small>{r.fecha_entrega ? date(r.fecha_entrega) : 'Sin entregar'}</small></> },
    { name: 'Acciones', render: (r) => <div className="jefe-actions"><button className="jefe-btn" aria-label={`Historial de solicitud ${r.id_detalle_repuesto}`} onClick={() => onAction('historial_repuesto', r)}><Eye size={12} /> Historial</button>{r.puede_revisar && <><button className="jefe-btn primary" onClick={() => onAction('aprobar', r)}><Check size={12} /> Aprobar</button><button className="jefe-btn" onClick={() => onAction('rechazar', r)}>Rechazar</button></>}{r.puede_entregar && <button className="jefe-btn primary" onClick={() => onAction('entregar', r)}><PackageCheck size={13} /> Entregar</button>}{r.puede_corregir && <button className="jefe-btn" onClick={() => onAction('corregir', r)}>Corregir pieza/cantidad</button>}{correctionActions.filter(([, flag]) => r[flag]).map(([action, , title]) => <button key={action} className="jefe-btn" onClick={() => onAction(action, r)}>{title}</button>)}</div> },
  ]} empty="No hay solicitudes en esta vista." />;
}
export function TeamCards({ rows, onAction, onFilter }) {
  return <div className="jefe-team-grid">{rows.map((t) => <article className="jefe-card jefe-team-card" key={t.id_tecnico}><div className="jefe-person"><div className="jefe-avatar">{initials(t.nombre)}</div><div><p>{t.nombre}</p><small>{t.especialidad || 'Especialidad no registrada'}</small></div></div><Badge value={t.disponibilidad} /><div className="jefe-team-counts"><div><b>{t.diagnosticos_activos}</b><small>Diagnósticos</small></div><div><b>{t.ordenes_activas}</b><small>Reparaciones</small></div><div><b>{t.atrasados}</b><small>Alertas</small></div></div><div className="jefe-team-meta"><span>{t.horario || 'Horario no registrado'}</span><span>{t.contacto || 'Contacto no registrado'}</span>{t.observacion_disponibilidad && <span>{t.observacion_disponibilidad}</span>}</div><div className="jefe-actions"><button className="jefe-btn" onClick={() => onFilter(t)}>Ver trabajos</button><button className="jefe-btn" onClick={() => onAction('disponibilidad', t)}>Disponibilidad</button></div></article>)}{!rows.length && <div className="jefe-card jefe-empty">No hay técnicos con una cuenta activa en este rol.</div>}</div>;
}
export function CompactTeam({ rows, onView }) {
  return <>{rows.slice(0, 4).map((t) => <div className="jefe-person-compact" key={t.id_tecnico}><div className="jefe-avatar">{initials(t.nombre)}</div><div style={{ flex: 1 }}><strong>{t.nombre}</strong><small>{t.diagnosticos_activos + t.ordenes_activas} trabajos activos · {label(t.disponibilidad)}</small></div><span className="jefe-badge">{t.atrasados} alertas</span></div>)}{!rows.length && <p className="jefe-detail-text">No hay técnicos disponibles.</p>}<button className="jefe-btn" onClick={onView}>Ver equipo técnico <ArrowRight size={12} /></button></>;
}
export function InterventionTable({ rows, onOpenWork }) {
  return <PagedTable rows={rows} columns={[
    { name: 'Acción', render: (r) => <><strong className="jefe-reference">#{r.id_intervencion}</strong><small>{interventionTitle(r.tipo)}{r.datos_nuevos?.es_excepcion ? ' · Excepción' : ''}</small>{r.datos_nuevos?.id_detalle_repuesto && <small>Solicitud #{r.datos_nuevos.id_detalle_repuesto}</small>}</> },
    { name: 'Trabajo', render: (r) => <strong>{r.orden_id ? `Orden #${r.orden_id}` : `Diagnóstico #${r.diagnostico_id}`}</strong> },
    { name: 'Motivo', className: 'equipment', render: (r) => r.motivo },
    { name: 'Cambios', className: 'equipment', render: (r) => <CorrectionDetails movement={r} /> },
    { name: 'Responsable', render: (r) => r.usuario?.nombre_usuario || 'Sin registrar' },
    { name: 'Fecha y hora', render: (r) => date(r.fecha_hora) },
    { name: 'Expediente', render: (r) => <button type="button" className="jefe-btn" onClick={() => onOpenWork(r)}>Ver expediente</button> },
  ]} empty="Las correcciones y excepciones quedarán registradas aquí." />;
}
function PartHistory({ detail, row }) {
  const current = detail.registro.repuestos_usados.find((p) => p.id_detalle_repuesto === row.id_detalle_repuesto) || row;
  const movements = detail.intervenciones.filter((m) => m.datos_nuevos?.id_detalle_repuesto === row.id_detalle_repuesto);
  return <><h3>{current.repuesto?.nombre || current.pieza_solicitada} · {current.cantidad_usada} unidad(es)</h3><p className="jefe-detail-text">{label(current.estado_aprobacion)} · {current.estado_entrega === 'ENTREGADO' ? 'Entregada al técnico' : 'Pendiente de entrega'}</p><p className="jefe-detail-text">Solicitud: {date(current.fecha_solicitud)} · Aprobación: {date(current.fecha_aprobacion)} · Entrega: {date(current.fecha_entrega)}</p><div className="jefe-timeline"><h3>Correcciones registradas</h3>{movements.map((m) => <div className="jefe-timeline-row" key={m.id_intervencion}><p>{interventionTitle(m.tipo)}</p><small>{date(m.fecha_hora)} · {m.usuario?.nombre_usuario || 'Usuario histórico no disponible'}</small><p className="note">{m.motivo}</p><CorrectionDetails movement={m} /></div>)}{!movements.length && <p className="jefe-detail-text">Sin correcciones registradas.</p>}</div></>;
}
function Detail({ detail, row, onReview }) {
  const [tab, setTab] = useState('resumen');
  const tabsRef = useRef(null);
  const r = detail.registro, d = row.tipo === 'orden' ? r.diagnostico : r;
  const recepcion = [['Cargador', d.estado_cargador], ['Accesorios', d.estado_accesorios],
    ['Detalle de accesorios', d.detalle_accesorios], ['Condición física', d.estado_fisico],
    ['Encendido', d.estado_encendido], ['Alimentación', d.estado_alimentacion], ['Acceso', d.estado_acceso]]
    .filter(([, value]) => value != null && value !== '');
  const history = [...(detail.historial_estados || []).map((e) => ({ ...e, title: `${label(e.estado_anterior || 'Ingreso')} → ${label(e.estado_nuevo)}` })), ...(detail.asignaciones || []).map((e) => ({ ...e, title: `${e.es_excepcion ? 'Reasignación' : 'Asignación'}: ${e.tecnico_nuevo?.nombre || e.tecnico_nuevo_nombre || 'Sin técnico'}`, observacion: e.motivo }))].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));
  const sections = [['resumen', 'Datos generales'], ['informe', 'Informe y pruebas'],
    ...(row.tipo === 'orden' ? [['piezas', 'Piezas']] : []), ['fotos', 'Fotografías'],
    ['avances', 'Avances e historial'], ['correcciones', 'Correcciones']];
  const money = (v) => v == null ? 'Sin registrar' : new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(Number(v));
  return <>
    <nav ref={tabsRef} className="jefe-detail-tabs" aria-label="Secciones del expediente">{sections.map(([id, title]) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); tabsRef.current?.closest('.jefe-dialog-body')?.scrollTo({ top: 0 }); }}>{title}</button>)}</nav>
    <section className="jefe-detail-pane" aria-label={sections.find(([id]) => id === tab)?.[1]}>
    {tab === 'resumen' && <><dl className="jefe-detail-grid">{[
      ['Equipo', row.equipo_nombre], ['Cliente', row.cliente_nombre],
      ...(row.tipo === 'orden' ? [['Diagnóstico vinculado', `#${r.diagnostico_id}`]] : []),
      ['Estado', label(r.estado || r.estado_del_diagnostico)], ['Prioridad', label(r.prioridad)],
      ['Técnico responsable', r.tecnico?.nombre || 'Por asignar'], ['Asignación', date(r.fecha_asignacion)],
      ['Inicio real', date(r.fecha_inicio_reparacion || r.fecha_inicio)], ['Finalización', date(r.fecha_finalizacion || r.fecha_completado)],
      ['Presupuesto estimado', d.presupuesto_estimado == null ? 'Sin registrar' : formatoPresupuesto(d.presupuesto_estimado, d.moneda_presupuesto)], ...(row.tipo === 'orden' ? [['Monto autorizado', money(r.monto_autorizado)], ['Resultado final', label(r.resultado_final)]] : []),
    ].map(([name, v]) => <div key={name}><dt>{name}</dt><dd>{v}</dd></div>)}</dl>
    {recepcion.length > 0 && <div className="jefe-info"><h3>Condiciones de recepción</h3><dl className="jefe-detail-grid mt-3">{recepcion.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{label(value)}</dd></div>)}</dl></div>}</>}
    {tab === 'informe' && <>{[
      ['Falla reportada', d.falla_reportada], ['Informe técnico', d.diagnostico_real],
      ['Solución propuesta', d.solucion_propuesta && !String(d.diagnostico_real || '').includes(d.solucion_propuesta) ? d.solucion_propuesta : null],
      ['Resultado de reparación', r.observacion_final],
      ['Justificación de irreparabilidad', r.justificacion_irreparable], ['Revisión del jefe', r.motivo_revision_irreparable],
    ].filter(([, v]) => v).map(([name, v]) => <React.Fragment key={name}><h3>{name}</h3><p className="jefe-detail-text">{v}</p></React.Fragment>)}
    {row.tipo === 'orden' && (r.pruebas_salida || r.enciende_salida != null || r.usa_corriente_ac_salida != null) && <div className="jefe-info"><h3>Pruebas de salida</h3><p>Encendido: {changeValue('enciende_salida', r.enciende_salida)} · Alimentación: {changeValue('usa_corriente_ac_salida', r.usa_corriente_ac_salida)}</p>{r.pruebas_salida && <p className="whitespace-pre-wrap">{changeValue('pruebas_salida', r.pruebas_salida)}</p>}</div>}</>}
    {tab === 'piezas' && row.tipo === 'orden' && (r.repuestos_usados?.length ? <div className="jefe-table-wrap"><table className="jefe-table"><thead><tr><th>Pieza / cantidad</th><th>Aprobación</th><th>Entrega</th></tr></thead><tbody>{r.repuestos_usados.map((p) => <tr key={p.id_detalle_repuesto}><td><strong>{p.repuesto?.nombre || p.pieza_solicitada}</strong><small>{p.cantidad_usada} unidad(es)</small>{p.motivo_rechazo && <small>{p.motivo_rechazo}</small>}</td><td><Badge value={p.estado_aprobacion} /></td><td><Badge value={p.estado_entrega} />{p.fecha_entrega && <small>{date(p.fecha_entrega)}</small>}</td></tr>)}</tbody></table></div> : <p className="jefe-detail-text">Sin piezas registradas en esta reparación.</p>)}
    {tab === 'fotos' && <div className="space-y-3"><FotosServicio kind="diagnosticos" id={d.id_diagnostico} title="Fotografías del diagnóstico" readOnly reviewOnly onReview={onReview} />{row.tipo === 'orden' && <FotosServicio kind="ordenes" id={r.id_orden} title="Fotografías de la reparación" readOnly reviewOnly onReview={onReview} />}</div>}
    {tab === 'avances' && <><div className="jefe-timeline"><h3 className="mb-4">Avances técnicos {row.tipo === 'orden' ? `de la orden #${row.id}` : `del diagnóstico #${row.id}`}</h3>
      {(detail.avances || []).map((avance) => <div className="jefe-timeline-row" key={avance.id_avance}><p className="whitespace-pre-wrap">{avance.observacion}</p><small>{date(avance.fecha_hora)} · {avance.usuario?.nombre_usuario || 'Técnico'}</small></div>)}
      {!detail.avances?.length && <p className="jefe-detail-text">Sin avances registrados.</p>}
    </div>
    <div className="jefe-timeline"><h3 className="mb-4">Cambios de estado y asignaciones</h3>{history.map((e, i) => <div className="jefe-timeline-row" key={`${e.title}-${i}`}><p>{e.title}</p><small>{date(e.fecha_hora)} · {e.usuario?.nombre_usuario || 'Registro del sistema'}</small>{e.observacion && <p className="note">{e.observacion}</p>}</div>)}{!history.length && <p className="jefe-detail-text">Sin cambios de estado registrados.</p>}</div></>}
    {tab === 'correcciones' && <><div className="jefe-timeline"><h3 className="mb-4">Correcciones {row.tipo === 'orden' ? 'de la reparación' : 'del diagnóstico'}</h3>{(detail.intervenciones || []).map((e) => <div className="jefe-timeline-row" key={e.id_intervencion}><p>{interventionTitle(e.tipo)}</p><small>{date(e.fecha_hora)} · {e.usuario?.nombre_usuario || 'Registro del sistema'}</small><p className="note">Motivo: {e.motivo}</p><CorrectionDetails movement={e} /></div>)}{!detail.intervenciones?.length && <p className="jefe-detail-text">Sin correcciones registradas.</p>}</div>
      {row.tipo === 'orden' && <div className="jefe-timeline"><h3 className="mb-4">Correcciones del diagnóstico #{r.diagnostico_id}</h3>{(detail.intervenciones_diagnostico || []).map((e) => <div className="jefe-timeline-row" key={e.id_intervencion}><p>{interventionTitle(e.tipo)}</p><small>{date(e.fecha_hora)} · {e.usuario?.nombre_usuario || 'Registro del sistema'}</small><p className="note">Motivo: {e.motivo}</p><CorrectionDetails movement={e} /></div>)}{!detail.intervenciones_diagnostico?.length && <p className="jefe-detail-text">Sin correcciones del diagnóstico.</p>}</div>}</>}
    </section>
  </>;
}
export function SupervisionDialog({ state }) {
  const { dialog, detail, detailLoading, busy, formError, data, submit, closeDialog, refreshDetail } = state;
  const { action, row } = dialog, ref = useRef(null);
  const [values, setValues] = useState({ tecnico_id: '', prioridad: label(row.prioridad || 'Normal'), tipo: 'REASIGNACION', motivo: '', decision: 'APROBADO', disponibilidad: row.disponibilidad || 'DISPONIBLE', observacion_disponibilidad: row.observacion_disponibilidad || '', repuesto_id: String(row.repuesto_id || ''), cantidad_usada: row.cantidad_usada || 1, observacion_final: '', enciende_salida: '', usa_corriente_ac_salida: '', entrega_no_realizada: false, devolucion_total_confirmada: false });
  useEffect(() => { const el = ref.current; el.showModal(); return () => el.close(); }, []);
  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));
  const titles = { detalle: 'Detalle e historial', historial_repuesto: 'Historial de la solicitud', reasignar: 'Corregir asignación', asignar: 'Asignar técnico', prioridad: 'Modificar prioridad', intervencion: 'Intervención excepcional', disponibilidad: 'Disponibilidad del técnico', aprobar: 'Aprobar solicitud', rechazar: 'Rechazar solicitud', entregar: 'Registrar entrega de repuesto', corregir: 'Corregir pieza o cantidad', irreparable: 'Revisar irreparabilidad', ...Object.fromEntries(correctionActions.map(([key, , title]) => [key, title])) };
  const readOnly = ['detalle', 'historial_repuesto'].includes(action);
  const techSelect = <label className="jefe-field">Técnico responsable<select required className="jefe-select" value={values.tecnico_id} onChange={set('tecnico_id')}><option value="">Selecciona un técnico disponible</option>{data.tecnicos.filter((t) => t.disponibilidad === 'DISPONIBLE' && t.id_tecnico !== row.tecnico?.id_tecnico).map((t) => <option key={t.id_tecnico} value={t.id_tecnico}>{t.nombre} · {t.diagnosticos_activos + t.ordenes_activas} trabajos activos</option>)}</select></label>;
  return createPortal(<dialog ref={ref} className="jefe-dialog" aria-labelledby="jefe-dialog-title" onCancel={(e) => { e.preventDefault(); closeDialog(); }}><div className="jefe-dialog-header"><div><h2 id="jefe-dialog-title">{titles[action]}</h2><small>{row.id ? `${row.tipo === 'orden' ? 'Orden' : 'Diagnóstico'} #${row.id} · ${row.equipo_nombre}` : row.nombre || `Solicitud #${row.id_detalle_repuesto} · Orden #${row.orden_id}`}</small></div><button type="button" className="jefe-icon-btn" aria-label="Cerrar diálogo" disabled={busy} onClick={closeDialog}><X size={17} /></button></div><form onSubmit={(e) => { e.preventDefault(); if (!readOnly) submit(values); }}><div className="jefe-dialog-body">{formError && <div className="jefe-message error" role="alert">{formError}</div>}
    {action === 'detalle' && (detailLoading ? <p>Cargando el historial…</p> : detail ? <Detail detail={detail} row={row} onReview={refreshDetail} /> : null)}
    {action === 'historial_repuesto' && (detailLoading ? <p>Cargando el historial…</p> : detail ? <PartHistory detail={detail} row={row} /> : null)}
    {['aprobar', 'rechazar'].includes(action) && <section className="jefe-info" aria-label="Contexto de la orden"><strong>Orden #{row.orden_id} · {equipoSolicitud(row)}</strong><p className="mt-2 whitespace-pre-wrap"><b>Falla reportada:</b> {row.orden?.diagnostico?.falla_reportada || 'Sin falla registrada'}</p><p className="mt-2 whitespace-pre-wrap"><b>Informe técnico:</b> {row.orden?.diagnostico?.diagnostico_real || 'Sin informe registrado'}</p><p className="mt-2"><b>Pieza solicitada:</b> {row.repuesto?.nombre || row.pieza_solicitada || 'Sin descripción'} · {row.cantidad_usada} unidad(es)</p></section>}
    {action === 'reasignar' && <><div className="jefe-info">Selecciona el nuevo responsable y explica el error. El historial conserva la asignación anterior y el avance del trabajo.</div>{techSelect}</>}
    {action === 'asignar' && <><div className="jefe-info">El técnico registrará el inicio cuando comience a trabajar.</div>{techSelect}</>}
    {action === 'prioridad' && <label className="jefe-field">Prioridad<select className="jefe-select" value={values.prioridad} onChange={set('prioridad')}><option>Normal</option><option>Alta</option><option>Urgente</option></select></label>}
    {action === 'intervencion' && <><div className="jefe-info warning">Se registrarán tu usuario, el motivo y los cambios. La responsabilidad y el informe técnico se conservarán.</div><label className="jefe-field">Tipo de intervención<select className="jefe-select" value={values.tipo} onChange={set('tipo')}><option value="REASIGNACION">Reasignación excepcional</option>{row.tipo === 'orden' && <option value="FINALIZACION">Finalización excepcional</option>}</select></label>{values.tipo === 'REASIGNACION' ? techSelect : <><label className="jefe-field">Resultado comprobado del trabajo<textarea required maxLength={4000} className="jefe-input" value={values.observacion_final} onChange={set('observacion_final')} /></label>{['enciende_salida', 'usa_corriente_ac_salida'].map((name) => <label className="jefe-field" key={name}>{name === 'enciende_salida' ? '¿El equipo enciende al finalizar?' : '¿Funciona la alimentación eléctrica?'}<select required className="jefe-select" value={values[name]} onChange={set(name)}><option value="">Selecciona una respuesta</option><option value="true">Sí</option><option value="false">No</option></select></label>)}</>}</>}
    {action === 'disponibilidad' && <><label className="jefe-field">Disponibilidad<select className="jefe-select" value={values.disponibilidad} onChange={set('disponibilidad')}><option value="DISPONIBLE">Disponible</option><option value="AUSENTE">Ausente</option><option value="NO_DISPONIBLE">No disponible</option></select></label><label className="jefe-field">Observación<textarea required={values.disponibilidad !== 'DISPONIBLE'} maxLength={2000} className="jefe-input" value={values.observacion_disponibilidad} onChange={set('observacion_disponibilidad')} /></label></>}
    {['aprobar', 'corregir'].includes(action) && <><label className="jefe-field">Repuesto del inventario<select required className="jefe-select" value={values.repuesto_id} onChange={set('repuesto_id')}><option value="">Selecciona el repuesto</option>{data.catalogo.map((p) => <option key={p.id_repuesto} value={p.id_repuesto}>{p.nombre} · {p.stock_disponible} disponibles</option>)}</select></label><label className="jefe-field">Cantidad<input type="number" required min="1" step="1" className="jefe-input" value={values.cantidad_usada} onChange={set('cantidad_usada')} /></label>{action === 'aprobar' && <div className="jefe-info">La aprobación reserva las piezas. La entrega al técnico se confirma por separado.</div>}</>}
    {action === 'entregar' && <div className="jefe-info">Confirma la entrega física de {row.cantidad_usada} unidad(es) de {row.repuesto?.nombre || row.pieza_solicitada}. Se registrará tu usuario y la hora de entrega.</div>}
    {correctionActions.some(([key]) => key === action) && <div className="jefe-info">Solicitud #{row.id_detalle_repuesto}: {row.cantidad_usada} unidad(es) de {row.repuesto?.nombre || row.pieza_solicitada}. Estado actual: {label(row.estado_aprobacion)} · {row.estado_entrega === 'ENTREGADO' ? 'Entregada al técnico' : 'Pendiente de entrega'}.</div>}
    {['retirar-aprobacion', 'reabrir'].includes(action) && <div className="jefe-info warning">La solicitud volverá a revisión. Retirar una aprobación libera su reserva; será necesario aprobar o rechazar nuevamente la solicitud antes de cerrar la reparación.</div>}
    {action === 'corregir-entrega' && <><div className="jefe-info warning">La pieza volverá a pendiente de entrega. La aprobación y la reserva siguen vigentes.</div><label className="jefe-confirm"><input type="checkbox" required checked={values.entrega_no_realizada} onChange={(e) => setValues((v) => ({ ...v, entrega_no_realizada: e.target.checked }))} />Confirmo que la pieza nunca fue entregada físicamente al técnico.</label></>}
    {action === 'devolver' && <><div className="jefe-info warning">Registra la devolución total de {row.cantidad_usada} unidad(es) al almacén. La solicitud volverá a revisión y se liberará la reserva para decidir si se usará nuevamente o se rechazará.</div><label className="jefe-confirm"><input type="checkbox" required checked={values.devolucion_total_confirmada} onChange={(e) => setValues((v) => ({ ...v, devolucion_total_confirmada: e.target.checked }))} />Confirmo que recibí todas las unidades y están en condiciones de volver al almacén.</label></>}
    {action === 'irreparable' && <><div className="jefe-info">Justificación del técnico: {row.justificacion_irreparable}</div><label className="jefe-field">Decisión<select className="jefe-select" value={values.decision} onChange={set('decision')}><option value="APROBADO">Confirmar irreparabilidad</option><option value="RECHAZADO">Devolver a reparación</option></select></label></>}
    {['intervencion', 'reasignar', 'rechazar', 'corregir', 'irreparable', 'prioridad', ...correctionActions.map(([key]) => key)].includes(action) && <label className="jefe-field">{action === 'rechazar' ? 'Motivo del rechazo' : 'Motivo de la acción'}<textarea required maxLength={2000} className="jefe-input" value={values.motivo} onChange={set('motivo')} /></label>}
    </div><div className="jefe-dialog-footer"><button type="button" className="jefe-btn" disabled={busy} onClick={closeDialog}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>{!readOnly && <button className="jefe-btn primary" type="submit" disabled={busy}>{busy ? 'Registrando…' : action === 'intervencion' ? 'Registrar intervención' : 'Confirmar'}</button>}</div></form></dialog>, document.body);
}
