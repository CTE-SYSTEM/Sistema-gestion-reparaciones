import { useContext, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import api from '../../../services/api';
import { AuthContext } from '../../../context/AuthContext';
import PageHelp from '../../../components/PageHelp';
import { useInfiniteAreaList } from '../../shared/hooks/useInfiniteAreaList';
import { analizarReclamo, cerrarReclamo, crearReclamo, decidirCobertura, getReclamos } from '../services/reclamosService';

const fecha = (value) => value ? new Date(value).toLocaleDateString('es-NI') : 'Sin fecha';
const errorText = (error) => error.response?.data?.error || 'No se pudo guardar. Revise los datos e intente de nuevo.';

export default function ReclamosPage() {
  const { user } = useContext(AuthContext);
  const role = String(user?.rol || '').toLowerCase();
  const admin = ['administrador', 'admin_pro', 'admin'].includes(role);
  const canCreate = admin || ['serviciocliente', 'secretaria', 'reclamos'].includes(role);
  const canAnalyze = admin || ['reclamos', 'secretaria'].includes(role);
  const canDecide = admin || ['garantias', 'secretaria'].includes(role);
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState(null);
  const reclamosQuery = useInfiniteAreaList({
    queryKey: ['reclamos'], queryFn: getReclamos, search, pageSize: 20,
  });
  const rows = reclamosQuery.rows;
  const [drafts, setDrafts] = useState({});
  const [newClaim, setNewClaim] = useState({ orden_original_id: '', descripcion: '' });
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [client, setClient] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [candidateOrders, setCandidateOrders] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { api.get('/reclamos/resumen').then(({ data }) => setSummary(data.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (client || !clientSearch.trim()) { setClients([]); setLoadingClients(false); return undefined; }
    let active = true;
    setLoadingClients(true);
    setLookupError('');
    const timer = setTimeout(() => api.get('/reclamos/clientes', { params: { search: clientSearch.trim() } })
      .then(({ data }) => { if (active) setClients(data.data || []); })
      .catch(() => { if (active) { setClients([]); setLookupError('No se pudo buscar clientes. Intente de nuevo.'); } })
      .finally(() => { if (active) setLoadingClients(false); }), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [clientSearch, client]);
  const chooseClient = async (row) => {
    setLookupError(''); setLoadingEquipment(true);
    setClient(row); setEquipment([]); setSelectedEquipment(null); setCandidateOrders([]); setNewClaim((old) => ({ ...old, orden_original_id: '' }));
    try { const { data } = await api.get(`/reclamos/clientes/${row.id_cliente}/equipos`); setEquipment(data.data || []); }
    catch { setLookupError('No se pudieron cargar los equipos del cliente.'); }
    finally { setLoadingEquipment(false); }
  };
  const chooseEquipment = async (row) => {
    setLookupError(''); setLoadingOrders(true);
    setSelectedEquipment(row); setCandidateOrders([]); setNewClaim((old) => ({ ...old, orden_original_id: '' }));
    try { const { data } = await api.get(`/reclamos/equipos/${row.id_equipo}/ordenes`); setCandidateOrders(data.data || []); }
    catch { setLookupError('No se pudo cargar el historial de órdenes del equipo.'); }
    finally { setLoadingOrders(false); }
  };

  const draft = (id) => drafts[id] || {};
  const setDraft = (id, field, value) => setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  const run = async (action, success) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await reclamosQuery.refetch(); api.get('/reclamos/resumen').then(({ data }) => setSummary(data.data)).catch(() => {}); setMessage(success); }
    catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  };

  return <section className="mx-auto max-w-6xl space-y-5 p-4">
    <header className="sgr-summary-header flex flex-wrap items-start justify-between gap-3 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-900 p-6 text-white"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Postventa</p><h1 className="mt-1 text-3xl font-black">Inicio de reclamos</h1><p className="mt-2 text-sm text-slate-200">Atención al cliente abre el caso; aquí se analiza, decide la cobertura y se sigue la reparación.</p></div><PageHelp compact /></header>
    {summary && <div className="grid gap-3 sm:grid-cols-4">{[['Total', summary.total], ['Por analizar o decidir', summary.abiertos], ['En reparación', summary.reingresos], ['Cerrados', summary.cerrados]].map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-4"><p className="text-3xl font-black text-slate-900">{value}</p><p className="text-sm text-slate-600">{label}</p></div>)}</div>}
    {message && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {canCreate && <form onSubmit={(event) => { event.preventDefault(); run(async () => { await crearReclamo({ ...newClaim, orden_original_id: Number(newClaim.orden_original_id) }); setNewClaim({ orden_original_id: '', descripcion: '' }); setClient(null); setSelectedEquipment(null); setEquipment([]); setCandidateOrders([]); setClientSearch(''); }, 'Reclamo abierto y enviado a análisis.'); }} className="space-y-4 rounded-xl border bg-white p-4">
      <h2 className="font-bold">Abrir reclamo</h2>
      <p className="text-sm text-slate-600">Busque al cliente, elija el equipo y confirme la visita a la que corresponde el problema.</p>
      <label className="block text-sm">1. Cliente<input type="search" value={client ? client.nombre : clientSearch} onChange={(e) => { setClient(null); setEquipment([]); setSelectedEquipment(null); setCandidateOrders([]); setClientSearch(e.target.value); setNewClaim((old) => ({ ...old, orden_original_id: '' })); }} placeholder="Busque por nombre o teléfono, desde la primera letra" className="mt-1 w-full rounded border p-2" /></label>
      {!client && loadingClients && <p role="status" className="text-sm text-slate-600">Buscando clientes…</p>}
      {!client && !loadingClients && clientSearch.trim() && !lookupError && clients.length === 0 && <p className="text-sm text-slate-600">No hay clientes con esa búsqueda.</p>}
      {!client && clients.length > 0 && <div className="max-h-40 overflow-auto rounded border">{clients.map((row) => <button key={row.id_cliente} type="button" onClick={() => chooseClient(row)} className="block w-full border-b p-2 text-left text-sm hover:bg-indigo-50">{row.nombre}{row.telefono ? ` · ${row.telefono}` : ''}</button>)}</div>}
      {client && <div><p className="mb-2 text-sm font-semibold">2. Equipo de {client.nombre}</p>{loadingEquipment && <p role="status" className="text-sm text-slate-600">Cargando equipos…</p>}{!loadingEquipment && equipment.length === 0 && !lookupError && <p className="text-sm text-slate-600">Este cliente todavía no tiene equipos registrados.</p>}<div className="flex flex-wrap gap-2">{equipment.map((row) => <button key={row.id_equipo} type="button" onClick={() => chooseEquipment(row)} className={`rounded-lg border px-3 py-2 text-sm ${selectedEquipment?.id_equipo === row.id_equipo ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'bg-white'}`}>{[row.tipo, row.marca, row.modelo].filter(Boolean).join(' ')} · serie {row.numero_serie || 'sin registrar'}</button>)}</div></div>}
      {selectedEquipment && <div><p className="mb-2 text-sm font-semibold">3. Orden de la visita que reclama</p><p className="mb-2 text-xs text-slate-600">La visita más antigua aparece primero. Para abrir el reclamo, la orden debe estar entregada y facturada.</p>{loadingOrders && <p role="status" className="text-sm text-slate-600">Cargando órdenes…</p>}{!loadingOrders && candidateOrders.length === 0 && !lookupError && <p className="text-sm text-slate-600">Este equipo todavía no tiene órdenes.</p>}<div className="grid gap-2">{candidateOrders.map((row, index) => { const openClaim = row.reclamos_originales?.some((claim) => claim.estado !== 'CERRADO'); const eligible = row.estado === 'ENTREGADO' && row.facturas?.length > 0 && !openClaim; const reason = openClaim ? 'Ya tiene un reclamo abierto' : row.estado !== 'ENTREGADO' ? `Aún no se entrega (${row.estado || 'sin estado'})` : !row.facturas?.length ? 'Aún no tiene factura' : ''; const visitDate = row.estado === 'ENTREGADO' ? row.fecha_entrega ? `entregada ${fecha(row.fecha_entrega)}` : 'entregada (fecha sin registrar)' : `ingresó ${fecha(row.fecha_ingreso)}`; return <label key={row.id_orden} className={`flex gap-3 rounded-lg border p-3 text-sm ${eligible ? 'cursor-pointer bg-white' : 'bg-slate-50 opacity-70'}`}><input type="radio" name="orden_original" disabled={!eligible} checked={String(newClaim.orden_original_id) === String(row.id_orden)} onChange={() => setNewClaim((old) => ({ ...old, orden_original_id: row.id_orden }))} /><span><strong>Orden #{row.id_orden}</strong>{index === 0 ? ' · primera visita' : row.es_garantia ? ' · reingreso de garantía' : ''} · {visitDate} · factura #{row.facturas?.[0]?.id_factura || '—'}<span className="block text-slate-600">Falla: {row.diagnostico?.falla_reportada || 'sin detalle'} · {row.resultado_final || 'sin resultado'}{reason ? ` · ${reason}` : ''}</span></span></label>; })}</div></div>}
      {lookupError && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">{lookupError}</p>}
      <label className="block text-sm">Problema comunicado por el cliente<textarea required minLength={10} maxLength={4000} value={newClaim.descripcion} onChange={(e) => setNewClaim({ ...newClaim, descripcion: e.target.value })} className="mt-1 w-full rounded border p-2" /></label>
      <button disabled={busy || !newClaim.orden_original_id} className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Abrir reclamo</button>
    </form>}
    <label className="relative block max-w-xl"><span className="sr-only">Buscar reclamos</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" placeholder="Buscar reclamo, orden, cliente o problema..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
    {reclamosQuery.isPending && <p role="status">Cargando reclamos…</p>}
    {reclamosQuery.isError && <p role="alert" className="text-sm text-red-700">No se pudieron cargar los reclamos.</p>}
    {!reclamosQuery.isPending && !reclamosQuery.isError && rows.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">No hay reclamos en esta búsqueda.</p>}
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
        {row.analisis && <p className="mt-2 text-sm"><strong>Análisis:</strong> {row.analisis} · Costo a cargo de: {row.responsable_tipo || 'sin determinar'}{row.compra?.proveedor?.nombre ? ` · Proveedor: ${row.compra.proveedor.nombre}` : ''}</p>}
        {row.motivo_cobertura && <p className="text-sm"><strong>Decisión:</strong> {row.motivo_cobertura}</p>}
        {row.orden_reingreso_id && <p className="font-semibold text-indigo-700">Orden nueva de garantía #{row.orden_reingreso_id} · {row.orden_reingreso?.estado}</p>}
        {row.resolucion && <p className="text-sm"><strong>Resolución final:</strong> {row.resolucion}</p>}
        {canAnalyze && row.cobertura === 'PENDIENTE' && row.estado !== 'CERRADO' && <form onSubmit={(e) => { e.preventDefault(); run(() => analizarReclamo(row.id_reclamo, { ...draft(row.id_reclamo), compra_id: draft(row.id_reclamo).responsable_tipo === 'PROVEEDOR' ? Number(draft(row.id_reclamo).compra_id) : null }), 'Análisis registrado.'); }} className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
          <label className="text-sm">Quién asume el costo si procede<select required value={draft(row.id_reclamo).responsable_tipo || ''} onChange={(e) => setDraft(row.id_reclamo, 'responsable_tipo', e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Seleccione para este reclamo</option>{['TECNICO', 'CLIENTE', 'PROVEEDOR', 'EMPRESA', 'INDETERMINADO'].map((v) => <option key={v} value={v} disabled={v === 'PROVEEDOR' && !comprasDePiezas.length}>{v}</option>)}</select></label>
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
    {reclamosQuery.hasNextPage && <div className="text-center"><button type="button" disabled={reclamosQuery.isFetchingNextPage} onClick={() => reclamosQuery.fetchNextPage()} className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50">{reclamosQuery.isFetchingNextPage ? 'Cargando…' : 'Cargar 20 reclamos más'}</button></div>}
  </section>;
}
