import { useEffect, useState } from 'react';
import api from '../../../services/api';

const initial = { tipo: 'COBRO', factura_id: '', reclamo_id: '', monto: '', metodo: 'Efectivo', referencia: '', motivo: '' };
const money = (value) => Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MovimientosPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initial);
  const [saldo, setSaldo] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => { const { data } = await api.get('/contabilidad/movimientos', { params: { pageSize: 100 } }); setRows(data.data || []); };
  useEffect(() => { load().catch(() => setError('No se pudieron cargar los movimientos.')); }, []);
  const setField = (field, value) => setForm((old) => ({ ...old, [field]: value }));
  const checkBalance = async () => {
    setError('');
    try { const { data } = await api.get(`/contabilidad/movimientos/facturas/${form.factura_id}/saldo`); setSaldo(data.data); }
    catch (err) { setSaldo(null); setError(err.response?.data?.error || 'No se pudo consultar el saldo.'); }
  };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await api.post('/contabilidad/movimientos', { ...form, factura_id: form.factura_id ? Number(form.factura_id) : null,
        reclamo_id: form.reclamo_id ? Number(form.reclamo_id) : null, monto: Number(form.monto) });
      await load(); setSaldo(null); setForm(initial); setMessage('Movimiento registrado con su referencia y responsable.');
    } catch (err) { setError(err.response?.data?.error || 'No se pudo registrar el movimiento.'); }
    finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-5xl space-y-5 p-4">
    <header><h1 className="text-2xl font-bold">Movimientos contables</h1><p className="text-sm text-slate-600">Registre cobros pendientes, devoluciones y costos asociados a reclamos. Las facturas cobradas al emitir ya figuran aquí.</p></header>
    {message && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
      <label className="text-sm">Tipo<select value={form.tipo} onChange={(e) => { setField('tipo', e.target.value); setSaldo(null); }} className="mt-1 w-full rounded border p-2"><option value="COBRO">Cobro</option><option value="DEVOLUCION">Devolución</option><option value="COSTO_RECLAMO">Costo de reclamo</option></select></label>
      {form.tipo === 'COSTO_RECLAMO' ? <label className="text-sm">Reclamo #<input required type="number" min="1" value={form.reclamo_id} onChange={(e) => setField('reclamo_id', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
        : <label className="text-sm">Factura #<div className="mt-1 flex gap-2"><input required type="number" min="1" value={form.factura_id} onChange={(e) => { setField('factura_id', e.target.value); setSaldo(null); }} className="min-w-0 flex-1 rounded border p-2" /><button type="button" disabled={!form.factura_id} onClick={checkBalance} className="rounded border px-3 disabled:opacity-50">Ver saldo</button></div></label>}
      {saldo && <p className="rounded bg-indigo-50 p-2 text-sm sm:col-span-2">Total: {money(saldo.total)} · Cobrado: {money(saldo.cobrado)} · Devuelto: {money(saldo.devuelto)} · Pendiente: {money(saldo.pendiente)}{saldo.cobro_historico ? ' · Cobro anterior al registro de movimientos' : ''}</p>}
      <label className="text-sm">Monto<input required type="number" min="0.01" step="0.01" value={form.monto} onChange={(e) => setField('monto', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      {form.tipo !== 'COSTO_RECLAMO' && <label className="text-sm">Método<select value={form.metodo} onChange={(e) => setField('metodo', e.target.value)} className="mt-1 w-full rounded border p-2"><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option></select></label>}
      <label className="text-sm">Referencia<input maxLength={150} value={form.referencia} onChange={(e) => setField('referencia', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm sm:col-span-2">Motivo<textarea required minLength={5} maxLength={2000} value={form.motivo} onChange={(e) => setField('motivo', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      <button disabled={busy} className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Registrar movimiento</button>
    </form>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Fecha</th><th className="p-3">Tipo</th><th className="p-3">Factura / reclamo</th><th className="p-3">Monto</th><th className="p-3">Responsable</th><th className="p-3">Motivo</th></tr></thead><tbody>{rows.map((m) => <tr key={m.id_movimiento} className="border-t"><td className="p-3">{new Date(m.fecha_registro).toLocaleString('es-NI')}</td><td className="p-3">{m.tipo.replaceAll('_', ' ')}</td><td className="p-3">{m.factura_id ? `Factura #${m.factura_id}` : `Reclamo #${m.reclamo_id}`}</td><td className="p-3">{money(m.monto)}</td><td className="p-3">{m.usuario?.nombre_usuario}</td><td className="p-3">{m.motivo}</td></tr>)}</tbody></table></div>
  </section>;
}
