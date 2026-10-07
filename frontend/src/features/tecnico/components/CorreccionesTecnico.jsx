import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const field = 'mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm';
const button = 'rounded border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700';

function useCorreccion(url, username, onDone) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (body) => api.patch(url, body), onSuccess: () => {
    client.invalidateQueries({ queryKey: ['tecnico', username] });
    onDone?.();
  } });
}

function Resultado({ mutation }) {
  return <>{mutation.error && <p role="alert" className="text-sm text-red-700">{mutation.error.response?.data?.error || 'No se pudo guardar la corrección.'}</p>}
    {mutation.isSuccess && <p role="status" className="text-sm text-emerald-700">Corrección registrada.</p>}</>;
}

export function CorreccionDiagnostico({ id, item, puedeCorregir, puedeReabrir, motivoBloqueo, openInitially = false, username }) {
  const [open, setOpen] = useState(openInitially), [tipo, setTipo] = useState(openInitially ? 'ACLARAR' : puedeCorregir ? 'CORREGIR' : 'ACLARAR');
  const [motivo, setMotivo] = useState(''), [aclaracion, setAclaracion] = useState('');
  const [informe, setInforme] = useState(item.diagnostico || ''), [solucion, setSolucion] = useState(item.solucion || '');
  const [presupuesto, setPresupuesto] = useState(item.presupuesto ?? ''), [moneda, setMoneda] = useState(item.moneda_presupuesto || 'NIO');
  const mutation = useCorreccion(`/tecnicos/diagnosticos/${id}/correccion`, username, () => setOpen(false));
  return <section className="rounded-xl border p-4 text-sm"><button type="button" className={button} onClick={() => setOpen(!open)}>{open ? 'Cerrar corrección' : puedeReabrir ? 'Corregir o reabrir diagnóstico' : 'Añadir aclaración técnica'}</button>
    {open && <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate({ tipo, motivo, aclaracion, diagnostico_real: informe, solucion_propuesta: solucion, presupuesto_estimado: presupuesto, moneda_presupuesto: moneda }); }}>
      <label className="block">Acción<select className={field} value={tipo} onChange={(e) => setTipo(e.target.value)}>{puedeCorregir && <option value="CORREGIR">Corregir informe</option>}{puedeReabrir && <option value="REABRIR">Reabrir diagnóstico</option>}<option value="ACLARAR">Añadir aclaración</option></select></label>
      {!puedeCorregir && <p className="text-slate-600">{motivoBloqueo || 'El informe original se conserva. Puede añadir una aclaración al historial.'}</p>}
      {tipo === 'CORREGIR' ? <><label className="block">Informe corregido<textarea className={field} required maxLength={10000} rows={4} value={informe} onChange={(e) => setInforme(e.target.value)} /></label>
        <label className="block">Solución propuesta<textarea className={field} maxLength={10000} rows={2} value={solucion} onChange={(e) => setSolucion(e.target.value)} /></label>
        <div className="grid gap-2 sm:grid-cols-2"><label>Presupuesto estimado<input className={field} type="number" min="0" step="0.01" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} /></label><label>Moneda<select className={field} value={moneda} onChange={(e) => setMoneda(e.target.value)}><option value="NIO">Córdobas</option><option value="USD">Dólares</option></select></label></div></>
        : tipo === 'REABRIR' ? <p className="rounded border border-indigo-200 bg-indigo-50 p-3">El diagnóstico volverá a revisión. El informe actual quedará como borrador para editarlo y completarlo de nuevo; el cierre anterior seguirá en el historial.</p>
          : <label className="block">Aclaración<textarea className={field} required maxLength={4000} rows={3} value={aclaracion} onChange={(e) => setAclaracion(e.target.value)} /></label>}
      <label className="block">Motivo de la corrección<textarea className={field} required maxLength={2000} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <button className="rounded bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-50" disabled={mutation.isPending}>{tipo === 'REABRIR' ? 'Reabrir diagnóstico' : 'Guardar corrección'}</button><Resultado mutation={mutation} />
    </form>}</section>;
}

export function CorreccionAvance({ kind, id, avance, username }) {
  const [open, setOpen] = useState(false), [observacion, setObservacion] = useState(avance.observacion), [motivo, setMotivo] = useState('');
  const route = kind === 'orden' ? 'ordenes' : 'diagnosticos';
  const mutation = useCorreccion(`/tecnicos/${route}/${id}/avances/${avance.id_avance}`, username, () => setOpen(false));
  return <div className="mt-2"><button type="button" className={button} onClick={() => setOpen(!open)}>{open ? 'Cancelar corrección' : 'Corregir nota'}</button>
    {open && <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); mutation.mutate({ observacion, motivo }); }}>
      <label className="block text-sm">Nota corregida<textarea className={field} required maxLength={2000} rows={3} value={observacion} onChange={(e) => setObservacion(e.target.value)} /></label>
      <label className="block text-sm">Motivo<textarea className={field} required maxLength={2000} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <button className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white" disabled={mutation.isPending}>Guardar nota</button><Resultado mutation={mutation} />
    </form>}</div>;
}

