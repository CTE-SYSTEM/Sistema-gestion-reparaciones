import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import api from '../../../services/api';
import { formatoPresupuesto } from '../../../utils/monedaPresupuesto';
import FotosServicio from '../../secretaria/components/shared/FotosServicio';
import HistorialEstados from '../../secretaria/components/shared/HistorialEstados';
import { mapDiagnostico, mapOrden } from '../utils/tecnicoMappers';
import { EstadoBadge, PrioridadBadge } from './TecnicoBadges';

const fecha = (value) => value ? new Date(value).toLocaleString('es-NI', { timeZone: 'America/Managua' }) : 'Sin registro';
const pruebaLabels = { encendido: 'Encendido', alimentacion: 'Alimentación', funcion_principal: 'Función principal', carga: 'Carga', pantalla: 'Pantalla', conectividad: 'Conectividad' };

const labels = { estado_cargador: 'Cargador', estado_accesorios: 'Accesorios', estado_fisico: 'Condición física',
  estado_encendido: 'Encendido', estado_alimentacion: 'Alimentación', estado_acceso: 'Acceso', detalle_accesorios: 'Detalle de accesorios' };
export const RecepcionTecnica = ({ recepcion = {} }) => <section className="rounded-xl border bg-slate-50 p-4 text-left">
  <h3 className="mb-3 text-sm font-semibold">Condiciones de recepción</h3>
  <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(labels).map(([key, label]) => <div key={key}>
    <dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm">{String(recepcion[key] || 'Sin registro').replaceAll('_', ' ')}</dd>
  </div>)}</dl>
</section>;

