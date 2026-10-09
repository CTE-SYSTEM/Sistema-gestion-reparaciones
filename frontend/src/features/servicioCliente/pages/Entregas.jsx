import { useState } from 'react';
import { Search, Truck } from 'lucide-react';
import { getFacturas } from '../../contabilidad/services/facturasService';
import { registrarEntregaOrden } from '../services/ordenesService';
import FotosServicio from '../../shared/components/FotosServicio';
import api from '../../../services/api';
import PageHelp from '../../../components/PageHelp';
import { useInfiniteAreaList } from '../../shared/hooks/useInfiniteAreaList';

export default function Entregas() {
  const [estado, setEstado] = useState('pendientes');
  const [selected, setSelected] = useState(null);
  const [saldo, setSaldo] = useState(null);
  const [persona, setPersona] = useState('');
  const [observacion, setObservacion] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const facturasQuery = useInfiniteAreaList({
    queryKey: ['servicio-cliente', 'entregas'],
    queryFn: getFacturas,
    search,
    extraParams: { entregaEstado: estado },
    pageSize: 20,
  });
  const selectFactura = async (factura) => {
    setSelected(factura); setSaldo(null); setError('');
    try { const { data } = await api.get(`/facturas/${factura.id_factura}/saldo`); setSaldo(data.data); }
    catch (e) { setError(e.response?.data?.error || 'No se pudo consultar el saldo.'); }
  };

  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage(''); setSaving(true);
    try {
      await registrarEntregaOrden(selected.orden_id, { persona_recibe: persona.trim(), observacion_entrega: observacion.trim() });
      setSelected(null); setSaldo(null); setPersona(''); setObservacion('');
      await facturasQuery.refetch(); setMessage('Entrega registrada correctamente.');
    } catch (e) { setError(e.response?.data?.error || 'No se pudo registrar la entrega.'); }
    finally { setSaving(false); }
  };

  return <section className="mx-auto max-w-6xl space-y-5 p-4">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4"><div><div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-600"><Truck size={15} /> Servicio al cliente</div><h1 className="text-2xl font-bold text-slate-900">Entrega de equipos</h1><p className="mt-1 text-sm text-slate-600">Consulta las entregas pendientes y las ya registradas. Verifica calidad y pago antes de entregar.</p></div><PageHelp compact /></header>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {message && <p role="status" className="text-green-700">{message}</p>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="Estado de entregas">{[['pendientes', 'Pendientes'], ['entregadas', 'Entregadas']].map(([value, label]) => <button key={value} type="button" onClick={() => { setEstado(value); setSelected(null); setSaldo(null); }} aria-pressed={estado === value} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${estado === value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'}`}>{label}</button>)}</div>
    <label className="relative block max-w-xl"><span className="sr-only">Buscar entregas</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" placeholder="Buscar factura, orden, cliente o equipo..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
    {facturasQuery.isPending && <p role="status" className="text-sm text-slate-500">Cargando entregas…</p>}
    {facturasQuery.isError && <p role="alert" className="text-sm text-red-700">No se pudieron cargar las entregas.</p>}
    {!facturasQuery.isPending && !facturasQuery.isError && !facturasQuery.rows.length && <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">No hay entregas {estado === 'pendientes' ? 'pendientes' : 'registradas'} para esta búsqueda.</p>}
    <div className="grid gap-3">{facturasQuery.rows.map((f) => <article key={f.id_factura} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Orden #{f.orden_id} · Factura #{f.id_factura}</h2><p className="mt-1 text-sm text-slate-600">{f.orden?.diagnostico?.equipo?.cliente?.nombre || 'Cliente sin nombre'} · {[f.orden?.diagnostico?.equipo?.tipo, f.orden?.diagnostico?.equipo?.marca, f.orden?.diagnostico?.equipo?.modelo].filter(Boolean).join(' ') || 'Equipo sin detalle'}</p><p className="mt-1 text-xs text-slate-500">Calidad: {f.orden?.calidad_estado?.replaceAll('_', ' ') || 'sin registro'}{f.orden?.fecha_entrega ? ` · Entrega: ${new Date(f.orden.fecha_entrega).toLocaleDateString('es-NI')}` : ''}</p></div>{estado === 'pendientes' && <button type="button" onClick={() => selectFactura(f)} className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Registrar entrega</button>}</div></article>)}</div>
    {facturasQuery.hasNextPage && <div className="text-center"><button type="button" disabled={facturasQuery.isFetchingNextPage} onClick={() => facturasQuery.fetchNextPage()} className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50">{facturasQuery.isFetchingNextPage ? 'Cargando…' : 'Cargar 20 entregas más'}</button></div>}
    {selected && <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Entrega de orden #{selected.orden_id}</h2><button type="button" onClick={() => setSelected(null)} className="text-sm text-slate-600 underline">Cerrar</button></div>
      <p className="text-sm">Calidad: {selected.orden?.calidad_estado || 'sin registro'} · Pago: {saldo ? Number(saldo.pendiente) > 0 ? `pendiente C$ ${Number(saldo.pendiente).toFixed(2)}` : 'completo' : 'consultando…'}</p>
      <FotosServicio kind="ordenes" id={selected.orden_id} tipoInicial="FOTO_ENTREGA" allowedTypes={['FOTO_ENTREGA']} />
      <label className="block text-sm">Persona que recibe<input required value={persona} onChange={(e) => setPersona(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
      <label className="block text-sm">Observación<textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
      <p className="text-xs text-slate-600">Guarda la foto antes de confirmar. El sistema exige una foto de entrega.</p>
      <button disabled={saving || !saldo || Number(saldo.pendiente) > 0 || (selected.orden?.estado === 'FINALIZADO' && !['APROBADO', 'NO_REQUERIDO'].includes(selected.orden?.calidad_estado))} className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Confirmar entrega'}</button>
    </form>}
  </section>;
}
