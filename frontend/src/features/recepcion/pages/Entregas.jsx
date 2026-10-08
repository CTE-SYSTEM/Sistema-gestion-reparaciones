import React, { useEffect, useState } from 'react';
import { getFacturas } from '../../contabilidad/services/facturasService';
import { registrarEntregaOrden } from '../services/ordenesService';
import FotosServicio from '../../shared/components/FotosServicio';
import api from '../../../services/api';

export default function Entregas() {
  const [facturas, setFacturas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [saldo, setSaldo] = useState(null);
  const [persona, setPersona] = useState('');
  const [observacion, setObservacion] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => setFacturas((await getFacturas({ pageSize: 100, search })).data.data || []);
  useEffect(() => { load().catch(() => setError('No se pudieron cargar las entregas.')); }, []);
  const pendientes = facturas.filter((f) => f.orden_id && f.orden?.estado !== 'ENTREGADO');
  const selectFactura = async (factura) => {
    setSelected(factura); setSaldo(null); setError('');
    try { const { data } = await api.get(`/facturas/${factura.id_factura}/saldo`); setSaldo(data.data); }
    catch (e) { setError(e.response?.data?.error || 'No se pudo consultar el saldo.'); }
  };

  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    try {
      await registrarEntregaOrden(selected.orden_id, { persona_recibe: persona.trim(), observacion_entrega: observacion.trim() });
      setSelected(null); setSaldo(null); setPersona(''); setObservacion('');
      await load(); setMessage('Entrega registrada.');
    } catch (e) { setError(e.response?.data?.error || 'No se pudo registrar la entrega.'); }
  };

  return <section className="mx-auto max-w-5xl space-y-5 p-4">
    <header><h1 className="text-2xl font-bold">Entrega de equipos</h1><p className="text-sm text-slate-600">Compruebe calidad y pago, luego registre la fotografía y la persona que recibe el equipo.</p></header>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {message && <p role="status" className="text-green-700">{message}</p>}
    <form onSubmit={(event) => { event.preventDefault(); load().catch(() => setError('No se pudieron buscar las facturas.')); }} className="flex gap-2">
      <input type="search" aria-label="Buscar facturas para entregar" placeholder="Número de factura o cliente" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1 rounded border p-2" />
      <button className="rounded border px-3 py-2">Buscar</button>
    </form>
    <div className="grid gap-2">{pendientes.map((f) => <button type="button" key={f.id_factura} onClick={() => selectFactura(f)} className="rounded-lg border bg-white p-3 text-left hover:border-indigo-500">
      Factura #{f.id_factura} · Orden #{f.orden_id} · {[f.orden?.diagnostico?.equipo?.marca, f.orden?.diagnostico?.equipo?.modelo].filter(Boolean).join(' ')} · Calidad {f.orden?.calidad_estado || 'sin registro'}
    </button>)}{!pendientes.length && <p>No hay entregas pendientes en las facturas cargadas.</p>}</div>
    {selected && <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="font-bold">Entrega de orden #{selected.orden_id}</h2>
      <p className="text-sm">Calidad: {selected.orden?.calidad_estado || 'sin registro'} · Pago: {saldo ? saldo.pendiente > 0 ? `pendiente ${saldo.pendiente.toFixed(2)}` : 'completo' : 'consultando…'}</p>
      <FotosServicio kind="ordenes" id={selected.orden_id} tipoInicial="FOTO_ENTREGA" allowedTypes={['FOTO_ENTREGA']} />
      <label className="block text-sm">Persona que recibe<input required value={persona} onChange={(e) => setPersona(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
      <label className="block text-sm">Observación<textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
      <p className="text-xs text-slate-600">Guarda la foto antes de confirmar. El sistema exige una foto de entrega.</p>
      <button disabled={!saldo || saldo.pendiente > 0 || (selected.orden?.estado === 'FINALIZADO' && !['APROBADO', 'NO_REQUERIDO'].includes(selected.orden?.calidad_estado))} className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Confirmar entrega</button>
    </form>}
  </section>;
}
