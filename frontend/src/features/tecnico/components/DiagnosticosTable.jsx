import React from 'react';
import { EstadoBadge, PrioridadBadge } from './TecnicoBadges';
const fecha = (v) => v ? new Date(v).toLocaleString('es-NI', { timeZone: 'America/Managua' }) : 'Sin registro';
export default function DiagnosticosTable({ items, loading, readOnly, onOpenDiagnostico, onIniciarDiagnostico, onOpenDetalle }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white text-slate-900"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4">Trabajo</th><th className="p-4">Equipo y falla</th><th className="p-4">Estado</th><th className="p-4">Fechas</th><th className="p-4">Acciones</th></tr></thead><tbody className="divide-y">{items.map((d) => <tr key={d.id}>
    <td className="p-4"><strong>#{d.id}</strong><div className="mt-2"><PrioridadBadge prioridad={d.prioridad} /></div></td>
    <td className="p-4"><strong>{d.equipo}</strong><p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{d.falla}</p>{!readOnly && d.horas_sin_avance >= 72 && <p className="mt-2 text-xs text-amber-700">72 horas o más sin avance</p>}</td>
    <td className="p-4"><EstadoBadge estado={d.estado} />{d.borrador && <p className="mt-2 text-xs text-indigo-700">Borrador guardado</p>}</td>
    <td className="p-4 text-xs"><p>{readOnly ? 'Completado: ' + fecha(d.fecha_completado) : 'Asignado: ' + fecha(d.fecha_asignacion)}</p>{d.fecha_inicio && <p className="mt-1">Inicio: {fecha(d.fecha_inicio)}</p>}</td>
    <td className="p-4"><div className="flex flex-col items-start gap-2"><button type="button" onClick={() => onOpenDetalle?.(d)} className="rounded border px-3 py-2 text-xs">Ver expediente</button>{!readOnly && !d.fecha_inicio ? <button disabled={loading} onClick={() => onIniciarDiagnostico(d)} className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Iniciar diagnóstico</button> : <button onClick={() => onOpenDiagnostico({ ...d, readOnly })} className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">{readOnly ? 'Ver informe' : d.borrador ? 'Continuar informe' : 'Registrar informe'}</button>}</div></td>
  </tr>)}{!loading && !items.length && <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">No hay diagnósticos que coincidan con los filtros.</td></tr>}</tbody></table></div>;
}
