import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, FileCheck, Search, ShieldCheck } from 'lucide-react';
import api from '../../../services/api';
import { getGarantias } from '../services/garantiasService';
import { useInfiniteAreaList } from '../../shared/hooks/useInfiniteAreaList';

const fecha = (value) => value ? new Date(value).toLocaleDateString('es-NI') : 'Sin fecha';
export default function GarantiasPage() {
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('TODAS');
  const [policy, setPolicy] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const query = useInfiniteAreaList({ queryKey: ['garantias', estado], queryFn: getGarantias, search, extraParams: { estado }, pageSize: 20 });
  const rows = query.rows;
  useEffect(() => {
    let active = true;
    api.get('/garantias/politica').then(({ data }) => { if (active) setPolicy(data.data); }).catch(() => { if (active) setError('No se pudo cargar la cobertura definida.'); });
    return () => { active = false; };
  }, []);
  const setDraft = (id, field, value) => setDrafts((old) => ({ ...old, [id]: { ...old[id], [field]: value } }));
  const revalidar = async (id) => {
    setBusy(true); setError(''); setMessage('');
    try { await api.patch(`/garantias/${id}/revalidar`, { meses: Number(drafts[id]?.meses), motivo: drafts[id]?.motivo }); await query.refetch(); setMessage(`Garantía #${id} revalidada. La extensión y el motivo quedaron auditados.`); }
    catch (err) { setError(err.response?.data?.error || 'No se pudo revalidar la garantía.'); }
    finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
    <header className="sgr-summary-header rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-900 p-6 text-white"><div className="flex items-center gap-3"><ShieldCheck size={28} /><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Postventa</p><h1 className="text-3xl font-black">Inicio de garantías</h1></div></div><p className="mt-2 text-sm text-slate-200">Consulte equipos cubiertos, vencimientos y uso de la garantía en reclamos.</p></header>
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]"><article className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Cobertura definida por el negocio</h2><p className="mt-2 text-sm text-slate-700">{policy?.condiciones || 'Cargando condiciones…'}</p><p className="mt-2 text-xs text-slate-500">Duración inicial: {policy?.meses || '…'} meses. Se prepara al facturar una reparación elegible y su vigencia comienza al entregar el equipo.</p></article><Link to="/garantias/reclamos" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-indigo-900 hover:bg-indigo-100"><FileCheck size={24} /><h2 className="mt-3 font-bold">Usar cobertura en un reclamo</h2><p className="mt-1 text-sm">Revise el caso, decida si procede y genere una orden sin cobro al cliente.</p></Link></div>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4"><label className="min-w-64 flex-1 text-xs font-semibold text-slate-600">Buscar garantía, factura, cliente, marca o modelo<div className="relative mt-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input type="search" placeholder="Escriba nombre, equipo o número…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" /></div></label><label className="text-xs font-semibold text-slate-600">Vigencia<select value={estado} onChange={(e) => setEstado(e.target.value)} className="mt-1 block rounded-lg border bg-white px-3 py-2 text-sm"><option value="TODAS">Todas</option><option value="VIGENTES">Vigentes</option><option value="VENCIDAS">Vencidas</option><option value="PENDIENTES">Pendientes de entrega</option></select></label></div>
    {query.isPending && <p>Cargando garantías…</p>}{query.isError && <p role="alert">No se pudieron cargar las garantías.</p>}
    {!query.isPending && !rows.length && <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">No hay garantías para esta búsqueda.</p>}
    <div className="grid gap-4">{rows.map((g) => {
      const equipo = g.factura?.orden?.diagnostico?.equipo;
      const current = g.fecha_inicio && g.fecha_vencimiento && new Date() >= new Date(g.fecha_inicio) && new Date() <= new Date(g.fecha_vencimiento);
      const draft = drafts[g.id_garantia] || {};
      return <article key={g.id_garantia} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">Garantía #{g.id_garantia} · Factura #{g.factura_id}</h2><p className="text-sm text-slate-600">{equipo?.cliente?.nombre || 'Cliente'} · {[equipo?.tipo, equipo?.marca, equipo?.modelo].filter(Boolean).join(' ') || 'Equipo'} · Serie {equipo?.numero_serie || 'sin registrar'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${current ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{!g.fecha_inicio ? 'Pendiente de entrega' : current ? 'Vigente' : 'Vencida'}</span></div><div className="mt-3 flex flex-wrap gap-4 text-sm"><span><CalendarClock size={16} className="mr-1 inline text-indigo-600" /> Desde {fecha(g.fecha_inicio)} hasta {fecha(g.fecha_vencimiento)}</span><span>{g.reclamos?.length || 0} reclamo(s) vinculado(s)</span><span>{g.reclamos?.filter((r) => r.cobertura === 'APROBADA').length || 0} uso(s) aprobados</span></div><details className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">Revalidar vigencia</summary><div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr_auto]"><label>Meses<input type="number" min="1" max="36" value={draft.meses || ''} onChange={(e) => setDraft(g.id_garantia, 'meses', e.target.value)} className="mt-1 w-full rounded border p-2" /></label><label>Motivo de revalidación<input minLength={10} maxLength={1000} value={draft.motivo || ''} onChange={(e) => setDraft(g.id_garantia, 'motivo', e.target.value)} className="mt-1 w-full rounded border p-2" /></label><button type="button" disabled={busy || !g.fecha_inicio || !draft.meses || (draft.motivo || '').trim().length < 10} onClick={() => revalidar(g.id_garantia)} className="self-end rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Guardar</button></div></details></article>;
    })}</div>
    {query.hasNextPage && <div className="text-center"><button type="button" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50">Cargar 20 garantías más</button></div>}
  </section>;
}
