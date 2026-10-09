import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';

const blank = { compra_id: '', cantidad: 1, origen: 'BODEGA', reclamo_id: '', motivo: '' };

export default function Inventario() {
  const [rows, setRows] = useState([]);
  const [returns, setReturns] = useState([]);
  const [meta, setMeta] = useState({ total: 0, hasMore: false });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [lots, setLots] = useState([]);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const [inventory, defects] = await Promise.all([
      api.get('/bodega/inventario', { params: { page, pageSize: 20, search } }),
      api.get('/bodega/inventario/devoluciones', { params: { pageSize: 20 } }),
    ]);
    setRows(inventory.data.data || []);
    setMeta(inventory.data.meta || { total: 0, hasMore: false });
    setReturns(defects.data.data || []);
  };
  useEffect(() => { const timer = setTimeout(() => { load().catch(() => setError('No se pudo consultar el inventario.')); }, search ? 250 : 0); return () => clearTimeout(timer); }, [page, search]);
  const selectPart = async (part) => {
    setSelected(part); setLots([]); setForm(blank); setError('');
    try { const { data } = await api.get('/bodega/trazabilidad/lotes', { params: { repuesto_id: part.id_repuesto } }); setLots(data.data || []); }
    catch { setError('No se pudieron consultar las compras de esta pieza.'); }
  };
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await api.post('/bodega/inventario/devoluciones', { ...form, compra_id: Number(form.compra_id), cantidad: Number(form.cantidad), reclamo_id: form.origen === 'RECLAMO' ? Number(form.reclamo_id) : null });
      setSelected(null); setForm(blank); await load(); setMessage('Pieza defectuosa apartada y vinculada a su compra de origen.');
    } catch (err) { setError(err.response?.data?.error || 'No se pudo registrar la pieza defectuosa.'); }
    finally { setBusy(false); }
  };
  const returnToSupplier = async (id) => {
    setBusy(true); setError(''); setMessage('');
    try { await api.patch(`/bodega/inventario/devoluciones/${id}/devolver`); await load(); setMessage('Devolución al proveedor registrada.'); }
    catch (err) { setError(err.response?.data?.error || 'No se pudo registrar la devolución.'); }
    finally { setBusy(false); }
  };
  const change = (key, value) => setForm((old) => ({ ...old, [key]: value }));

  return <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
    <header className="rounded-3xl bg-slate-900 p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Bodega</p><h1 className="mt-1 text-3xl font-blod text-white">Inventario disponible</h1><p className="mt-2 text-sm text-slate-200">Consulta existencias y piezas apartadas sin entrar al registro de compras.</p></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="flex flex-wrap items-end gap-3"><label className="min-w-64 flex-1 text-sm font-semibold">Buscar pieza, proveedor o ubicación<input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border bg-white p-2" /></label><Link to="/bodega/compras" className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold">Registrar compra</Link><Link to="/bodega/entregas" className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold">Entregar piezas</Link></div>
    <p className="text-xs text-slate-600">Físico en bodega descuenta piezas ya entregadas al técnico aunque aún no se hayan facturado. Disponible descuenta además reservas y cuarentena.</p>
    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="min-w-[950px] w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase"><tr>{['Pieza', 'Proveedor / ubicación', 'Físico en bodega', 'Reservado', 'En taller sin facturar', 'Cuarentena', 'Disponible', 'Mínimo', 'Acción'].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr></thead><tbody>{rows.map((part) => <tr key={part.id_repuesto} className="border-t"><td className="p-3 font-semibold">{part.nombre || `Pieza #${part.id_repuesto}`}</td><td className="p-3">{part.proveedor?.nombre || 'Sin proveedor'}<span className="block text-xs text-slate-500">{part.ubicacion_fisica || 'Sin ubicación'}</span></td><td className="p-3">{part.fisico_bodega}</td><td className="p-3">{part.reservado}</td><td className="p-3">{part.en_taller_sin_facturar}</td><td className="p-3">{part.cuarentena}</td><td className={`p-3 font-bold ${part.disponible <= part.stock_minimo ? 'text-amber-700' : 'text-emerald-700'}`}>{part.disponible}</td><td className="p-3">{part.stock_minimo}</td><td className="p-3"><button type="button" onClick={() => selectPart(part)} className="font-semibold text-indigo-700 underline">Pieza defectuosa</button></td></tr>)}</tbody></table>{!rows.length && <p className="p-6 text-sm text-slate-500">No hay piezas para esta búsqueda.</p>}</div>
    <div className="flex items-center justify-end gap-2 text-sm"><span>{meta.total} piezas · página {page}</span><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Anterior</button><button disabled={!meta.hasMore} onClick={() => setPage(page + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Siguiente</button></div>
    {selected && <form onSubmit={save} className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2"><div className="sm:col-span-2 flex justify-between"><h2 className="text-lg font-bold">Registrar pieza defectuosa · {selected.nombre}</h2><button type="button" onClick={() => setSelected(null)} className="text-sm underline">Cerrar</button></div><label className="text-sm">Origen<select value={form.origen} onChange={(e) => change('origen', e.target.value)} className="mt-1 block w-full rounded border p-2"><option value="BODEGA">Existencia de bodega</option><option value="RECLAMO">Pieza retirada por reclamo</option></select></label><label className="text-sm">Compra de origen<select required value={form.compra_id} onChange={(e) => change('compra_id', e.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">Seleccione</option>{lots.filter((lot) => form.origen === 'RECLAMO' || lot.disponibles_identificadas > 0).map((lot) => <option key={lot.id_compra} value={lot.id_compra}>#{lot.id_compra} · {lot.proveedor} · {lot.disponibles_identificadas} disponibles</option>)}</select></label><label className="text-sm">Cantidad<input required type="number" min="1" value={form.cantidad} onChange={(e) => change('cantidad', e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>{form.origen === 'RECLAMO' && <label className="text-sm">Reclamo #<input required type="number" min="1" value={form.reclamo_id} onChange={(e) => change('reclamo_id', e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>}<label className="text-sm sm:col-span-2">Falla observada y motivo<textarea required minLength={10} maxLength={2000} value={form.motivo} onChange={(e) => change('motivo', e.target.value)} className="mt-1 block w-full rounded border p-2" /></label><button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-50">Apartar pieza</button></form>}
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-bold">Piezas defectuosas y devoluciones al proveedor</h2><div className="mt-3 space-y-2">{returns.map((item) => <div key={item.id_devolucion} className="flex flex-wrap items-center justify-between gap-2 border-t py-3 text-sm"><div><strong>{item.cantidad} × {item.repuesto?.nombre}</strong> · compra #{item.compra_id} · {item.compra?.proveedor?.nombre}<p className="text-slate-600">{item.origen === 'RECLAMO' ? `Reclamo #${item.reclamo_id}` : 'Existencia de bodega'} · {item.motivo}</p></div>{item.estado === 'CUARENTENA' ? <button type="button" disabled={busy} onClick={() => returnToSupplier(item.id_devolucion)} className="rounded-lg border border-indigo-300 px-3 py-2 font-semibold text-indigo-700 disabled:opacity-50">Confirmar devolución</button> : <span className="font-semibold text-emerald-700">Devuelto</span>}</div>)}{!returns.length && <p className="text-sm text-slate-500">Aún no hay piezas defectuosas registradas.</p>}</div></section>
  </section>;
}
