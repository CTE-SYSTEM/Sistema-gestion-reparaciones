import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Table from '../../../components/Table';
import MetricBarChart from '../components/MetricBarChart';
import { dashboardService } from '../services';

const formatCurrency = (value) => `C$ ${Number(value || 0).toFixed(2)}`;

const summaryCards = [
  { title: 'Equipos', key: 'equipos', color: 'bg-sky-50 text-sky-700 border-sky-100' },
  { title: 'Repuestos', key: 'repuestos', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { title: 'Órdenes', key: 'ordenes', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { title: 'Facturas', key: 'facturas', color: 'bg-orange-50 text-orange-700 border-orange-100' },
  { title: 'Usuarios', key: 'usuarios', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100' },
  { title: 'Diagnósticos pendientes', key: 'diagnosticosPendientes', color: 'bg-rose-50 text-rose-700 border-rose-100' },
  { title: 'Órdenes en reparación', key: 'ordenesEnReparacion', color: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
];

const latestOrdersColumns = [
  { header: 'ID', accessor: 'id_orden' },
  { header: 'Cliente', accessor: 'cliente' },
  { header: 'Equipo', accessor: 'equipo' },
  { header: 'Estado', accessor: 'estado' },
  { header: 'Técnico', accessor: 'tecnico' },
  { header: 'Ingreso', accessor: 'fecha_ingreso' },
];

const upcomingGarantiasColumns = [
  { header: 'Garantía', accessor: 'id_garantia' },
  { header: 'Factura', accessor: 'factura_id' },
  { header: 'Orden', accessor: 'orden_id' },
  { header: 'Cliente', accessor: 'cliente' },
  { header: 'Equipo', accessor: 'equipo' },
  { header: 'Vence', accessor: 'fecha_vencimiento' },
];

const equiposPreviewColumns = [
  { header: 'ID', accessor: 'id_equipo' },
  { header: 'Cliente', accessor: 'cliente' },
  { header: 'Equipo', accessor: 'equipo' },
  { header: 'Estado', accessor: 'estado' },
];

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [equiposPreview, setEquiposPreview] = useState([]);
  const [productividad, setProductividad] = useState(null);
  const [ganancias, setGanancias] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');


  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const [res, equiposRes, productividadRes, gananciasRes] = await Promise.all([
          dashboardService.getDashboard(),
          dashboardService.getEquipos(),
          dashboardService.getProductividad(),
          dashboardService.getGanancias({ fecha_inicio: monthStart, fecha_fin: monthEnd, detalle_limite: 5 }),
        ]);

        const data = res.data;
        if (data.data) {
          setDashboard(data.data);
          setProductividad(productividadRes.data?.data || null);
          setGanancias(gananciasRes.data?.data || null);
          setEquiposPreview(
            (equiposRes.data?.data || []).slice(0, 6).map((equipo) => ({
              id_equipo: equipo.id_equipo,
              cliente: equipo.cliente?.nombre || '-',
              equipo: [equipo.marca, equipo.modelo].filter(Boolean).join(' ') || equipo.tipo || '-',
              estado: equipo.diagnosticos?.[0]?.estado_del_diagnostico || '-',
            }))
          );
        } else {
          setError('No se pudo cargar el panel de administración');
        }
      } catch {
        setError('Error de red o servidor');
      }
      setLoading(false);
    };

    fetchDashboard();
  }, []);

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      
      {/* Encabezado Principal */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Panel avanzado de administración</h1>
        <p className="text-gray-400 text-sm mt-0.5">Accede rápidamente a los principales indicadores de la empresa.</p>
      </div>

      {/* Estados de Carga y Error */}
      {loading && (
        <div className="rounded-2xl bg-white p-6 shadow-sm text-gray-400 text-center">
          Cargando datos del panel...
        </div>
      )}
      {error && (
        <div className="rounded-2xl bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {/* Banner Informativo / Ayuda */}


      {/* Contenido del Dashboard */}
      {dashboard && (
        <>
          {/* Tarjetas de Métricas Globales */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div key={card.key} className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[140px]">
                <div className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border ${card.color}`}>
                  {card.title}
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900">{dashboard.totals[card.key] ?? 0}</span>
                  <span className="text-xs font-medium text-gray-400">totales</span>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen Financiero */}
          <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Resumen financiero del mes</h2>
                <p className="text-sm text-gray-400">Acceso rápido a ganancias, rentabilidad y pérdidas reales.</p>
              </div>
              <Link
                to="/admin/ganancias"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
              >
                Ver ganancias
              </Link>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: 'Ganancia neta', value: formatCurrency(ganancias?.totals?.ganancia_neta), tone: 'text-indigo-600' },
                { label: 'Rentabilidad', value: `${Number(ganancias?.totals?.rentabilidad_porcentaje || 0).toFixed(1)}%`, tone: 'text-emerald-600' },
                { label: 'Ordenes facturadas', value: ganancias?.totals?.ordenes_procesadas || 0, tone: 'text-slate-900' },
                { label: 'Perdidas reales', value: formatCurrency(ganancias?.totals?.perdidas_reales), tone: 'text-red-600' },
                { label: 'Compras inventario', value: formatCurrency(ganancias?.totals?.compras_inventario), tone: 'text-sky-600' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-gray-100 bg-slate-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{item.label}</p>
                  <p className={`mt-1 text-xl font-extrabold ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Alertas Financieras */}
            {(ganancias?.alertas || []).length > 0 && (
              <div className="grid gap-3 lg:grid-cols-3">
                {ganancias.alertas.slice(0, 3).map((alerta) => (
                  <div key={`${alerta.titulo}-${alerta.detalle}`} className={`rounded-xl border p-3 ${alerta.nivel === 'alto' ? 'border-red-100 bg-red-50 text-red-800' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>
                    <p className="text-xs font-black uppercase">{alerta.titulo}</p>
                    <p className="mt-1 text-xs font-semibold">{alerta.detalle}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {[['Centro de reportes', 'Elige una categoría, consulta y descarga los resultados.', '/admin/reportes'], ['Administración', 'Cuenta, usuarios, negocio, reglas y auditoría.', '/admin/administracion'], ['Respaldos', 'Crea copias y configura su programación.', '/admin/respaldos']].map(([title, description, path]) => <Link key={path} to={path} className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm transition hover:border-indigo-300"><h2 className="font-bold text-indigo-700">{title}</h2><p className="mt-2 text-sm text-slate-500">{description}</p></Link>)}
          </section>

          {/* Gráficas de Productividad */}
          <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Productividad mensual y anual</h2>
                <p className="text-sm text-gray-400">Compara diagnósticos, órdenes cerradas y facturación del equipo técnico.</p>
              </div>
              <Link
                to="/admin/tecnicos"
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                Ver técnicos
              </Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-indigo-500">
                  Mes a mes {productividad?.year || ''}
                </p>
                <MetricBarChart
                  data={(productividad?.monthly || []).map((item) => ({
                    ...item,
                    etiqueta: item.etiqueta || item.mes,
                  }))}
                  labelKey="etiqueta"
                  series={[
                    { key: 'diagnosticos', label: 'Diagnósticos', color: '#4f46e5' },
                    { key: 'ordenes_finalizadas', label: 'Órdenes cerradas', color: '#059669' },
                  ]}
                />
              </div>

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-500">
                  Resumen anual
                </p>
                <MetricBarChart
                  data={(productividad?.yearly || []).map((item) => ({
                    ...item,
                    etiqueta: String(item.anio),
                  }))}
                  labelKey="etiqueta"
                  series={[
                    { key: 'diagnosticos', label: 'Diagnósticos', color: '#4f46e5' },
                    { key: 'ordenes_finalizadas', label: 'Órdenes cerradas', color: '#059669' },
                  ]}
                />
              </div>
            </div>
          </section>

          {/* Grid de Tablas de Monitoreo */}
          <div className="grid gap-6 lg:grid-cols-2">
            
            {/* Órdenes Recientes */}
            <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-800">Órdenes recientes</h2>
                <p className="text-sm text-gray-400">Las últimas 5 órdenes registradas en el sistema.</p>
              </div>
              <div className="overflow-x-auto">
                <Table columns={latestOrdersColumns} data={dashboard.latestOrders} sortable />
              </div>
            </section>

            {/* Vista Previa de Equipos */}
            <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Vista previa de equipos</h2>
                  <p className="text-sm text-gray-400">Equipos pendientes de revisión en taller.</p>
                </div>
                <Link
                  to="/admin/equipos"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Ver todos
                </Link>
              </div>
              <div className="overflow-x-auto">
                <Table columns={equiposPreviewColumns} data={equiposPreview} sortable />
              </div>
            </section>

            {/* Garantías por Vencer */}
            <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 lg:col-span-2">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-800">Garantías por vencer</h2>
                <p className="text-sm text-gray-400">Alertas de garantías que expiran en los próximos {dashboard.garantiaAvisoDias || 30} días.</p>
              </div>
              <div className="overflow-x-auto">
                <Table columns={upcomingGarantiasColumns} data={dashboard.upcomingGarantias} sortable />
              </div>
            </section>
          </div>

          {/* Módulos de Acceso Rápido */}
          <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Módulos de acceso rápido</h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
              <Link to="/admin/usuarios" className="rounded-xl border border-gray-200 bg-slate-50 p-3.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition">Usuarios</Link>
              <Link to="/admin/equipos" className="rounded-xl border border-gray-200 bg-slate-50 p-3.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition">Equipos</Link>
              <Link to="/admin/ordenes" className="rounded-xl border border-gray-200 bg-slate-50 p-3.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition">Órdenes</Link>
              <Link to="/admin/repuestos" className="rounded-xl border border-gray-200 bg-slate-50 p-3.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition">Repuestos</Link>
              <Link to="/admin/compras" className="rounded-xl border border-gray-200 bg-slate-50 p-3.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition">Compras</Link>
              <Link to="/admin/ganancias" className="rounded-xl border border-gray-200 bg-slate-50 p-3.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition">Ganancias</Link>
              <Link to="/admin/tecnicos" className="rounded-xl border border-gray-200 bg-slate-50 p-3.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition">Técnicos</Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
