import React from 'react';

export default function HistorialEstados({ rows = [] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-left">
      <h4 className="mb-2 text-sm font-bold">Historial de estados</h4>
      {rows.length === 0 ? <p className="text-xs text-slate-500">Aún no hay cambios registrados.</p> : (
        <ol className="space-y-2 text-xs">{rows.map((row) => (
          <li key={row.id_historial} className="border-l-2 border-indigo-300 pl-2">
            <span className="font-semibold">{row.proceso ? `${row.proceso}: ` : ''}{row.estado_anterior || 'Inicio'} → {row.estado_nuevo}</span>
            <span className="ml-2 text-slate-500">{new Date(row.fecha_hora).toLocaleString('es-NI', { timeZone: 'America/Managua' })}</span>
            <span className="ml-2 text-slate-600">{row.usuario?.nombre_usuario || 'Usuario no identificado'}</span>
            {row.observacion && <p className="mt-1 text-slate-600">{row.observacion}</p>}
          </li>
        ))}</ol>
      )}
    </div>
  );
}
