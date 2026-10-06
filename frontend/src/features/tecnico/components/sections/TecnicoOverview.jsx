import React from 'react';
import { Calendar, CheckCircle2, ClipboardList, Package, Wrench } from 'lucide-react';
import PageHelp from '../../../../components/PageHelp';
import { TecnicoStatCard } from '../TecnicoStats';

export const TecnicoIntro = ({ showHelp }) => (
  <>
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-left">
        <h1 className="text-2xl font-black text-slate-800">Panel tecnico</h1>
        <p className="text-sm font-semibold text-slate-500">Diagnosticos, ordenes activas, cierres y solicitudes de piezas.</p>
      </div>
      <PageHelp compact />
    </div>

    {showHelp && (
      <section className="mb-6 rounded-2xl bg-slate-950 p-6 text-white shadow-sm space-y-4 animate-fade-in">
        <div>
          <h2 className="text-lg font-bold">Mini tutorial del tecnico</h2>
          <p className="mt-1 text-sm text-slate-300">
            Este panel ordena tu trabajo diario: revisar diagnosticos, mover ordenes y solicitar repuestos.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['1. Filtra indicadores', 'El selector de fecha cambia los cuatro contadores superiores.', 'text-violet-400'],
            ['2. Trabaja por pestanas', 'Usa diagnosticos, ordenes activas, finalizadas y piezas segun la tarea.', 'text-blue-400'],
            ['3. Busca rapido', 'Cada seccion tiene buscador para filtrar por equipo, falla u orden.', 'text-amber-400'],
            ['4. Cierra con cuidado', 'Al finalizar una orden se abre el formulario de cierre tecnico.', 'text-emerald-400'],
          ].map(([title, text, color]) => (
            <div key={title} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className={`text-sm font-semibold ${color}`}>{title}</p>
              <p className="mt-1 text-xs text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>
    )}
  </>
);

export const TecnicoTimeFilter = ({ timeFilter, onChange }) => (
  <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex items-center gap-2 text-left">
      <Calendar className="text-indigo-500 w-5 h-5" />
      <div>
        <h3 className="font-bold text-slate-800">Filtrar Indicadores de Rendimiento</h3>
        <p className="text-xs text-slate-500">Afecta los numeros de los 4 recuadros informativos superiores.</p>
      </div>
    </div>
    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
      {[
        { id: 'hoy', label: 'Hoy' },
        { id: 'mes', label: 'Este Mes' },
        { id: 'anio', label: 'Este Ano' },
        { id: 'todos', label: 'Historico' },
      ].map((btn) => (
        <button
          key={btn.id}
          onClick={() => onChange(btn.id)}
          className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
            timeFilter === btn.id
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  </div>
);

export const TecnicoStatsGrid = ({ stats }) => (
  <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-4">
    <TecnicoStatCard icon={<ClipboardList size={22} />} label="En revision" value={stats.enRevisionCount} color="violet" />
    <TecnicoStatCard icon={<CheckCircle2 size={22} />} label="Diagnosticos completados" value={stats.completadosCount} color="emerald" />
    <TecnicoStatCard icon={<Wrench size={22} />} label="Ordenes activas" value={stats.ordenesActivasCount} color="blue" />
    <TecnicoStatCard icon={<Package size={22} />} label="Mis piezas" value={stats.piezasCount} color="amber" />
  </div>
);
