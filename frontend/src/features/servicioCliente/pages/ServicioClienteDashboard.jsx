import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';

const cards = [
  ['Diagnósticos aprobados', 'diagnosticos', '/servicio-cliente/nueva-orden', 'Contactar y registrar la respuesta del cliente.'],
  ['Órdenes para facturar', 'facturacion', '/servicio-cliente/facturacion', 'Calidad aprobó el trabajo o se confirmó que es irreparable.'],
  ['Equipos por entregar', 'entregas', '/servicio-cliente/facturacion', 'Revisar factura y saldo antes de entregar.'],
  ['Reclamos abiertos', 'reclamos', '/servicio-cliente/reclamos', 'Dar seguimiento a los casos de postventa.'],
];
export default function ServicioClienteDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = async () => {
    setError('');
    const [diagnoses, orders, deliveries, claims] = await Promise.all([
      api.get('/ordenes/diagnosticos-listos', { params: { pageSize: 1 } }),
      api.get('/facturas/ordenes-disponibles'),
      api.get('/facturas', { params: { entregaEstado: 'pendientes', pageSize: 1 } }),
      api.get('/reclamos', { params: { estado: 'ABIERTO', pageSize: 1 } }),
    ]);
    setData({ diagnosticos: diagnoses.data.meta?.listosParaOrden || 0, facturacion: orders.data.data?.length || 0,
      entregas: deliveries.data.meta?.total || 0, reclamos: claims.data.meta?.total || 0 });
  };
  useEffect(() => { load().catch(() => setError('No se pudo cargar el inicio de Servicio al Cliente.')); }, []);
  return <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6"><header className="rounded-3xl bg-slate-900 p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-white">Servicio al Cliente</p><h1 className="mt-1 text-3xl font-bold text-white">Inicio de atención</h1><p className="mt-2 text-sm text-slate-200">Diagnósticos, facturación, entrega de equipos y reclamos.</p></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error} <button type="button" onClick={() => load().catch(() => setError('No se pudo cargar el resumen.'))} className="underline">Reintentar</button></p>}
    {!data && !error && <p>Cargando pendientes…</p>}
    {data && <div className="grid gap-4 sm:grid-cols-2">{cards.map(([label, key, to, detail]) => <Link key={key} to={to} className="rounded-2xl border bg-white p-5 shadow-sm hover:border-indigo-300"><p className="text-3xl font-black text-indigo-700">{data[key]}</p><h2 className="mt-2 font-bold">{label}</h2><p className="mt-1 text-sm text-slate-600">{detail}</p></Link>)}</div>}
    <Link to="/servicio-cliente/flujo-atencion" className="block rounded-2xl border bg-white p-5 font-semibold text-indigo-700">Consultar el flujo de atención completo →</Link>
  </section>;
}
