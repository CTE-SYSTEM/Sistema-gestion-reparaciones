import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  ClipboardList,
  FileText,
  Filter,
  Laptop,
  PackageCheck,
  Receipt,
  Search,
  ShieldCheck,
  User,
  Wrench,
  ChevronDown,
} from 'lucide-react';
import { getFlujoAtencion } from '../services/flujoAtencionService';
import { useInfiniteAreaList } from '../../shared/hooks/useInfiniteAreaList';

const filtros = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'en-revision', label: 'En revisión' },
  { id: 'listos-orden', label: 'Listos para orden' },
  { id: 'en-reparacion', label: 'En reparación' },
  { id: 'listos-facturar', label: 'Listos para facturar' },
  { id: 'entregados', label: 'Entregados' },
  { id: 'con-garantia', label: 'Con garantía' },
];

const pasos = [
  { key: 'cliente', label: 'Cliente', icon: User },
  { key: 'equipo', label: 'Equipo', icon: Laptop },
  { key: 'diagnostico', label: 'Diagnóstico', icon: ClipboardList },
  { key: 'orden', label: 'Orden', icon: Wrench },
  { key: 'repuestos', label: 'Repuestos', icon: PackageCheck },
  { key: 'factura', label: 'Factura', icon: Receipt },
  { key: 'garantia', label: 'Garantía', icon: ShieldCheck },
];

const estadoColor = {
  pendientes: 'bg-amber-50 text-amber-700 border-amber-200',
  'en-revision': 'bg-sky-50 text-sky-700 border-sky-200',
  'listos-orden': 'bg-violet-50 text-violet-700 border-violet-200',
  'en-reparacion': 'bg-blue-50 text-blue-700 border-blue-200',
  'listos-facturar': 'bg-rose-50 text-rose-700 border-rose-200',
  entregados: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'con-garantia': 'bg-teal-50 text-teal-700 border-teal-200',
};

const hasStep = (item, key) => {
  if (key === 'cliente') return Boolean(item.cliente);
  if (key === 'equipo') return Boolean(item.equipo);
  if (key === 'diagnostico') return Boolean(item.diagnostico);
  if (key === 'orden') return Boolean(item.orden);
  if (key === 'repuestos') return Number(item.repuestos?.total || 0) > 0;
  if (key === 'factura') return Boolean(item.factura);
  if (key === 'garantia') return Boolean(item.garantia);
  return false;
};

const formatEquipo = (equipo) =>
  [equipo?.marca, equipo?.modelo].filter(Boolean).join(' ') || equipo?.tipo || 'Equipo sin detalle';

