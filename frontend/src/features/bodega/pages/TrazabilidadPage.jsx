import { useEffect, useState } from 'react';
import { PackageSearch, Search, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';
import { useAreaRefresh } from '../../shared/hooks/useAreaRefresh';
import AreaPagination from '../../shared/components/AreaPagination';
import VincularPieza from '../components/VincularPieza';

const filters = [
  ['ACTIVAS', 'Solicitudes activas'], ['POR_ENTREGAR', 'Aprobadas por entregar'],
  ['POR_APROBAR', 'Pendientes del jefe'], ['SIN_EXISTENCIA', 'Sin existencias / revisar'],
  ['ENTREGADO', 'Entregadas'], ['DENEGADO', 'Rechazadas'], ['TODOS', 'Todas'],
];

export default function TrazabilidadPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, hasMore: false });
  const [lots, setLots] = useState({});
  const [inspected, setInspected] = useState({});
  const [selected, setSelected] = useState({});
  const [notes, setNotes] = useState({});
  const [estado, setEstado] = useState('ACTIVAS');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rowFeedback, setRowFeedback] = useState({});
  const feedback = (id, text, error = false) => setRowFeedback((old) => ({ ...old, [id]: { text, error } }));
  const revision = useAreaRefresh({ enabled: !busy });

  const load = async (filter = estado, term = search, nextPage = page) => {
    const { data } = await api.get('/bodega/trazabilidad/solicitudes', { params: { estado: filter, search: term, page: nextPage, pageSize: 20 } });
    setRows(data.data || []);
    setMeta(data.meta || { page: nextPage, total: 0, hasMore: false });
  };

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      api.get('/bodega/trazabilidad/solicitudes', { params: { estado, search, page, pageSize: 20 } })
        .then(({ data }) => { if (active) { setRows(data.data || []); setMeta(data.meta || { page, total: 0, hasMore: false }); } })
        .catch(() => { if (active) setError('No se pudieron cargar las solicitudes.'); })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [estado, search, page, revision]);

  const loadLots = async (row) => {
    if (!row.repuesto_id) return;
    setBusy(`lotes-${row.id_detalle_repuesto}`); setError('');
    try {
      const { data } = await api.get('/bodega/trazabilidad/lotes', { params: { repuesto_id: row.repuesto_id } });
      const entries = data.data || [];
      const eligible = entries.filter((lot) => lot.disponibles_identificadas >= Number(row.cantidad_usada || 1));
      setLots((old) => ({ ...old, [row.id_detalle_repuesto]: entries }));
      setInspected((old) => ({ ...old, [row.id_detalle_repuesto]: true }));
      setSelected((old) => ({ ...old, [row.id_detalle_repuesto]: eligible.length === 1 ? String(eligible[0].id_compra) : '' }));
    } catch (err) { setError(err.response?.data?.error || 'No se pudieron consultar las compras disponibles.'); }
    finally { setBusy(''); }
  };

  const deliver = async (row, compraId = null) => {
    setBusy(`entrega-${row.id_detalle_repuesto}`); setError(''); setMessage('');
    try {
      await api.patch(`/bodega/trazabilidad/solicitudes/${row.id_detalle_repuesto}/entregar`, compraId ? { compra_id: Number(compraId) } : {});
      await load();
      setMessage(`Se entregaron ${row.cantidad_usada || 1} unidad(es) de ${row.repuesto?.nombre || row.pieza_solicitada} al técnico de la orden #${row.orden_id}.`);
    } catch (err) { setError(err.response?.data?.error || 'No se pudo registrar la entrega.'); }
    finally { setBusy(''); }
  };

  const markMissing = async (row) => {
    setBusy(`faltante-${row.id_detalle_repuesto}`); setError(''); setMessage('');
    try {
      const motivo = notes[row.id_detalle_repuesto]?.trim() || (row.repuesto_id
        ? 'Bodega confirmó que no hay unidades disponibles para esta solicitud'
        : 'La pieza solicitada todavía no está asociada al catálogo de bodega');
      await api.patch(`/bodega/trazabilidad/solicitudes/${row.id_detalle_repuesto}/sin-existencia`, { motivo });
      setRows((old) => old.map((item) => item.id_detalle_repuesto === row.id_detalle_repuesto ? { ...item, estado_entrega: 'SIN_EXISTENCIA' } : item));
      feedback(row.id_detalle_repuesto, 'Faltante guardado. La solicitud queda en espera de abastecimiento; se avisó al técnico y al jefe.');
      setMessage(`Faltante de la orden #${row.orden_id} guardado.`);
      await load().catch(() => feedback(row.id_detalle_repuesto, 'El faltante se guardó. No se pudo actualizar la lista; pulse Actualizar solicitudes.'));
    } catch (err) { const text = err.response?.data?.error || 'No se pudo registrar la falta de existencias.'; setError(text); feedback(row.id_detalle_repuesto, text, true); }
    finally { setBusy(''); }
  };

  const linkPart = async (row, payload, action = 'vincular') => {
    setBusy(`vincular-${row.id_detalle_repuesto}`); setError('');
    try {
      const { data } = await api.patch(`/bodega/trazabilidad/solicitudes/${row.id_detalle_repuesto}/${action}`, payload);
      setLots((old) => ({ ...old, [row.id_detalle_repuesto]: [] }));
      setInspected((old) => ({ ...old, [row.id_detalle_repuesto]: false }));
      setSelected((old) => ({ ...old, [row.id_detalle_repuesto]: '' }));
      setRows((old) => old.map((item) => item.id_detalle_repuesto === row.id_detalle_repuesto ? { ...item, ...data.data, orden: item.orden } : item));
      feedback(row.id_detalle_repuesto, action === 'desvincular' ? 'Vínculo retirado; solicitud e historial conservados. Quedó pendiente de identificar y aprobar.' : data.data.estado_aprobacion === 'APROBADO' ? `Pieza identificada; se conserva la aprobación original. ${data.data.estado_entrega === 'SIN_EXISTENCIA' ? 'Quedó en espera de abastecimiento.' : 'Puede continuar con la entrega.'}` : 'Pieza vinculada. Pendiente de revisión y aprobación del jefe antes de la entrega.');
      await load().catch(() => setMessage('La vinculación se guardó. Actualice la lista para ver la pieza seleccionada.'));
      return true;
    } catch (err) { feedback(row.id_detalle_repuesto, err.response?.data?.error || 'No se pudo vincular la pieza.', true); return false; }
    finally { setBusy(''); }
  };

  const review = async (row) => {
    setBusy(`revisar-${row.id_detalle_repuesto}`); setError(''); setMessage('');
    try {
      await api.patch(`/bodega/trazabilidad/solicitudes/${row.id_detalle_repuesto}/revisar-disponibilidad`);
      await load();
      setMessage(`La solicitud #${row.id_detalle_repuesto} volvió a la lista de piezas por entregar.`);
    } catch (err) { setError(err.response?.data?.error || 'La pieza todavía no está lista para entregar.'); }
    finally { setBusy(''); }
  };

  return <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
    <header className="rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-900 p-6 text-white">
      <div className="flex items-center gap-3"><Truck size={28} /><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Bodega</p><h1 className="text-3xl font-bold text-white">Entrega de piezas</h1></div></div>
      <p className="mt-2 text-sm text-slate-200">El técnico solicita la pieza, el jefe la aprueba y Bodega registra la entrega física. Las piezas faltantes quedan visibles para revisión.</p>
      <Link to="/bodega/inventario" className="mt-3 inline-flex rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/25">Revisar inventario disponible</Link>
    </header>
    {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4 shadow-sm">
      <label className="min-w-64 flex-1 text-xs font-semibold text-slate-600">Buscar por orden, equipo, serie, cliente o pieza<div className="relative mt-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Número de orden, modelo, serie o pieza..." className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" /></div></label>
      <label className="text-xs font-semibold text-slate-600">Estado<select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }} className="mt-1 block rounded-lg border bg-white px-3 py-2 text-sm">{filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <div className="flex items-center justify-between text-sm text-slate-600"><span>{meta.total} solicitudes · Página {meta.page} de {Math.max(1, Math.ceil((meta.total || 0) / (meta.pageSize || 20)))}</span>{loading && <span>Cargando…</span>}<button type="button" disabled={loading || Boolean(busy)} onClick={() => load().catch(() => setError('No se pudo actualizar. Intente de nuevo.'))} className="rounded border px-3 py-2 disabled:opacity-50">Actualizar solicitudes</button></div>
    {!loading && rows.length === 0 && <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">No hay solicitudes para esta búsqueda.</div>}
    <div className="grid gap-4">{rows.map((row) => {
      const id = row.id_detalle_repuesto;
      const quantity = Number(row.cantidad_usada || 1);
      const approved = row.estado_aprobacion === 'APROBADO';
      const pending = row.estado_entrega === 'PENDIENTE';
      const missing = row.estado_entrega === 'SIN_EXISTENCIA';
      const enough = Number(row.disponible_para_solicitud || 0) >= quantity;
      const partLots = lots[id] || [];
      const eligible = partLots.filter((lot) => lot.disponibles_identificadas >= quantity);
      const checked = Boolean(inspected[id]);
      const equipo = row.orden?.diagnostico?.equipo;
      const label = row.estado_entrega === 'ENTREGADO' ? 'Entregada' : row.estado_aprobacion === 'DENEGADO' ? 'Rechazada' : !row.repuesto_id ? 'Pendiente de identificar y vincular' : missing ? 'En espera de abastecimiento' : approved ? 'Aprobada · por entregar' : 'Pendiente del jefe';
      return <article data-keyboard-form key={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><PackageSearch className="h-5 w-5 text-indigo-600" /><h2 className="font-bold text-slate-900">Orden #{row.orden_id} · {row.repuesto?.nombre || row.pieza_solicitada || 'Pieza por identificar'}</h2></div><p className="mt-1 text-sm text-slate-500">Solicitud #{id} · {quantity} unidad(es)</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${row.estado_entrega === 'ENTREGADO' ? 'bg-emerald-100 text-emerald-800' : missing ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{label}</span></div>
        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
          <div><span className="block text-xs text-slate-500">Equipo destino</span><strong>{[equipo?.tipo, equipo?.marca, equipo?.modelo].filter(Boolean).join(' ') || 'Sin descripción'}</strong><span className="block text-xs">Serie: {equipo?.numero_serie || 'Sin registrar'}</span></div>
          <div><span className="block text-xs text-slate-500">Cliente</span><strong>{equipo?.cliente?.nombre || 'Sin registrar'}</strong></div>
          <div><span className="block text-xs text-slate-500">Técnico solicitante</span><strong>{row.tecnico_solicitante?.nombre || row.orden?.tecnico?.nombre || 'Sin asignar'}</strong><span className="block text-xs">{row.fecha_solicitud ? new Date(row.fecha_solicitud).toLocaleDateString('es-NI') : ''}</span></div>
          <div><span className="block text-xs text-slate-500">Stock físico registrado</span><strong>{row.repuesto?.stock_actual ?? 'Sin pieza vinculada'}</strong><span className="block text-xs">Disponible para esta solicitud: {row.disponible_para_solicitud ?? 'Por identificar'}</span></div>
          <div><span className="block text-xs text-slate-500">Compra de origen</span><strong>{row.compra ? `#${row.compra.id_compra}` : 'Sin asignar'}</strong><span className="block text-xs">{row.compra?.proveedor?.nombre || ''}</span></div>
          <div><span className="block text-xs text-slate-500">Entrega registrada por</span><strong>{row.usuario_entregador?.nombre_persona || row.usuario_entregador?.nombre_usuario || 'Pendiente'}</strong><span className="block text-xs">{row.fecha_entrega ? new Date(row.fecha_entrega).toLocaleDateString('es-NI') : ''}</span></div>
        </div>
        {missing && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><p>Esta solicitud está en la lista de piezas faltantes para revisar.</p>{!row.repuesto_id && <p>Registre la pieza en el catálogo y pida al jefe técnico que la vincule y apruebe.</p>}{row.repuesto_id && !approved && <p>El jefe técnico debe aprobar la pieza antes de entregarla.</p>}{row.repuesto_id && approved && enough && <button type="button" disabled={Boolean(busy)} onClick={() => review(row)} className="mt-2 rounded-lg bg-white px-3 py-2 font-semibold text-red-800 disabled:opacity-50">Volver a comprobar disponibilidad</button>}<div className="mt-2 flex gap-3"><Link className="font-semibold underline" to="/bodega/repuestos">Revisar catálogo</Link><Link className="font-semibold underline" to="/bodega/compras">Revisar compras</Link></div></div>}
        {pending && !approved && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{row.repuesto_id ? 'El jefe técnico todavía debe aprobar esta solicitud.' : 'La pieza aún no está vinculada al catálogo. Regístrela en Bodega para que el jefe técnico pueda asociarla y aprobarla.'}</p>}
        {pending && approved && !row.repuesto_id && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">La pieza ya está aprobada, pero falta vincularla al catálogo. Si confirma que es exactamente la misma pieza y cantidad, se conserva la aprobación. Un cambio requiere revisión del jefe.</p>}
        {pending && approved && row.repuesto_id && !enough && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No hay suficientes unidades disponibles para esta solicitud. Registre el faltante o revise una compra nueva.</p>}
        {pending && approved && row.repuesto_id && enough && <div className="mt-4 space-y-3">
          <button type="button" disabled={Boolean(busy)} onClick={() => loadLots(row)} className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{busy === `lotes-${id}` ? 'Consultando…' : checked ? 'Actualizar compras disponibles' : 'Revisar origen y entregar'}</button>
          {checked && eligible.length > 0 && <div className="flex flex-wrap items-end gap-3"><label className="min-w-64 flex-1 text-xs font-medium text-slate-600">Compra de origen<select value={selected[id] || ''} onChange={(e) => setSelected((old) => ({ ...old, [id]: e.target.value }))} className="mt-1 block w-full rounded-lg border p-2 text-sm"><option value="">Seleccione la compra</option>{eligible.map((lot) => <option key={lot.id_compra} value={lot.id_compra}>#{lot.id_compra} · {lot.proveedor || 'Proveedor'} · {lot.documento || 'Sin documento'} · {lot.disponibles_identificadas} disponibles</option>)}</select></label><button type="button" disabled={Boolean(busy) || !selected[id]} onClick={() => deliver(row, selected[id])} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirmar entrega al técnico</button></div>}
          {checked && partLots.length === 0 && <div className="rounded-lg bg-slate-50 p-3 text-sm"><p>Hay stock físico registrado, pero no una compra de origen asociada a este repuesto.</p><button type="button" disabled={Boolean(busy)} onClick={() => deliver(row)} className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Entregar desde stock existente</button></div>}
          {checked && partLots.length > 0 && eligible.length === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Ninguna compra tiene {quantity} unidad(es) sin asignar. Revise el inventario o registre un faltante.</p>}
        </div>}
        <details className="mt-4 rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-semibold text-slate-700">Leer orden #{row.orden_id} y solicitud</summary><p className="mt-2">Estado: {row.orden?.estado?.replaceAll('_', ' ')} · Trabajo solicitado: {row.orden?.diagnostico?.falla_reportada || 'Sin detalle'}</p><p className="mt-1">Diagnóstico: {row.orden?.diagnostico?.diagnostico_real || 'Sin informe'}</p><p className="mt-1">Pieza pedida: {row.pieza_solicitada || row.repuesto?.nombre}</p></details>
        {['PENDIENTE', 'APROBADO'].includes(row.estado_aprobacion) && row.estado_entrega !== 'ENTREGADO' && <VincularPieza row={row} busy={Boolean(busy)} onLink={(payload) => linkPart(row, payload)} onUnlink={(payload) => linkPart(row, payload, 'desvincular')} />}
        {pending && row.repuesto_id && <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4"><label className="min-w-64 flex-1 text-xs font-medium text-slate-600">Observación del faltante (opcional)<input value={notes[id] || ''} maxLength={500} onChange={(e) => setNotes((old) => ({ ...old, [id]: e.target.value }))} placeholder="Ej.: no se encontró la pieza en bodega" className="mt-1 w-full rounded-lg border p-2 text-sm" /></label><button type="button" disabled={Boolean(busy)} onClick={() => markMissing(row)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50">{busy === `faltante-${id}` ? 'Guardando faltante…' : 'Registrar sin existencias'}</button></div>}
        {rowFeedback[id] && <p role={rowFeedback[id].error ? 'alert' : 'status'} className={`mt-3 rounded-lg border p-3 text-sm ${rowFeedback[id].error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{rowFeedback[id].text}</p>}
      </article>;
    })}</div>
    <AreaPagination label="Paginación de solicitudes de piezas" page={page} onPageChange={setPage} meta={{ ...meta, pageSize: 20 }} loading={loading || Boolean(busy)} />
  </section>;
}
