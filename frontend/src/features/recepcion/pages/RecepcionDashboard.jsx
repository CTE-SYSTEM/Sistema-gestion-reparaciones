import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardList, Laptop, Users } from 'lucide-react';
import PageHelp from '../../../components/PageHelp';
import { getResumenRecepcion } from '../services/flujoAtencionService';

const periods = [
  { key: 'semana', label: 'Esta semana', detail: 'Desde el lunes' },
  { key: 'mes', label: 'Este mes', detail: 'Desde el día 1' },
  { key: 'ano', label: 'Este año', detail: 'Desde enero' },
  { key: 'total', label: 'Total', detail: 'Todos los ingresos' },
];

const actions = [
  { to: '/recepcion/clientes', title: 'Clientes', description: 'Registrar o buscar a la persona.', icon: Users },
  { to: '/recepcion/equipos', title: 'Equipos', description: 'Registrar o localizar el equipo.', icon: Laptop },
  { to: '/recepcion/diagnostico', title: 'Ingresar equipo', description: 'Documentar una nueva visita y su falla.', icon: ClipboardList },
];

export default function RecepcionDashboard() {
  const { data, isPending, error } = useQuery({
    queryKey: ['recepcion', 'resumen-ingresos'],
    queryFn: getResumenRecepcion,
    refetchOnMount: 'always',
  });
  const summary = data?.data?.data || {};

  return <div className="space-y-6 p-4">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Inicio de Recepción</h1>
        <p className="mt-1 text-sm text-slate-600">Ingresos registrados por visita. Un mismo equipo cuenta de nuevo cuando vuelve con otra falla.</p>
      </div>
      <PageHelp compact />
    </header>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el resumen de ingresos.</p>}
    <section aria-label="Ingresos por período" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {periods.map(({ key, label, detail }) => <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <p className="mt-2 text-3xl font-extrabold text-indigo-700">{isPending ? '…' : Number(summary[key] || 0).toLocaleString('es-NI')}</p>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      </article>)}
    </section>

    <section>
      <h2 className="mb-3 text-lg font-bold text-slate-800">Continuar trabajo</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {actions.map(({ to, title, description, icon: Icon }) => <Link key={to} to={to} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
          <Icon className="mb-3 h-6 w-6 text-indigo-600" aria-hidden="true" />
          <h3 className="font-bold text-slate-800">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </Link>)}
      </div>
    </section>
  </div>;
}
