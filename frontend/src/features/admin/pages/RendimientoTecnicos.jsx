import React, { useEffect, useState, useMemo } from 'react';
import Table from '../../../components/Table';
import { reportesAdminService } from '../services';
import { downloadJsonExcel, downloadJsonPdf } from '../utils/csvExport';

// Estructura estática de columnas extraída del renderizado para evitar consumo innecesario de memoria
const columns = [
  { header: 'Técnico', accessor: 'tecnico' },
  { header: 'Diagnósticos asignados', accessor: 'diagnosticos_asignados' },
  { header: 'Diagnósticos completados', accessor: 'diagnosticos_completados' },
  { header: 'Órdenes asignadas', accessor: 'ordenes_asignadas' },
  { header: 'Órdenes finalizadas', accessor: 'ordenes_finalizadas' },
  { header: 'Total facturado', accessor: 'total_facturado' },
];

export default function RendimientoTecnicos() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [downloading, setDownloading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('fecha_inicio', fromDate);
      if (toDate) params.append('fecha_fin', toDate);

      const queryString = params.toString();
      const res = await reportesAdminService.getTecnicos(queryString);
      const reportData = res.data?.data || [];
      
      setData(
        reportData.map((item) => ({
          ...item,
          raw_facturado: Number(item.total_facturado) || 0,
          raw_completadas: Number(item.ordenes_finalizadas) || 0,
          total_facturado: item.total_facturado ? `C$ ${Number(item.total_facturado).toFixed(2)}` : 'C$ 0.00',
        }))
      );
    } catch (err) {
      setError('No se pudo cargar el reporte de rendimiento de técnicos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const downloadReportCsv = async () => {
    setDownloading(true);
    try {
      await downloadJsonExcel(data, columns, `rendimiento_tecnicos_${fromDate || 'desde'}_${toDate || 'hasta'}.xlsx`);
    } catch (err) {
      setError('No se pudo descargar el reporte.');
    } finally {
      setDownloading(false);
    }
  };

  const downloadReportPdf = async () => {
    setDownloading(true);
    try {
      downloadJsonPdf(data, columns, `rendimiento_tecnicos_${fromDate || 'desde'}_${toDate || 'hasta'}.pdf`, 'Rendimiento de técnicos');
    } catch (err) {
      setError('No se pudo descargar el reporte en PDF.');
    } finally {
      setDownloading(false);
    }
  };

  // Reducción y cálculos optimizados mediante memorización de dependencias
  const { facturacionGlobal, totalOrdenesCerradas } = useMemo(() => {
    return {
      facturacionGlobal: data.reduce((acc, item) => acc + (item.raw_facturado || 0), 0),
      totalOrdenesCerradas: data.reduce((acc, item) => acc + (item.raw_completadas || 0), 0)
    };
  }, [data]);

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      
      {/* Encabezado Principal */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Rendimiento de técnicos</h1>
        <p className="text-gray-400 text-sm mt-0.5">Evalúa y analiza la productividad, diagnósticos completados y volumen de facturación por técnico.</p>
      </div>

      {/* Panel Unificado de Filtros de Periodo */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-md">
            <h3 className="text-base font-bold text-slate-800">Filtrar por periodo</h3>
            <p className="text-xs text-gray-400 mt-0.5">Consulta la carga de trabajo y el rendimiento por intervalos de fecha específicos.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 w-full xl:max-w-4xl items-end">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Desde</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
            
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hasta</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>

            {/* Grupo de Botones de Control de Reportes */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={fetchReport}
                disabled={loading}
                className="rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Consultar
              </button>
              <button
                type="button"
                onClick={downloadReportCsv}
                disabled={downloading || loading || data.length === 0}
                className="rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={downloadReportPdf}
                disabled={downloading || loading || data.length === 0}
                className="rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-white hover:bg-slate-900 transition shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400"
              >
                PDF
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Resumen de Productividad General */}
      {!loading && !error && data.length > 0 && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 animate-fadeIn">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Facturación de Taller</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">C$ {facturacionGlobal.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Órdenes Finalizadas</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalOrdenesCerradas} servicios</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 col-span-2 md:col-span-1">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Personal Evaluado</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{data.length} técnicos</p>
          </div>
        </div>
      )}

      {/* Contenedor Principal de la Tabla de Rendimiento */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Métricas individuales del equipo</h2>
          <p className="text-sm text-gray-400">Comparativa analítica del volumen de diagnósticos y cierres por personal técnico.</p>
        </div>

        {loading && <div className="text-gray-400 text-center py-10 text-sm">Procesando rendimiento de personal...</div>}
        {error && <div className="text-red-600 bg-red-50 p-4 rounded-xl text-sm font-semibold">{error}</div>}
        
        {!loading && !error && (
          <div className="overflow-x-auto">
            {data.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200 text-sm">
                No se registraron movimientos o asignaciones para los técnicos en las fechas seleccionadas.
              </div>
            ) : (
              <Table columns={columns} data={data} sortable />
            )}
          </div>
        )}
      </section>

    </div>
  );
}
