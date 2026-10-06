import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ClipboardList,
  Filter,
  HelpCircle,
  Laptop,
  Package,
  ReceiptText,
  Stethoscope,
  Tags,
  Truck,
  Users,
} from 'lucide-react';
import { GuidedTour, tourHighlightClass } from '../components/shared/GuidedTour';
import { getSecretariaDashboard } from '../services/dashboardService';

const EMPTY_STATS = {
  clientes: 0,
  equipos: 0,
  ordenes: 0,
  proveedores: 0,
  repuestos: 0,
  tiposRepuesto: 0,
  facturas: 0,
  diagnosticos: 0,
};

const filters = [
  { id: 'all', label: 'Todo' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'year', label: 'Año' },
];
const periodText = {
  all: 'Totales actuales',
  week: 'Creados esta semana',
  month: 'Creados este mes',
  year: 'Creados este año',
};

const tourSteps = [
  {
    target: 'summary',
    title: '1. Resumen del dashboard',
    text: 'Este encabezado muestra el estado general del módulo de Secretaría y el período que estás revisando.',
  },
  {
    target: 'filters',
    title: '2. Filtrar por período',
    text: 'Cambia entre todo, semana, mes o año para revisar actividad reciente sin salir del dashboard.',
  },
  {
    target: 'actions',
    title: '3. Entrar a módulos',
    text: 'Estas tarjetas abren clientes, equipos, diagnósticos, órdenes, repuestos, proveedores y facturación.',
  },
  {
    target: 'orders',
    title: '4. Revisar órdenes recientes',
    text: 'La tabla muestra las últimas órdenes para dar seguimiento rápido al trabajo del taller.',
  },
  {
    target: 'new-order',
    title: '5. Crear orden',
    text: 'Usa Nueva orden cuando ya tengas el diagnóstico listo y necesites iniciar el trabajo técnico.',
  },
];

