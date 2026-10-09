import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, Boxes, ClipboardList, PackageCheck, ShoppingBag, TriangleAlert } from 'lucide-react';
import api from '../../../services/api';

const money = (value) => `C$ ${Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cards = [
  ['Referencias', 'referencias', Boxes, '/bodega/repuestos'],
  ['Unidades disponibles', 'unidades', PackageCheck, '/bodega/inventario'],
  ['Piezas por entregar', 'pendientes', ClipboardList, '/bodega/entregas'],
  ['Bajo stock mínimo', 'bajo_minimo', TriangleAlert, '/bodega/inventario'],
];

export default function BodegaDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  useEffect(() => {
    let active = true;
    api.get('/bodega/resumen').then(({ data: result }) => { if (active) setData(result.data); }).catch(() => { if (active) setError('No se pudo cargar el resumen de Bodega.'); });
    return () => { active = false; };
  }, []);
  const download = async () => {
    setDownloading(true); setError('');
    try {
      const response = await api.get('/bodega/reporte.xlsx', { params: { desde: desde || undefined, hasta: hasta || undefined }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = url; link.download = 'bodega-entradas-salidas.xlsx'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError('No se pudo descargar el informe. Revise el periodo.'); }
    finally { setDownloading(false); }
  };
  return <section className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="sgr-summary-header rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-900 p-6 text-white shadow-lg"><p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Bodega</p><h1 className="mt-2 text-3xl font-black">Inicio de inventario</h1><p className="mt-2 text-sm text-slate-200">Entradas, entregas al taller y piezas que requieren atención.</p></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!data ? <p className="text-sm text-slate-500">Cargando resumen…</p> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, key, Icon, to]) => <Link key={key} to={to} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"><Icon className="h-6 w-6 text-indigo-600" /><p className="mt-4 text-3xl font-black text-slate-900">{key === 'bajo_minimo' ? data[key].length : data[key]}</p><p className="text-sm text-slate-600">{label}</p></Link>)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><article className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Últimos 30 días</h2><p className="mt-3 text-sm">Entraron <strong>{data.entradas_30_dias}</strong> piezas por {money(data.costo_entradas_30_dias)}.</p><p className="mt-1 text-sm">Se registraron <strong>{data.entregas_30_dias}</strong> entregas al taller.</p><Link to="/bodega/compras" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700"><ShoppingBag size={16} /> Registrar entrada</Link></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Informe de entradas y salidas</h2><p className="mt-1 text-sm text-slate-600">Incluye proveedor, compra de origen, orden, equipo y cliente de cada salida.</p><div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs font-medium">Desde<input type="date" value={desde} max={hasta || undefined} onChange={(event) => setDesde(event.target.value)} className="mt-1 block rounded-lg border px-3 py-2" /></label><label className="text-xs font-medium">Hasta<input type="date" value={hasta} min={desde || undefined} onChange={(event) => setHasta(event.target.value)} className="mt-1 block rounded-lg border px-3 py-2" /></label><button type="button" disabled={downloading} onClick={download} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><ArrowDownToLine size={16} /> Descargar Excel</button></div></article></div>
      <div className="grid gap-4 lg:grid-cols-2"><article className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Compras recientes</h2><ul className="mt-3 divide-y text-sm">{data.compras_recientes.map((row) => <li key={row.id_compra} className="py-2">#{row.id_compra} · {row.repuesto?.nombre || 'Repuesto'} · {row.proveedor?.nombre || 'Proveedor'} · {row.cantidad} × {money(row.costo_unitario)}</li>)}</ul></article><article className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Piezas bajo mínimo</h2><ul className="mt-3 divide-y text-sm">{data.bajo_minimo.slice(0, 8).map((row) => <li key={row.id_repuesto} className="py-2">{row.nombre} · {row.proveedor?.nombre || 'Sin proveedor'} · <strong>{row.stock_actual}</strong> / mínimo {row.stock_minimo}</li>)}</ul>{!data.bajo_minimo.length && <p className="mt-3 text-sm text-slate-500">Todas las piezas están sobre su mínimo.</p>}</article></div>
    </>}
  </section>;
}
