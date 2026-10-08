import { useEffect, useState } from 'react';
import api from '../../../services/api';

export default function TrazabilidadPage() {
  const [rows, setRows] = useState([]);
  const [lots, setLots] = useState({});
  const [selected, setSelected] = useState({});
  const [estado, setEstado] = useState('PENDIENTE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async (filter = estado) => { const { data } = await api.get('/bodega/trazabilidad/solicitudes', { params: { estado: filter } }); setRows(data.data || []); };
  useEffect(() => { load('PENDIENTE').catch(() => setError('No se pudieron cargar las solicitudes.')); }, []);
  const loadLots = async (id) => {
    setError('');
    try { const { data } = await api.get('/bodega/trazabilidad/lotes', { params: { repuesto_id: id } }); setLots((old) => ({ ...old, [id]: data.data || [] })); }
    catch (err) { setError(err.response?.data?.error || 'No se pudieron consultar las compras.'); }
  };
  const deliver = async (row) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await api.patch(`/bodega/trazabilidad/solicitudes/${row.id_detalle_repuesto}/entregar`, { compra_id: Number(selected[row.id_detalle_repuesto]) });
      await load(); setMessage(`Pieza de la solicitud #${row.id_detalle_repuesto} entregada con su compra de origen.`);
    } catch (err) { setError(err.response?.data?.error || 'No se pudo registrar la entrega.'); }
    finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-5xl space-y-5 p-4">
    <header><h1 className="text-2xl font-bold">Entrega y origen de repuestos</h1><p className="text-sm text-slate-600">Vincule cada pieza aprobada con la compra y el proveedor antes de entregarla al taller. Las entregas anteriores sin compra identificada siguen visibles como históricas.</p></header>
    {message && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <label className="text-sm">Ver solicitudes<select value={estado} onChange={(e) => { setEstado(e.target.value); load(e.target.value).catch(() => setError('No se pudieron cargar las solicitudes.')); }} className="ml-2 rounded border p-2"><option value="PENDIENTE">Por entregar</option><option value="ENTREGADO">Entregadas</option><option value="TODOS">Todas</option></select></label>
    {rows.length === 0 && <p>No hay solicitudes en este estado.</p>}
    <div className="grid gap-4">{rows.map((row) => {
      const partLots = lots[row.repuesto_id] || [];
      const equipo = row.orden?.diagnostico?.equipo;
      return <article key={row.id_detalle_repuesto} className="rounded-xl border bg-white p-4">
        <h2 className="font-bold">Solicitud #{row.id_detalle_repuesto} · Orden #{row.orden_id}</h2>
        <p className="text-sm">{row.cantidad_usada} × {row.repuesto?.nombre || row.pieza_solicitada} · {[equipo?.tipo, equipo?.marca, equipo?.modelo].filter(Boolean).join(' ')}</p>
        <p className="text-sm">Estado: {row.estado_entrega}{row.compra ? ` · Compra #${row.compra.id_compra} · ${row.compra.proveedor?.nombre || 'Proveedor'}` : row.estado_entrega === 'ENTREGADO' ? ' · Compra no identificada (histórico)' : ''}</p>
        {row.estado_entrega === 'PENDIENTE' && <div className="mt-3 flex flex-wrap items-end gap-2"><button type="button" onClick={() => loadLots(row.repuesto_id)} className="rounded border px-3 py-2 text-sm">Consultar compras</button>{partLots.length > 0 && <label className="text-sm">Compra de origen<select value={selected[row.id_detalle_repuesto] || ''} onChange={(e) => setSelected((old) => ({ ...old, [row.id_detalle_repuesto]: e.target.value }))} className="mt-1 block rounded border p-2"><option value="">Seleccione</option>{partLots.filter((lot) => lot.disponibles_identificadas >= Number(row.cantidad_usada || 0)).map((lot) => <option key={lot.id_compra} value={lot.id_compra}>#{lot.id_compra} · {lot.proveedor || 'Proveedor'} · {lot.documento || 'Sin documento'} · {lot.disponibles_identificadas} unidades</option>)}</select></label>}{partLots.length > 0 && <button type="button" disabled={busy || !selected[row.id_detalle_repuesto]} onClick={() => deliver(row)} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Entregar pieza</button>}</div>}
      </article>;
    })}</div>
  </section>;
}
