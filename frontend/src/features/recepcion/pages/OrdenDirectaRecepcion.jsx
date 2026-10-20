import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import PageHelp from '../../../components/PageHelp';
import OrdenDirectaForm from '../../servicioCliente/components/OrdenDirectaForm';
import FotosServicio from '../../shared/components/FotosServicio';

export default function OrdenDirectaRecepcion() {
  const [created, setCreated] = useState(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const area = pathname.startsWith('/secretaria/') ? '/secretaria' : '/recepcion';
  const queryClient = useQueryClient();
  const onCreated = (orden) => {
    setCreated(orden);
    queryClient.invalidateQueries({ queryKey: ['recepcion'] });
    queryClient.invalidateQueries({ queryKey: ['servicio-cliente'] });
  };
  return <section className="space-y-5 p-4">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
      <div><h1 className="text-2xl font-bold">Orden directa</h1><p className="mt-1 text-sm text-slate-600">Para una reparación definida, como cambiar una pantalla, sin pasar por un diagnóstico previo.</p></div>
      <PageHelp compact />
    </header>
    {!created ? <>
      <p className="rounded-xl border bg-indigo-50 p-3 text-sm text-indigo-950">Registre primero al cliente y su equipo. Confirme el trabajo y el monto autorizado; el jefe de taller asignará al técnico.</p>
      <div className="flex flex-wrap gap-3 text-sm"><Link className="font-semibold text-indigo-700 underline" to={`${area}/clientes`}>Registrar cliente</Link><Link className="font-semibold text-indigo-700 underline" to={`${area}/equipos`}>Registrar equipo</Link></div>
      <OrdenDirectaForm onCreated={onCreated} onCancel={() => navigate(area)} />
    </> : <>
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><h2 className="font-bold">Orden #{created.id_orden} creada</h2><p className="mt-1 text-sm">Pendiente de asignación por el jefe de taller. Servicio al Cliente continuará el seguimiento, cobro y entrega. No tiene cargo de diagnóstico.</p></div>
      <FotosServicio kind="ordenes" id={created.id_orden} receptionView title="Fotografías del equipo ingresado" />
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setCreated(null)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Crear otra orden</button><Link to={`${area}/flujo-atencion`} className="rounded-lg border px-4 py-2 text-sm">Ver flujo de atención</Link></div>
    </>}
  </section>;
}