const getOrderDate = (orden) => {
  const rawDate = orden?.fecha_ingreso || orden?.createdAt;
  if (!rawDate) return 0;
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const sortOrdenesRecientes = (ordenes = []) =>
  [...ordenes].sort((a, b) => {
    const dateDiff = getOrderDate(b) - getOrderDate(a);
    if (dateDiff !== 0) return dateDiff;
    return Number(b.id_orden || 0) - Number(a.id_orden || 0);
  });

const normalizeStats = (stats = {}) => ({
  clientes: Number(stats.clientes || 0),
  equipos: Number(stats.equipos || 0),
  ordenes: Number(stats.ordenes || 0),
  proveedores: Number(stats.proveedores || 0),
  repuestos: Number(stats.repuestos || 0),
  tiposRepuesto: Number(stats.tiposRepuesto || 0),
  facturas: Number(stats.facturas || 0),
  diagnosticos: Number(stats.diagnosticos || 0),
});

const SecretariaDashboard = () => {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [filteredOrdenes, setFilteredOrdenes] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getSecretariaDashboard(filterType);
        const dashboard = response.data?.data || {};

        setStats(normalizeStats(dashboard.stats));
        setFilteredOrdenes(sortOrdenesRecientes(dashboard.recentOrders || []).slice(0, 5));
      } catch (err) {
        console.error(err);
        setError('Ocurrió un problema al cargar el dashboard de Secretaría.');
        setStats(EMPTY_STATS);
        setFilteredOrdenes([]);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [filterType]);

  const quickActions = [
    { title: 'Clientes', value: stats.clientes, icon: Users, url: '/secretaria/clientes', color: 'bg-blue-600' },
    { title: 'Equipos', value: stats.equipos, icon: Laptop, url: '/secretaria/equipos', color: 'bg-cyan-600' },
    { title: 'Diagnóstico', value: stats.diagnosticos, icon: Stethoscope, url: '/secretaria/diagnostico', color: 'bg-purple-600' },
    { title: 'Órdenes', value: stats.ordenes, icon: ClipboardList, url: '/secretaria/nueva-orden', color: 'bg-indigo-600' },
    { title: 'Repuestos', value: stats.repuestos, icon: Package, url: '/secretaria/repuestos', color: 'bg-amber-600' },
    { title: 'Tipos Repuesto', value: stats.tiposRepuesto, icon: Tags, url: '/secretaria/tipos-repuesto', color: 'bg-violet-600' },
    { title: 'Proveedores', value: stats.proveedores, icon: Truck, url: '/secretaria/proveedores', color: 'bg-slate-700' },
    { title: 'Facturas', value: stats.facturas, icon: ReceiptText, url: '/secretaria/facturacion', color: 'bg-rose-600' },
  ];

  const activeTourTarget = showHelp ? tourSteps[tourStep].target : '';

  useEffect(() => {
    if (!showHelp || !activeTourTarget) return;

    const scrollTimer = window.setTimeout(() => {
      document
        .querySelector(`[data-tour-target="${activeTourTarget}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 80);

    return () => window.clearTimeout(scrollTimer);
  }, [activeTourTarget, showHelp]);

  const startTour = () => {
    setTourStep(0);
    setShowHelp(true);
  };

  const closeTour = () => {
    setShowHelp(false);
    setTourStep(0);
  };

  const handleTourNext = () => {
    if (tourStep === tourSteps.length - 1) {
      closeTour();
      return;
    }

    setTourStep((step) => step + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-4">
      {showHelp && (
        <GuidedTour
          steps={tourSteps}
          stepIndex={tourStep}
          onBack={() => setTourStep((step) => Math.max(step - 1, 0))}
          onClose={closeTour}
          onNext={handleTourNext}
        />
      )}

      {/* Encabezado Principal */}
      <div
        data-tour-target="summary"
        className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${tourHighlightClass(
          activeTourTarget === 'summary'
        )}`}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h1 className="m-0 text-xl font-bold text-gray-900 tracking-tight">Secretaría</h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Gestión operativa · {periodText[filterType]}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startTour}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-all"
            title="Iniciar tutorial guiado"
          >
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            <span>Ayuda</span>
          </button>

          <div
            data-tour-target="filters"
            className={`flex w-fit items-center rounded-lg border border-gray-200 bg-white p-1 shadow-xs ${tourHighlightClass(
              activeTourTarget === 'filters'
            )}`}
          >
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setFilterType(filter.id)}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                  filterType === filter.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 text-left">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          {error}
        </div>
      )}

      {/* Tarjetas de Acceso Rápido */}
      <section
        data-tour-target="actions"
        className={`grid gap-2.5 grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 ${tourHighlightClass(
          activeTourTarget === 'actions'
        )}`}
      >
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              to={action.url}
              className="group bg-white rounded-lg border border-gray-200 p-3 hover:shadow-xs transition-all hover:-translate-y-0.5 flex flex-col justify-between"
            >
              <div className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-white ${action.color} mb-2 shadow-xs`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-tight">
                  {loading ? '...' : action.value}
                </div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider text-left truncate mt-0.5">
                  {action.title}
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Tabla de Órdenes Recientes */}
      <section
        data-tour-target="orders"
        className={`bg-white rounded-lg border border-gray-200 p-4 shadow-xs ${tourHighlightClass(
          activeTourTarget === 'orders'
        )}`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="text-left">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              Últimas órdenes · {filters.find((filter) => filter.id === filterType)?.label}
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Órdenes generadas en el sistema técnico.
            </p>
          </div>
          <Link
            data-tour-target="new-order"
            to="/secretaria/nueva-orden"
            className={`inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs transition-all ${tourHighlightClass(
              activeTourTarget === 'new-order'
            )}`}
          >
            Nueva orden
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs text-gray-600">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 uppercase text-[9px] font-bold tracking-wider">
                <th className="px-3 py-2 border-b border-gray-100">Orden</th>
                <th className="px-3 py-2 border-b border-gray-100">Fecha</th>
                <th className="px-3 py-2 border-b border-gray-100">Cliente</th>
                <th className="px-3 py-2 border-b border-gray-100">Equipo</th>
                <th className="px-3 py-2 border-b border-gray-100">Técnico</th>
                <th className="px-3 py-2 border-b border-gray-100 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrdenes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-3 py-6 text-center text-gray-400 italic font-medium text-xs">
                    No se encontraron órdenes registradas en este período
                  </td>
                </tr>
              ) : (
                filteredOrdenes.map((orden) => (
                  <tr key={orden.id_orden} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-3 py-2 font-bold text-indigo-600">#{orden.id_orden}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {orden.fecha_ingreso ? new Date(orden.fecha_ingreso).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-800">
                      {orden.diagnostico?.equipo?.cliente?.nombre || 'General'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {[orden.diagnostico?.equipo?.marca, orden.diagnostico?.equipo?.modelo].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {orden.tecnico?.nombre || 'Sin asignar'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black border ${
                          orden.estado === 'FINALIZADO'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}
                      >
                        {(orden.estado || 'PENDIENTE').replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default SecretariaDashboard;
