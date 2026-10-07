import React, { useState } from 'react';
import { EstadoBadge, PrioridadBadge } from './TecnicoBadges';

const fecha = (value) => value ? new Date(value).toLocaleString('es-NI', { timeZone: 'America/Managua' }) : 'Sin registro';

function ReaperturaDiagnostico({ diagnostico, loading, onReopen, onAclarar }) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const enabled = diagnostico.puede_reabrir_diagnostico;
  const submit = async (event) => {
    event.preventDefault();
    setError(''); setSaving(true);
    try { await onReopen(diagnostico.id, motivo.trim()); setOpen(false); setMotivo(''); }
    catch (err) { setError(err.response?.data?.error || 'No se pudo reabrir el diagnóstico.'); }
    finally { setSaving(false); }
  };
  return <div className="w-full max-w-xs">
    {enabled ? <button type="button" disabled={loading || saving} onClick={() => { setOpen(!open); setError(''); }}
      className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-60">
      {open ? 'Cancelar reapertura' : 'Reabrir diagnóstico'}
    </button> : <button type="button" onClick={() => onAclarar(diagnostico)} className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">Añadir aclaración</button>}
    {!enabled && <p className="mt-1 text-xs text-slate-500">{diagnostico.motivo_reapertura || 'No se puede reabrir este diagnóstico; puede añadir una aclaración.'}</p>}
    {open && <form onSubmit={submit} className="mt-2 space-y-2 rounded border border-amber-200 bg-white p-3">
      <p className="text-xs text-slate-700">Volverá a revisión. El informe actual quedará como borrador y el cierre anterior en el historial.</p>
      <label className="block text-xs font-semibold">Motivo de la reapertura
        <textarea required maxLength={2000} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 w-full rounded border bg-white p-2 font-normal" />
      </label>
      <button type="submit" disabled={saving || !motivo.trim()} className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Reabriendo…' : 'Confirmar reapertura'}</button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>}
  </div>;
}

export default function DiagnosticosTable({ items, loading, readOnly, onOpenDiagnostico, onIniciarDiagnostico, onOpenDetalle, onReopen }) {
  return <div className="tecnico-table tecnico-table-diagnosticos overflow-x-auto rounded-xl border border-slate-200 bg-white text-slate-900">
    <table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4" scope="col">Trabajo</th><th className="p-4" scope="col">Equipo y falla</th><th className="p-4" scope="col">Estado</th><th className="p-4" scope="col">Fechas</th><th className="p-4" scope="col">Acciones</th></tr></thead>
      <tbody className="divide-y">{items.map((d) => <tr key={d.id}>
        <td className="p-4"><span className="tecnico-cell-label" aria-hidden="true">Trabajo</span><strong>#{d.id}</strong><div className="mt-2"><PrioridadBadge prioridad={d.prioridad} /></div></td>
        <td className="p-4"><span className="tecnico-cell-label" aria-hidden="true">Equipo y falla</span><strong>{d.equipo}</strong><p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{d.falla}</p>{!readOnly && d.horas_sin_avance >= 72 && <p className="mt-2 text-xs text-amber-700">72 horas o más sin avance</p>}</td>
        <td className="p-4"><span className="tecnico-cell-label" aria-hidden="true">Estado</span><EstadoBadge estado={d.estado} />{d.borrador && <p className="mt-2 text-xs text-indigo-700">Borrador guardado</p>}</td>
        <td className="p-4 text-xs"><span className="tecnico-cell-label" aria-hidden="true">Fechas</span><p>{readOnly ? 'Informe completado: ' + fecha(d.fecha_completado) : 'Asignado: ' + fecha(d.fecha_asignacion)}</p>{d.fecha_inicio && <p className="mt-1">Inicio: {fecha(d.fecha_inicio)}</p>}</td>
        <td className="p-4"><span className="tecnico-cell-label" aria-hidden="true">Acciones</span><div className="flex flex-col items-start gap-2">
          <button type="button" onClick={() => onOpenDetalle?.(d)} className="rounded border px-3 py-2 text-xs">Ver expediente</button>
          {!readOnly && !d.fecha_inicio ? <button disabled={loading} onClick={() => onIniciarDiagnostico(d)} className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Iniciar diagnóstico</button>
            : <button onClick={() => onOpenDiagnostico({ ...d, readOnly })} className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">{readOnly ? 'Ver informe' : d.borrador ? 'Continuar informe' : 'Registrar informe'}</button>}
          {readOnly && <ReaperturaDiagnostico diagnostico={d} loading={loading} onReopen={onReopen} onAclarar={(diagnostico) => onOpenDetalle?.(diagnostico, 'aclarar')} />}
        </div></td>
      </tr>)}{!loading && !items.length && <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">No hay diagnósticos que coincidan con los filtros.</td></tr>}</tbody>
    </table>
  </div>;
}