export function CorreccionSolicitud({ solicitud, username }) {
  const [open, setOpen] = useState(false), [tipo, setTipo] = useState('CORREGIR');
  const [pieza, setPieza] = useState(solicitud.pieza_solicitada || solicitud.repuesto?.nombre || '');
  const [cantidad, setCantidad] = useState(solicitud.cantidad_usada || 1), [motivo, setMotivo] = useState('');
  const mutation = useCorreccion(`/tecnicos/solicitudes/${solicitud.id_detalle_repuesto}`, username, () => setOpen(false));
  return <div className="mt-2"><button type="button" className={button} onClick={() => setOpen(!open)}>{open ? 'Cerrar edición' : 'Corregir o retirar solicitud'}</button>
    {open && <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); mutation.mutate({ tipo, pieza_solicitada: pieza, cantidad, motivo }); }}>
      <label className="block">Acción<select className={field} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="CORREGIR">Corregir solicitud</option><option value="RETIRAR">Retirar solicitud</option></select></label>
      {tipo === 'CORREGIR' && <><label className="block">Pieza solicitada<input className={field} required maxLength={250} value={pieza} onChange={(e) => setPieza(e.target.value)} /></label><label className="block">Cantidad<input className={field} required type="number" min="1" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></label></>}
      <label className="block">Motivo<textarea className={field} required maxLength={2000} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <button className="rounded bg-indigo-600 px-3 py-2 font-semibold text-white" disabled={mutation.isPending}>{tipo === 'RETIRAR' ? 'Retirar solicitud' : 'Guardar corrección'}</button><Resultado mutation={mutation} />
    </form>}</div>;
}

export function CorreccionIrreparable({ id, justificacion, username }) {
  const [open, setOpen] = useState(false), [tipo, setTipo] = useState('CORREGIR');
  const [texto, setTexto] = useState(justificacion || ''), [motivo, setMotivo] = useState('');
  const mutation = useCorreccion(`/tecnicos/ordenes/${id}/irreparable`, username, () => setOpen(false));
  return <section className="rounded-xl border border-amber-200 p-4 text-sm"><button type="button" className={button} onClick={() => setOpen(!open)}>{open ? 'Cerrar corrección' : 'Corregir o retirar informe irreparable'}</button>
    {open && <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); mutation.mutate({ tipo, justificacion: texto, motivo }); }}>
      <label className="block">Acción<select className={field} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="CORREGIR">Corregir justificación</option><option value="RETIRAR">Retirar informe y continuar reparación</option></select></label>
      {tipo === 'CORREGIR' && <label className="block">Justificación corregida<textarea className={field} required maxLength={4000} rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} /></label>}
      <label className="block">Motivo<textarea className={field} required maxLength={2000} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <button className="rounded bg-indigo-600 px-3 py-2 font-semibold text-white" disabled={mutation.isPending}>{tipo === 'RETIRAR' ? 'Retirar informe' : 'Guardar corrección'}</button><Resultado mutation={mutation} />
    </form>}</section>;
}

const nombres = { CORRECCION_DIAGNOSTICO: 'Diagnóstico corregido', ACLARACION_DIAGNOSTICO: 'Aclaración del diagnóstico', REAPERTURA_DIAGNOSTICO: 'Diagnóstico reabierto',
  CORRECCION_AVANCE: 'Nota de avance corregida', CORRECCION_SOLICITUD_TECNICO: 'Solicitud de pieza corregida',
  RETIRO_SOLICITUD_TECNICO: 'Solicitud de pieza retirada', CORRECCION_IRREPARABLE: 'Informe irreparable corregido',
  RETIRO_IRREPARABLE: 'Informe irreparable retirado', CORRECCION_CIERRE: 'Cierre corregido',
  ACLARACION_CIERRE: 'Aclaración del cierre', REAPERTURA_CIERRE: 'Reparación reabierta', CORRECCION_FOTO_CIERRE: 'Fotografía de cierre corregida' };
const resumen = (data = {}) => Object.entries(data).filter(([key]) => ['observacion', 'diagnostico_real', 'solucion_propuesta', 'pieza_solicitada', 'cantidad_usada', 'justificacion_irreparable', 'aclaracion', 'estado'].includes(key))
  .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value ?? 'Sin registro'}`).join(' · ');
export function HistorialCorrecciones({ rows = [] }) {
  return <section className="rounded-xl border p-4 text-sm"><h3 className="mb-3 font-semibold">Historial de correcciones</h3>{!rows.length && <p className="text-slate-500">Sin correcciones registradas.</p>}
    {rows.map((c) => <article key={c.id_intervencion} className="mb-3 border-l-2 border-amber-300 pl-3"><strong>{nombres[c.tipo] || 'Corrección técnica'}</strong><p className="text-xs text-slate-500">{new Date(c.fecha_hora).toLocaleString('es-NI', { timeZone: 'America/Managua' })} · {c.usuario}</p><p className="whitespace-pre-wrap">Motivo: {c.motivo}</p>{resumen(c.antes) && <p className="whitespace-pre-wrap">Antes: {resumen(c.antes)}</p>}{resumen(c.despues) && <p className="whitespace-pre-wrap">Después: {resumen(c.despues)}</p>}{c.id_archivo && <p>Fotografía #{c.id_archivo} añadida.</p>}</article>)}</section>;
}
