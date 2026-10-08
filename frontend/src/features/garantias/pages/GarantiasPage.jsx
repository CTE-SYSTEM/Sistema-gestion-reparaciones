import React, { useEffect, useState } from 'react';
import { createGarantia, getGarantias } from '../services/garantiasService';
import { getFacturas } from '../../contabilidad/services/facturasService';

export default function GarantiasPage() {
  const [garantias, setGarantias] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [facturaId, setFacturaId] = useState('');
  const [search, setSearch] = useState('');
  const [meses, setMeses] = useState('3');
  const [condiciones, setCondiciones] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [g, f] = await Promise.all([getGarantias({ pageSize: 100, search }), getFacturas({ pageSize: 100 })]);
    setGarantias(g.data.data || []);
    setFacturas(f.data.data || []);
  };
  useEffect(() => {
    let active = true;
    Promise.all([getGarantias({ pageSize: 100 }), getFacturas({ pageSize: 100 })]).then(([g, f]) => {
      if (active) { setGarantias(g.data.data || []); setFacturas(f.data.data || []); }
    }).catch(() => { if (active) setError('No se pudieron cargar las garantías.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    try {
      await createGarantia({ factura_id: Number(facturaId), duracion_meses: Number(meses), condiciones });
      await load(); setFacturaId(''); setMessage('Garantía registrada.');
    } catch (e) { setError(e.response?.data?.error || 'No se pudo registrar la garantía.'); }
  };

  return <section className="mx-auto max-w-5xl space-y-5 p-4">
    <header><h1 className="text-2xl font-bold">Garantías</h1><p className="text-sm text-slate-600">Registro y consulta de las garantías de reparaciones facturadas.</p></header>
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
      <label className="text-sm">Número de factura<input required type="number" min="1" list="facturas-recientes" className="mt-1 block w-full rounded border p-2" value={facturaId} onChange={(e) => setFacturaId(e.target.value)} />
        <datalist id="facturas-recientes">{facturas.filter((f) => f.orden_id && !garantias.some((g) => g.factura_id === f.id_factura)).map((f) => <option key={f.id_factura} value={f.id_factura}>Orden #{f.orden_id}</option>)}</datalist>
      </label>
      <label className="text-sm">Duración en meses<input required type="number" min="1" max="36" className="mt-1 block w-full rounded border p-2" value={meses} onChange={(e) => setMeses(e.target.value)} /></label>
      <label className="text-sm sm:col-span-2">Condiciones<textarea className="mt-1 block w-full rounded border p-2" value={condiciones} onChange={(e) => setCondiciones(e.target.value)} /></label>
      <button className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white sm:w-fit">Registrar garantía</button>
    </form>
    {message && <p role="status" className="text-green-700">{message}</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <form onSubmit={(event) => { event.preventDefault(); load().catch(() => setError('No se pudo buscar la garantía.')); }} className="flex gap-2">
      <input type="search" aria-label="Buscar garantías" placeholder="Número o cliente" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1 rounded border p-2" />
      <button className="rounded border px-3 py-2">Buscar</button>
    </form>
    {loading ? <p>Cargando…</p> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Garantía</th><th className="p-3">Factura</th><th className="p-3">Equipo</th><th className="p-3">Vence</th></tr></thead><tbody>{garantias.map((g) => <tr key={g.id_garantia} className="border-t"><td className="p-3">#{g.id_garantia}</td><td className="p-3">#{g.factura_id}</td><td className="p-3">{[g.factura?.orden?.diagnostico?.equipo?.marca, g.factura?.orden?.diagnostico?.equipo?.modelo].filter(Boolean).join(' ') || '—'}</td><td className="p-3">{g.fecha_vencimiento ? new Date(g.fecha_vencimiento).toLocaleDateString('es-NI') : '—'}</td></tr>)}</tbody></table></div>}
  </section>;
}
