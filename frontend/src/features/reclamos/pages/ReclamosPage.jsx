import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import { analizarReclamo, cerrarReclamo, crearReclamo, decidirCobertura, getReclamos } from '../services/reclamosService';

const fecha = (value) => value ? new Date(value).toLocaleDateString('es-NI') : 'Sin fecha';
const errorText = (error) => error.response?.data?.error || 'No se pudo guardar. Revise los datos e intente de nuevo.';

export default function ReclamosPage() {
  const { user } = useContext(AuthContext);
  const role = String(user?.rol || '').toLowerCase();
  const admin = ['administrador', 'admin_pro', 'admin'].includes(role);
  const canCreate = admin || ['recepcion', 'secretaria', 'reclamos'].includes(role);
  const canAnalyze = admin || ['reclamos', 'secretaria'].includes(role);
  const canDecide = admin || ['garantias', 'secretaria'].includes(role);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState({});
  const [newClaim, setNewClaim] = useState({ orden_original_id: '', descripcion: '' });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async (query = search) => {
    const response = await getReclamos({ pageSize: 100, search: query });
    setRows(response.data.data || []);
  };
  useEffect(() => {
    let active = true;
    getReclamos({ pageSize: 100 }).then(({ data }) => { if (active) setRows(data.data || []); })
      .catch(() => { if (active) setError('No se pudieron cargar los reclamos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const draft = (id) => drafts[id] || {};
  const setDraft = (id, field, value) => setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  const run = async (action, success) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await load(); setMessage(success); }
    catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  };

  return <section className="mx-auto max-w-6xl space-y-5 p-4">
    <header><h1 className="text-2xl font-bold">Reclamos</h1><p className="text-sm text-slate-600">Cada expediente conserva la orden original, el equipo, las piezas utilizadas y la decisión sobre garantía.</p></header>
    {message && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {canCreate && <form onSubmit={(event) => { event.preventDefault(); run(async () => { await crearReclamo({ ...newClaim, orden_original_id: Number(newClaim.orden_original_id) }); setNewClaim({ orden_original_id: '', descripcion: '' }); }, 'Reclamo abierto y enviado a análisis.'); }} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[180px_1fr_auto]">
      <label className="text-sm">Orden entregada<input required type="number" min="1" value={newClaim.orden_original_id} onChange={(e) => setNewClaim({ ...newClaim, orden_original_id: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm">Problema comunicado por el cliente<textarea required minLength={10} maxLength={4000} value={newClaim.descripcion} onChange={(e) => setNewClaim({ ...newClaim, descripcion: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
      <button disabled={busy} className="self-end rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Abrir reclamo</button>
    </form>}
    <form onSubmit={(e) => { e.preventDefault(); run(() => load(search), 'Resultados actualizados.'); }} className="flex gap-2"><input type="search" aria-label="Buscar reclamos" placeholder="Reclamo, orden, cliente o problema" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1 rounded border p-2" /><button className="rounded border px-4 py-2">Buscar</button></form>
    {loading && <p>Cargando reclamos…</p>}
    {!loading && rows.length === 0 && <p>No hay reclamos en esta búsqueda.</p>}
    <div className="space-y-4">{rows.map((row) => {
      const equipo = row.orden_original?.diagnostico?.equipo;
      const garantiaVigente = row.garantia?.fecha_inicio && row.garantia?.fecha_vencimiento && new Date() >= new Date(row.garantia.fecha_inicio) && new Date() <= new Date(row.garantia.fecha_vencimiento);
      const comprasDePiezas = (row.orden_original?.repuestos_usados || []).filter((pieza) => pieza.compra_id && pieza.estado_entrega === 'ENTREGADO');
      return <article key={row.id_reclamo} className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Reclamo #{row.id_reclamo} · Orden original #{row.orden_original_id}</h2><span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold">{row.estado.replaceAll('_', ' ')} · cobertura {row.cobertura.toLowerCase()}</span></div>
        <p className="text-sm">{equipo?.cliente?.nombre || 'Cliente'} · {[equipo?.tipo, equipo?.marca, equipo?.modelo].filter(Boolean).join(' ')} · Serie {equipo?.numero_serie || 'sin registrar'}</p>
        <p className="mt-2 text-sm"><strong>Problema:</strong> {row.descripcion}</p>
        <p className="text-sm"><strong>Garantía:</strong> {row.garantia ? `${garantiaVigente ? 'Vigente' : 'No vigente'} hasta ${fecha(row.garantia.fecha_vencimiento)}` : 'No registrada'}</p>
        {row.orden_original?.repuestos_usados?.length > 0 && <p className="text-sm"><strong>Piezas originales:</strong> {row.orden_original.repuestos_usados.map((p) => `${p.repuesto?.nombre || p.pieza_solicitada || 'Pieza'}${p.compra?.proveedor?.nombre ? ` (${p.compra.proveedor.nombre})` : ''}`).join(', ')}</p>}
        {row.analisis && <p className="mt-2 text-sm"><strong>Análisis:</strong> {row.analisis} · Responsable: {row.responsable_tipo || 'sin determinar'}{row.compra?.proveedor?.nombre ? ` · Proveedor: ${row.compra.proveedor.nombre}` : ''}</p>}
        {row.motivo_cobertura && <p className="text-sm"><strong>Decisión:</strong> {row.motivo_cobertura}</p>}
        {row.orden_reingreso_id && <p className="font-semibold text-indigo-700">Orden nueva de garantía #{row.orden_reingreso_id} · {row.orden_reingreso?.estado}</p>}
        {row.resolucion && <p className="text-sm"><strong>Resolución final:</strong> {row.resolucion}</p>}
        {canAnalyze && row.cobertura === 'PENDIENTE' && row.estado !== 'CERRADO' && <form onSubmit={(e) => { e.preventDefault(); run(() => analizarReclamo(row.id_reclamo, { ...draft(row.id_reclamo), compra_id: draft(row.id_reclamo).responsable_tipo === 'PROVEEDOR' ? Number(draft(row.id_reclamo).compra_id) : null }), 'Análisis registrado.'); }} className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
          <label className="text-sm">Origen del problema<select required value={draft(row.id_reclamo).responsable_tipo || ''} onChange={(e) => setDraft(row.id_reclamo, 'responsable_tipo', e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Seleccione</option>{['TECNICO', 'CLIENTE', 'PROVEEDOR', 'EMPRESA', 'INDETERMINADO'].map((v) => <option key={v} value={v} disabled={v === 'PROVEEDOR' && !comprasDePiezas.length}>{v}</option>)}</select></label>
          {draft(row.id_reclamo).responsable_tipo === 'PROVEEDOR' && <label className="text-sm">Compra de la pieza<select required value={draft(row.id_reclamo).compra_id || ''} onChange={(e) => setDraft(row.id_reclamo, 'compra_id', e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Seleccione</option>{comprasDePiezas.map((pieza) => <option key={pieza.id_detalle_repuesto} value={pieza.compra_id}>#{pieza.compra_id} · {pieza.repuesto?.nombre || pieza.pieza_solicitada || 'Pieza'} · {pieza.compra?.proveedor?.nombre || 'Proveedor'}</option>)}</select></label>}
          <label className="text-sm">Costo estimado<input type="number" min="0" step="0.01" value={draft(row.id_reclamo).costo_estimado || ''} onChange={(e) => setDraft(row.id_reclamo, 'costo_estimado', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
          <label className="text-sm sm:col-span-2">Evidencia y análisis<textarea required minLength={10} maxLength={4000} value={draft(row.id_reclamo).analisis || ''} onChange={(e) => setDraft(row.id_reclamo, 'analisis', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
          <button disabled={busy} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">Guardar análisis</button>
        </form>}
        {canDecide && row.estado === 'ANALIZADO' && row.cobertura === 'PENDIENTE' && <form onSubmit={(e) => { e.preventDefault(); run(() => decidirCobertura(row.id_reclamo, { decision: draft(row.id_reclamo).decision, motivo: draft(row.id_reclamo).motivo }), 'Decisión registrada.'); }} className="mt-4 grid gap-2 rounded-lg bg-indigo-50 p-3 sm:grid-cols-2">
          <label className="text-sm">Cobertura<select required value={draft(row.id_reclamo).decision || ''} onChange={(e) => setDraft(row.id_reclamo, 'decision', e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Seleccione</option><option value="APROBADA" disabled={!garantiaVigente}>Aprobar y crear orden de reingreso</option><option value="RECHAZADA">Rechazar cobertura</option></select></label>
          <label className="text-sm sm:col-span-2">Motivo de la decisión<textarea required minLength={10} maxLength={4000} value={draft(row.id_reclamo).motivo || ''} onChange={(e) => setDraft(row.id_reclamo, 'motivo', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
          <button disabled={busy} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">Registrar decisión</button>
        </form>}
        {canAnalyze && ['RESUELTO', 'EN_REINGRESO'].includes(row.estado) && <form onSubmit={(e) => { e.preventDefault(); run(() => cerrarReclamo(row.id_reclamo, { resolucion: draft(row.id_reclamo).resolucion }), 'Reclamo cerrado.'); }} className="mt-4 flex flex-wrap gap-2"><textarea required minLength={10} maxLength={4000} placeholder="Resolución final y comunicación al cliente" value={draft(row.id_reclamo).resolucion || ''} onChange={(e) => setDraft(row.id_reclamo, 'resolucion', e.target.value)} className="min-w-0 flex-1 rounded border p-2" /><button disabled={busy} className="rounded border px-4 py-2 disabled:opacity-50">Cerrar reclamo</button></form>}
      </article>;
    })}</div>
  </section>;
}
