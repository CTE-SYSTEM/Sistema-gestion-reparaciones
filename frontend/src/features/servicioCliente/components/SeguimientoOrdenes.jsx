import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  Search,
  X,
} from 'lucide-react';
import { getHistorialOrden, getOrdenes } from '../services/ordenesService';
import FotosServicio from '../../shared/components/FotosServicio';
import HistorialEstados from '../../shared/components/HistorialEstados';

const estados = {
  PENDIENTE: ['Pendiente', 'border-amber-200 bg-amber-50 text-amber-800'],
  ASIGNADO: ['Asignada', 'border-indigo-200 bg-indigo-50 text-indigo-700'],
  APROBADO: ['Aprobada', 'border-indigo-200 bg-indigo-50 text-indigo-700'],
  EN_REPARACION: ['En reparación', 'border-blue-200 bg-blue-50 text-blue-700'],
  ESPERANDO_PIEZA: ['Esperando pieza', 'border-amber-200 bg-amber-50 text-amber-800'],
  FINALIZADO: ['Reparación finalizada', 'border-emerald-200 bg-emerald-50 text-emerald-700'],
  IRREPARABLE: ['Irreparable', 'border-rose-200 bg-rose-50 text-rose-700'],
  ENTREGADO: ['Entregada', 'border-emerald-200 bg-emerald-50 text-emerald-700'],
  CANCELADO: ['Cancelada', 'border-slate-200 bg-slate-100 text-slate-600'],
};
const closedStates = ['ENTREGADO', 'CANCELADO'];
const initialFilters = { scope: 'activas', estado: '', desde: '', hasta: '', search: '', page: 1 };
const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const fecha = (value) =>
  value
    ? new Date(value).toLocaleDateString('es-NI', {
        timeZone: 'America/Managua',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Sin registrar';

export default function SeguimientoOrdenes({ onCancel, saving }) {
  const { pathname } = useLocation();
  const [filters, setFilters] = useState(initialFilters);
  const [panel, setPanel] = useState(null);
  const [history, setHistory] = useState({ rows: [], loading: false, error: '' });
  const invalidDates = filters.desde && filters.hasta && filters.desde > filters.hasta;
  const query = useQuery({
    queryKey: ['servicio-cliente', 'nueva-orden', 'ordenes', filters],
    queryFn: async () => (await getOrdenes({ ...filters, pageSize: 10 })).data,
    enabled: !invalidDates,
  });
  const orders = query.data?.data || [];
  const total = query.data?.meta?.total || 0;
  const pages = Math.max(1, Math.ceil(total / 10));
  const historyId = panel?.type === 'history' ? panel.id : null;
  const updateFilters = (changes) => {
    setFilters((previous) => ({ ...previous, ...changes, page: changes.page ?? 1 }));
    setPanel(null);
  };

  useEffect(() => {
    if (query.isSuccess && filters.page > pages) {
      setFilters((previous) => ({ ...previous, page: pages }));
      setPanel(null);
    }
  }, [query.isSuccess, filters.page, pages]);

  useEffect(() => {
    if (!historyId) return;
    let current = true;
    setHistory({ rows: [], loading: true, error: '' });
    getHistorialOrden(historyId)
      .then((response) => {
        if (current) setHistory({ rows: response.data?.data || [], loading: false, error: '' });
      })
      .catch(() => {
        if (current)
          setHistory({
            rows: [],
            loading: false,
            error: 'No se pudo cargar el historial de esta orden.',
          });
      });
    return () => {
      current = false;
    };
  }, [historyId]);

  const togglePanel = (id) =>
    setPanel((previous) => (previous?.id === id ? null : { id, type: 'details' }));
  const flowPath = pathname.startsWith('/secretaria')
    ? '/secretaria/flujo-atencion'
    : '/servicio-cliente/flujo-atencion';

  return (
    <section
      aria-labelledby="seguimiento-ordenes-title"
      aria-busy={query.isFetching}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ClipboardList size={20} />
          </span>
          <div>
            <h3 id="seguimiento-ordenes-title" className="text-base font-bold text-slate-900">
              Seguimiento de órdenes
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Consulte las reparaciones en curso y busque las atenciones cerradas.
            </p>
          </div>
        </div>
        <Link
          to={flowPath}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          Flujo de atención <ArrowUpRight size={15} />
        </Link>
      </header>

      <div className="space-y-3 border-b border-slate-200 bg-slate-50/60 p-4 sm:px-5">
        <div role="group" aria-label="Vista de órdenes" className="flex flex-wrap gap-2">
          {[
            ['activas', 'Órdenes activas', ClipboardList],
            ['historial', 'Historial', History],
          ].map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.scope === value}
              onClick={() => updateFilters({ scope: value, estado: '' })}
              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${filters.scope === value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'}`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[minmax(15rem,2fr)_minmax(10rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_auto]">
          <label className="col-span-2 block text-xs font-semibold text-slate-600 sm:col-span-1">
            Buscar órdenes
            <span className="relative mt-1 block">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => updateFilters({ search: event.target.value })}
                placeholder="Orden, cliente, equipo o serie"
                className={`${inputClass} pl-9`}
              />
            </span>
          </label>
          <label className="col-span-2 block text-xs font-semibold text-slate-600 sm:col-span-1">
            Estado de la orden
            <select
              value={filters.estado}
              onChange={(event) => updateFilters({ estado: event.target.value })}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">Todos los estados</option>
              {Object.entries(estados)
                .filter(
                  ([value]) => closedStates.includes(value) === (filters.scope === 'historial'),
                )
                .map(([value, [label]]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Ingreso desde
            <input
              type="date"
              value={filters.desde}
              max={filters.hasta || undefined}
              onChange={(event) => updateFilters({ desde: event.target.value })}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Ingreso hasta
            <input
              type="date"
              value={filters.hasta}
              min={filters.desde || undefined}
              onChange={(event) => updateFilters({ hasta: event.target.value })}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <button
            type="button"
            onClick={() => updateFilters({ search: '', estado: '', desde: '', hasta: '' })}
            className="col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 xl:col-span-1"
          >
            Limpiar filtros
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {filters.scope === 'activas'
            ? 'Incluye órdenes finalizadas que todavía esperan facturación o entrega.'
            : 'Órdenes entregadas y canceladas. Los registros se conservan para consulta.'}
        </p>
      </div>

      {invalidDates ? (
        <p role="alert" className="p-5 text-sm text-red-700">
          La fecha inicial debe ser anterior o igual a la final.
        </p>
      ) : query.isPending ? (
        <p role="status" className="p-6 text-sm text-slate-500">
          Cargando órdenes…
        </p>
      ) : query.isError ? (
        <div role="alert" className="p-5 text-sm text-red-700">
          {query.error?.response?.data?.error || 'No se pudieron cargar las órdenes.'}
          <button
            type="button"
            onClick={() => query.refetch()}
            className="ml-3 font-semibold underline"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs text-slate-500 sm:px-5">
            <span>
              {total
                ? `${(filters.page - 1) * 10 + 1}–${Math.min(filters.page * 10, total)} de ${total} ${total === 1 ? 'orden' : 'órdenes'}`
                : '0 órdenes'}
            </span>
            <span>Más recientes primero</span>
          </div>
          {!orders.length && (
            <div className="mx-4 mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center sm:mx-5">
              <ClipboardList className="mx-auto mb-2 text-slate-400" size={24} />
              <p className="text-sm font-semibold text-slate-700">
                No hay órdenes {filters.scope === 'activas' ? 'activas' : 'en el historial'} para
                estos filtros.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Pruebe con otro nombre, estado o fecha de ingreso.
              </p>
            </div>
          )}
          <div className="divide-y divide-slate-200">
            {orders.map((order) => {
              const equipment = order.diagnostico?.equipo;
              const [stateLabel, stateClass] = estados[order.estado] || [
                order.estado || 'Sin estado',
                'border-slate-200 bg-slate-50 text-slate-600',
              ];
              const isOpen = panel?.id === order.id_orden;
              return (
                <article
                  key={order.id_orden}
                  aria-label={`Orden #${order.id_orden}`}
                  className={isOpen ? 'bg-indigo-50/30' : 'bg-white'}
                >
                  <div className="grid items-center gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(9rem,1fr)_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-indigo-700">#{order.id_orden}</span>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stateClass}`}
                        >
                          {stateLabel}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                        {equipment?.cliente?.nombre || 'Cliente sin nombre'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-700">
                        {[equipment?.tipo, equipment?.marca, equipment?.modelo]
                          .filter(Boolean)
                          .join(' ') || 'Equipo sin detalle'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Técnico: {order.tecnico?.nombre || 'Sin asignar'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        C${' '}
                        {Number(order.monto_autorizado || 0).toLocaleString('es-NI', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Autorizado · {fecha(order.fecha_ingreso)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`expediente-orden-${order.id_orden}`}
                      onClick={() => togglePanel(order.id_orden)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${isOpen ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700'}`}
                    >
                      {isOpen ? 'Cerrar expediente' : 'Ver expediente'}
                    </button>
                  </div>
                  {isOpen && (
                    <div
                      id={`expediente-orden-${order.id_orden}`}
                      className="mx-4 mb-4 rounded-xl border border-slate-200 bg-white p-3 sm:mx-5 sm:p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div
                          role="group"
                          aria-label={`Contenido de orden #${order.id_orden}`}
                          className="flex flex-wrap gap-1"
                        >
                          {[
                            ['details', 'Detalle'],
                            ['photos', 'Fotos'],
                            ['history', 'Historial de estados'],
                          ].map(([type, label]) => (
                            <button
                              key={type}
                              type="button"
                              aria-pressed={panel.type === type}
                              onClick={() => setPanel({ id: order.id_orden, type })}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${panel.type === type ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          aria-label="Cerrar expediente"
                          onClick={() => setPanel(null)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {panel.type === 'details' && (
                        <div className="space-y-3 text-xs text-slate-600">
                          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                              ['Ingreso', order.fecha_ingreso],
                              ['Inicio de reparación', order.fecha_inicio_reparacion],
                              ['Finalización', order.fecha_finalizacion],
                              ['Entrega', order.fecha_entrega],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <dt className="text-slate-500">{label}</dt>
                                <dd className="mt-1 font-semibold text-slate-800">
                                  {fecha(value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          {equipment?.numero_serie && (
                            <p>
                              Serie: <strong>{equipment.numero_serie}</strong>
                            </p>
                          )}
                          {order.motivo_cancelacion && (
                            <p className="rounded-lg bg-rose-50 p-2 text-rose-700">
                              Motivo de cancelación: {order.motivo_cancelacion}
                            </p>
                          )}
                          <div className="border-t border-slate-100 pt-3">
                            <h4 className="mb-2 font-semibold text-slate-800">
                              Repuestos solicitados
                            </h4>
                            {!order.repuestos_usados?.length && (
                              <p className="text-slate-500">No hay repuestos registrados.</p>
                            )}
                            {(order.repuestos_usados || []).map((part) => (
                              <div
                                key={part.id_detalle_repuesto}
                                className="mt-2 rounded-lg bg-slate-50 p-3"
                              >
                                <p className="font-semibold text-slate-700">
                                  {part.pieza_solicitada || part.repuesto?.nombre || 'Pieza'} ·{' '}
                                  {part.cantidad_usada || 1} · {part.estado_aprobacion}
                                </p>
                                <p className="mt-1">
                                  Solicitó: {part.tecnico_solicitante?.nombre || 'Sin registrar'} ·
                                  Revisó: {part.usuario_aprobador?.nombre_usuario || 'Pendiente'}
                                </p>
                                {part.motivo_rechazo && (
                                  <p className="mt-1 text-red-700">
                                    Motivo de rechazo: {part.motivo_rechazo}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {panel.type === 'photos' && (
                        <FotosServicio
                          kind="ordenes"
                          id={order.id_orden}
                          tipoInicial="FOTO_REPARACION"
                          readOnly
                          title="Fotos de la orden"
                        />
                      )}
                      {panel.type === 'history' &&
                        (history.loading ? (
                          <p role="status" className="text-xs text-slate-500">
                            Cargando historial…
                          </p>
                        ) : history.error ? (
                          <p role="alert" className="text-xs text-red-700">
                            {history.error}
                          </p>
                        ) : (
                          <HistorialEstados rows={history.rows} />
                        ))}
                      {!closedStates.includes(order.estado) && !order.facturas?.length && (
                        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => onCancel(order.id_orden)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Cancelar orden
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-5">
            <p className="text-xs text-slate-500">
              Página {filters.page} de {pages} · Hasta 10 órdenes por página
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={filters.page <= 1 || query.isFetching}
                onClick={() => updateFilters({ page: filters.page - 1 })}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                Anterior
              </button>
              <button
                type="button"
                disabled={filters.page >= pages || query.isFetching}
                onClick={() => updateFilters({ page: filters.page + 1 })}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40"
              >
                Siguiente
                <ChevronRight size={14} />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