export default function ExpedienteTecnico({ kind, id, onClose, username }) {
  const [nota, setNota] = useState('');
  const [registroAbierto, setRegistroAbierto] = useState(false);
  const client = useQueryClient();
  const key = ['tecnico', username, 'expediente', kind, id];
  const detail = useQuery({ queryKey: key, queryFn: async ({ signal }) => (await api.get(`/tecnicos/${kind === 'orden' ? 'ordenes' : 'diagnosticos'}/${id}`, { signal })).data.data });
  const avance = useMutation({ mutationFn: () => api.post(`/tecnicos/${kind === 'orden' ? 'ordenes' : 'diagnosticos'}/${id}/avances`, { observacion: nota }),
    onSuccess: () => { setNota(''); setRegistroAbierto(false); client.invalidateQueries({ queryKey: ['tecnico', username] }); } });
  const r = detail.data?.registro, item = r ? (kind === 'orden' ? mapOrden(r) : mapDiagnostico(r)) : null;
  const presupuesto = kind === 'orden' ? r?.diagnostico?.presupuesto_estimado : item?.presupuesto;
  const moneda = kind === 'orden' ? r?.diagnostico?.moneda_presupuesto : item?.moneda_presupuesto;
  const editable = item && (kind === 'orden' ? item.fecha_inicio_reparacion && ['EN_REPARACION', 'ESPERANDO_PIEZA'].includes(item.estado) : item.fecha_inicio && item.estado === 'EN_REVISION');
  return <Dialog open onClose={onClose} className="relative z-[110] tecnico-dialog">
    <div className="fixed inset-0 bg-slate-950/60" aria-hidden="true" /><div className="fixed inset-0 overflow-y-auto p-4 sm:p-8"><DialogPanel className="mx-auto max-w-3xl rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between bg-white py-2"><DialogTitle className="text-lg font-bold">Expediente técnico · #{id}</DialogTitle><button type="button" onClick={onClose} aria-label="Cerrar expediente" className="rounded border px-3 py-2">Cerrar</button></div>
      {detail.isPending && <p role="status">Cargando expediente…</p>}
      {detail.error && <p role="alert" className="text-red-700">{detail.error.response?.data?.error || 'No se pudo cargar el expediente'} <button onClick={() => detail.refetch()}>Reintentar</button></p>}
      {item && <div className="space-y-4">
        <p className="font-semibold">{item.equipo}</p><p className="whitespace-pre-wrap text-sm">Falla: {item.falla}</p>
        <section className="rounded-xl border p-4 text-sm"><div className="mb-3 flex gap-2"><EstadoBadge estado={item.estado === 'IRREPARABLE' && item.irreparable_estado === 'PENDIENTE' ? 'REVISION_JEFE' : item.estado} /><PrioridadBadge prioridad={item.prioridad} /></div>
          <dl className="grid gap-3 sm:grid-cols-2">{[['Asignación', item.fecha_asignacion], ['Inicio real', item.fecha_inicio || item.fecha_inicio_reparacion], ['Finalización', item.fecha_completado || item.fecha_finalizacion], ...((kind !== 'orden' || item.fecha_inicio_reparacion) ? [['Último avance', item.ultimo_avance]] : [])].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd>{fecha(value)}</dd></div>)}</dl>
          {kind === 'orden' && <p className="mt-3">{item.autorizacion_reparacion ? 'Autorización de reparación registrada.' : 'Sin autorización de reparación registrada.'}</p>}
        </section>
        <RecepcionTecnica recepcion={item.recepcion} />
        <div className="rounded-xl border p-4"><h3 className="font-semibold">Informe técnico</h3><p className="whitespace-pre-wrap text-sm">{item.diagnostico || 'Sin informe final'}</p>{item.solucion && <p className="mt-2 whitespace-pre-wrap text-sm">Solución: {item.solucion}</p>}{presupuesto !== '' && presupuesto != null && <p className="mt-2 text-sm">Presupuesto técnico: {formatoPresupuesto(presupuesto, moneda)}</p>}{item.observacion_final && <p className="mt-2 whitespace-pre-wrap text-sm">Pruebas y resultado: {item.observacion_final}</p>}</div>
        {item.borrador && <section className="rounded-xl border border-indigo-200 p-4 text-sm"><h3 className="font-semibold">Borrador · {fecha(item.fecha_borrador)}</h3><p className="whitespace-pre-wrap">{item.borrador.diagnostico}</p><p className="mt-2 whitespace-pre-wrap">{item.borrador.solucion}</p>{item.borrador.presupuesto !== '' && item.borrador.presupuesto != null && <p className="mt-2">Presupuesto del borrador: {formatoPresupuesto(item.borrador.presupuesto, item.borrador.moneda_presupuesto)}</p>}<p className="mt-2">Pendiente de completar el informe.</p></section>}
        {kind === 'orden' && (item.pruebas_salida || typeof item.enciende_salida === 'boolean') && <section className="rounded-xl border p-4"><h3 className="mb-3 font-semibold">Pruebas de salida</h3><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Encendido</dt><dd>{item.enciende_salida == null ? 'Sin registro' : item.enciende_salida ? 'Enciende' : 'No enciende'}</dd></div><div><dt className="text-xs text-slate-500">Alimentación AC</dt><dd>{item.usa_corriente_ac_salida == null ? 'Sin registro' : item.usa_corriente_ac_salida ? 'Probada con AC' : 'No / No aplica'}</dd></div>{Object.entries(item.pruebas_salida || {}).map(([key, result]) => <div key={key}><dt className="text-xs text-slate-500">{pruebaLabels[key]}</dt><dd>{result.replaceAll('_', ' ')}</dd></div>)}</dl></section>}
        {kind === 'orden' && item.irreparable_estado !== 'NO_SOLICITADO' && <div className="rounded-xl border border-amber-200 p-4 text-sm"><strong>Revisión de irreparabilidad: {item.irreparable_estado}</strong><p>{item.motivo_revision_irreparable || 'Pendiente de decisión del jefe técnico'}</p></div>}
        {kind === 'orden' && <section className="rounded-xl border p-4 text-sm"><h3 className="mb-3 font-semibold">Solicitudes de piezas</h3>{item.repuestos_usados.length === 0 && <p>Sin solicitudes registradas.</p>}{item.repuestos_usados.map((p) => <article key={p.id_detalle_repuesto} className="mb-3 rounded border p-3"><strong>{p.repuesto?.nombre || p.pieza_solicitada} · {p.cantidad_usada}</strong><p>{p.estado_aprobacion === 'APROBADO' ? p.estado_entrega === 'ENTREGADO' ? 'Aprobada y entregada' : 'Aprobada · pendiente de entrega física' : p.estado_aprobacion === 'DENEGADO' ? 'Rechazada' : 'Pendiente de aprobación'}</p><p className="text-xs text-slate-500">Solicitada: {fecha(p.fecha_solicitud)}{p.fecha_aprobacion ? ' · Aprobada: ' + fecha(p.fecha_aprobacion) : ''}{p.fecha_entrega ? ' · Entregada: ' + fecha(p.fecha_entrega) : ''}</p>{p.motivo_rechazo && <p>Motivo: {p.motivo_rechazo}</p>}</article>)}</section>}
        {kind === 'orden' && <section className="rounded-xl border p-4 text-sm"><h3 className="mb-3 font-semibold">Correcciones del cierre</h3>{!detail.data.correcciones?.length && <p className="text-slate-500">Sin correcciones registradas.</p>}{detail.data.correcciones?.map((c) => <article key={c.id_intervencion} className="mb-3 border-l-2 border-amber-300 pl-3"><strong>{c.tipo === 'CORRECCION_CIERRE' ? 'Informe corregido' : c.tipo === 'ACLARACION_CIERRE' ? 'Aclaración técnica' : c.tipo === 'REAPERTURA_CIERRE' ? 'Reparación reabierta' : 'Foto agregada tras el cierre'}{c.es_excepcion ? ' · Excepción' : ''}</strong><p className="text-xs text-slate-500">{fecha(c.fecha_hora)} · {c.usuario}</p><p className="mt-1 whitespace-pre-wrap">Motivo: {c.motivo}</p>{c.aclaracion && <p className="mt-1 whitespace-pre-wrap">Aclaración: {c.aclaracion}</p>}{['CORRECCION_CIERRE', 'REAPERTURA_CIERRE'].includes(c.tipo) && <><p className="mt-1 whitespace-pre-wrap">Antes: {c.observacion_anterior || 'Sin registro'}</p><p className="mt-1 whitespace-pre-wrap">Después: {c.observacion_nueva || 'Pendiente de nuevo cierre'}</p></>}{c.id_archivo && <p className="mt-1">Fotografía #{c.id_archivo} añadida.</p>}</article>)}</section>}
        <FotosServicio kind="diagnosticos" id={kind === 'orden' ? item.diagnostico_id : id} readOnly />
        {kind === 'orden' && <FotosServicio kind="ordenes" id={id} readOnly />}
        <HistorialEstados rows={detail.data.historial} />
        <section className="rounded-xl border p-4"><h3 className="mb-3 font-semibold">Asignaciones</h3>{detail.data.asignaciones.map((a) => <p key={a.id_historial} className="text-sm">{new Date(a.fecha_hora).toLocaleString('es-NI', { timeZone: 'America/Managua' })} · {a.tecnico_nuevo_nombre || 'Sin responsable'}{a.es_excepcion ? ' · Reasignación' : ''}</p>)}</section>
        {(kind !== 'orden' || item.fecha_inicio_reparacion) && <section className="rounded-xl border p-4"><h3 className="mb-3 font-semibold">Bitácora de avances</h3>{detail.data.avances.length === 0 && <p className="text-sm text-slate-500">Sin avances registrados.</p>}{detail.data.avances.map((a) => <article key={a.id_avance} className="mb-3 border-l-2 border-indigo-300 pl-3"><p className="whitespace-pre-wrap text-sm">{a.observacion}</p><small className="text-slate-500">{new Date(a.fecha_hora).toLocaleString('es-NI', { timeZone: 'America/Managua' })} · {a.usuario?.nombre_usuario}</small></article>)}
          {editable && <button type="button" onClick={() => { setRegistroAbierto((value) => !value); avance.reset(); }} aria-expanded={registroAbierto} className="rounded border px-3 py-2 text-sm font-semibold text-indigo-700">{registroAbierto ? 'Cancelar registro' : 'Registrar avance'}</button>}
          {editable && registroAbierto && <form onSubmit={(e) => { e.preventDefault(); if (nota.trim()) avance.mutate(); }} className="mt-4 space-y-2"><label className="block text-sm">Registrar avance técnico<textarea value={nota} onChange={(e) => { setNota(e.target.value); avance.reset(); }} disabled={avance.isPending} required maxLength={2000} rows={3} className="mt-1 w-full rounded border bg-white p-2" placeholder="Trabajo realizado, pruebas o motivo técnico de espera" /></label><button disabled={avance.isPending || !nota.trim()} className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{avance.isPending ? 'Guardando…' : 'Guardar avance'}</button>{avance.error && <p role="alert" className="text-sm text-red-700">{avance.error.response?.data?.error || 'No se pudo guardar el avance'}</p>}</form>}
          {avance.isSuccess && <p role="status" className="mt-2 text-sm text-emerald-700">Avance guardado.</p>}
        </section>}
      </div>}
    </DialogPanel></div>
  </Dialog>;
}