const StatusPill = ({ item }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${estadoColor[item.filtro] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
    {filtros.find((filtro) => filtro.id === item.filtro)?.label || item.filtro}
  </span>
);

const FlujoAtencion = () => {
  const [filtro, setFiltro] = useState('todos');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const loadMoreRef = useRef(null);
  
  // NUEVO: Estado para abrir/cerrar el desplegable de filtros
  const [isOpenFiltro, setIsOpenFiltro] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput), 150);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);
  const flujoQuery = useInfiniteAreaList({
    queryKey: ['recepcion', 'flujo-atencion'],
    queryFn: getFlujoAtencion,
    search,
    extraParams: { filtro },
  });
  const items = flujoQuery.rows;
  const meta = flujoQuery.data?.pages?.[0]?.meta || {};
  const resumen = meta.resumen || {};
  const loading = flujoQuery.isPending;
  const error = flujoQuery.error?.response?.data?.error || (flujoQuery.error ? 'No se pudo cargar el flujo de atención.' : '');
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !flujoQuery.hasNextPage || flujoQuery.isFetchingNextPage) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) flujoQuery.fetchNextPage();
    }, { rootMargin: '400px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [flujoQuery.hasNextPage, flujoQuery.isFetchingNextPage, flujoQuery.fetchNextPage]);

  // Obtener la etiqueta del filtro seleccionado actualmente
  const filtroActivoLabel = useMemo(() => {
    return filtros.find((f) => f.id === filtro)?.label || 'Todos';
  }, [filtro]);

  return (
    <div className="space-y-4 p-4">
      
      {/* CABECERA COMPACTA: Alinea el título, buscador y botón de ayuda en una sola línea */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-100 pb-3">
        <div className="text-left">
          <div className="mb-0.5 inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-bold text-cyan-700">
            <BadgeCheck className="h-3 w-3" />
            Seguimiento operativo
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Flujo de Atención</h1>
          <p className="text-xs font-medium text-slate-400">
            Monitoreo general de estados desde el ingreso hasta la facturación.
          </p>
        </div>

        {/* Grupo de controles: Buscador + Botón Ayuda integrados al mismo nivel */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:w-auto w-full">
          <label className="relative block w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 shadow-sm"
              placeholder="Buscar cliente, equipo..."
            />
          </label>
          
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-1.5 text-xs font-bold text-gray-600 shadow-sm hover:bg-gray-50 shrink-0"
          >
            <span>Ayuda</span>
          </button>
        </div>
      </header>

      {/* ACCIÓN DE FILTROS DESPLEGABLE (DROPDOWN COMPACTO) */}
      <section className="flex justify-start relative z-30">
        <div className="relative w-full sm:w-64 text-left">
          <button
            type="button"
            onClick={() => setIsOpenFiltro(!isOpenFiltro)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:border-slate-300 transition-all focus:ring-2 focus:ring-cyan-100"
          >
            <span className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              Filtrar por: <span className="text-cyan-600 font-extrabold">{filtroActivoLabel}</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpenFiltro ? 'rotate-180' : ''}`} />
          </button>

          {/* Lista desplegable flotante */}
          {isOpenFiltro && (
            <>
              {/* Capa invisible trasera para cerrar el menú haciendo clic afuera */}
              <div className="fixed inset-0 z-10" onClick={() => setIsOpenFiltro(false)} />
              
              <div className="absolute left-0 mt-1 z-20 w-full rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150">
                {filtros.map((item) => {
                  const isSelected = filtro === item.id;
                  const totalItems = item.id === 'todos' ? resumen.todos || items.length : resumen[item.id] || 0;
                  
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setFiltro(item.id);
                        setIsOpenFiltro(false); // Se pliega automáticamente al seleccionar
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
                        isSelected 
                          ? 'bg-cyan-50 text-cyan-700 font-bold' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isSelected ? 'bg-cyan-200/60 text-cyan-800' : 'bg-slate-100 text-slate-500'}`}>
                        {totalItems}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 text-left">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm font-semibold text-slate-500">
          Cargando seguimiento...
        </div>
      )}

      {!loading && !error && (
        <section className="space-y-3">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center text-sm font-bold text-slate-400">
              No hay equipos en este filtro.
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm text-left hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">{item.cliente?.nombre || 'Cliente sin nombre'}</h2>
                      <StatusPill item={item} />
                    </div>
                    <p className="mt-0.5 text-xs font-bold text-slate-600">{formatEquipo(item.equipo)}</p>
                    <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 inline-block font-medium italic">
                      <span className="not-italic font-bold text-slate-400 block text-[9px] uppercase mb-0.5">Falla Reportada:</span>
                      {item.diagnostico?.falla_reportada || 'Sin falla reportada'}
                    </div>
                  </div>

                  <div className="grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2 xl:min-w-[420px]">
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 px-3 py-1.5">
                      <span className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">Diagnóstico</span>
                      <span className="font-semibold text-slate-700">{item.diagnostico?.estado || 'Pendiente'}</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 px-3 py-1.5">
                      <span className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">Orden</span>
                      <span className="font-semibold text-slate-700">{item.orden ? `${item.orden.estado} #${item.orden.id_orden}` : 'No creada'}</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 px-3 py-1.5">
                      <span className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">Repuestos</span>
                      <span className="font-semibold text-slate-700">{item.repuestos.total ? `${item.repuestos.pendientes} pendientes de ${item.repuestos.total}` : 'Sin repuestos'}</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 px-3 py-1.5">
                      <span className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">Factura / garantía</span>
                      <span className="font-semibold text-slate-700">{item.factura ? `Factura #${item.factura.id_factura}` : 'No emitida'}{item.garantia ? ' + garantía' : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Línea de pasos del Flujo */}
                <div className="mt-4 grid gap-1.5 grid-cols-2 sm:grid-cols-4 md:grid-cols-7">
                  {pasos.map((paso, index) => {
                    const Icon = paso.icon;
                    const active = hasStep(item, paso.key);
                    return (
                      <div key={paso.key} className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200/60 bg-slate-50/50 px-2 py-1 md:flex-col md:justify-center md:text-center">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${active ? 'bg-cyan-600 text-white' : 'bg-white text-slate-300 border border-slate-200'}`}>
                          {active ? <BadgeCheck className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-slate-700 truncate">{paso.label}</div>
                          <div className="text-[9px] font-bold text-slate-400">{active ? 'Listo' : index < 2 ? 'Registrado' : 'Pendiente'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {item.garantia?.fecha_vencimiento && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
                    <FileText className="h-3.5 w-3.5" />
                    Garantía vence el {new Date(item.garantia.fecha_vencimiento).toLocaleDateString()}
                  </div>
                )}
              </article>
            ))
          )}
          {(flujoQuery.hasNextPage || flujoQuery.isFetchingNextPage) && (
            <div ref={loadMoreRef} className="py-3 text-center text-xs text-slate-500">
              {flujoQuery.isFetchingNextPage ? 'Cargando más equipos…' : `Mostrando ${items.length} de ${meta.total ?? resumen.todos ?? items.length}. Desplázate para ver más.`}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default FlujoAtencion;
