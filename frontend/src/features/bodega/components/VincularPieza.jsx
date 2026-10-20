import { useEffect, useState } from 'react';
import api from '../../../services/api';

export default function VincularPieza({ row, busy, onLink, onUnlink }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [parts, setParts] = useState([]);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [samePart, setSamePart] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const canKeepApproval = !row.repuesto_id && row.estado_aprobacion === 'APROBADO';
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true); setError('');
    const timer = setTimeout(() => api.get('/repuestos', { params: { search, page: 1, pageSize: 20 } })
      .then(({ data }) => { if (active) setParts(data.data || []); })
      .catch(() => { if (active) setError('No se pudo buscar el catálogo. Cambie la búsqueda para reintentar.'); })
      .finally(() => { if (active) setLoading(false); }), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [open, search]);
  return <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
    <button type="button" disabled={busy} aria-expanded={open} onClick={() => setOpen(!open)} className="text-sm font-semibold text-indigo-800">{open ? 'Cerrar selección de pieza' : row.repuesto_id ? 'Cambiar pieza vinculada' : 'Identificar y vincular pieza'}</button>
    {open && <form className="mt-3 space-y-3" onSubmit={async (event) => {
      event.preventDefault();
      if (await onLink({ repuesto_id: Number(selected), motivo: reason, misma_pieza_confirmada: canKeepApproval && samePart })) setOpen(false);
    }}>
      <p className="text-xs text-indigo-950">Solicitud original: {row.pieza_solicitada || row.repuesto?.nombre} · {row.cantidad_usada} unidad(es). Identificar la misma pieza y cantidad conserva la aprobación; un cambio requiere revisión del jefe.</p>
      <label className="block text-xs font-semibold">Buscar en catálogo<input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setSelected(''); }} placeholder="Nombre o descripción de la pieza" className="mt-1 w-full rounded border p-2 text-sm" /></label>
      {loading && <p role="status" className="text-xs">Buscando…</p>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <label className="block text-xs font-semibold">Pieza identificada<select required value={selected} onChange={(e) => setSelected(e.target.value)} className="mt-1 w-full rounded border bg-white p-2 text-sm"><option value="">Seleccione; refine la búsqueda si no aparece</option>{parts.filter((part) => part.id_repuesto !== row.repuesto_id && part.activo !== false && !part.descontinuada).map((part) => <option key={part.id_repuesto} value={part.id_repuesto}>#{part.id_repuesto} · {part.nombre}{part.stock_actual != null ? ` · stock ${part.stock_actual}` : ''}</option>)}</select></label>
      <label className="block text-xs font-semibold">Motivo o compatibilidad comprobada<textarea required minLength={10} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded border p-2 text-sm" placeholder="Indique por qué esta pieza corresponde al equipo de la orden" /></label>
      {canKeepApproval && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={samePart} onChange={(e) => setSamePart(e.target.checked)} />Confirmo que corresponde exactamente a la pieza, especificaciones y cantidad ya aprobadas. Conservar la aprobación.</label>}
      <button type="submit" disabled={busy || loading || !selected} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : canKeepApproval && samePart ? 'Vincular y conservar aprobación' : 'Vincular y enviar al jefe'}</button>
      {row.repuesto_id && <details className="rounded border border-amber-200 bg-amber-50 p-3 text-sm"><summary className="cursor-pointer font-semibold text-amber-900">Retirar un vínculo incorrecto</summary><p className="mt-2 text-xs">Se conserva la solicitud y su historial. El retiro anula la aprobación y libera la reserva; no elimina la pieza del catálogo.</p><label className="my-3 flex items-start gap-2"><input type="checkbox" checked={confirmRemoval} onChange={(e) => setConfirmRemoval(e.target.checked)} />Confirmo que el vínculo es incorrecto y debe volver a revisión.</label><button type="button" disabled={busy || !confirmRemoval || reason.trim().length < 10} onClick={async () => { if (await onUnlink({ motivo: reason, retiro_confirmado: confirmRemoval })) setOpen(false); }} className="rounded border border-amber-400 px-3 py-2 font-semibold text-amber-900 disabled:opacity-50">Retirar vínculo con el motivo indicado</button></details>}
      <p className="text-xs text-slate-600">Si no existe en el catálogo, regístrela primero en Repuestos. Vincular no confirma su entrega ni crea existencias.</p>
    </form>}
  </div>;
}
