import React, { useEffect, useState, useMemo } from 'react';
import Table from '../../../components/Table';
import { reportesAdminService } from '../services';
import { downloadJsonExcel, downloadJsonPdf } from '../utils/csvExport';

// Estructura de columnas fija extraída fuera de la función del componente
const columns = [
  { header: 'Repuesto', accessor: 'repuesto' },
  { header: 'Categoría', accessor: 'categoria' },
  { header: 'Cantidad total', accessor: 'cantidad_total' },
  { header: 'Órdenes vinculadas', accessor: 'ordenes_donde_se_uso' },
  { header: 'Costo unitario', accessor: 'costo_unitario' },
  { header: 'Costo estimado total', accessor: 'costo_estimado_total' },
];

export default function RepuestosAvanzado() {
  const [report, setReport] = useState([]);
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
      const res = await reportesAdminService.getRepuestosUsados(queryString);
      const data = res.data?.data || [];
      
      setReport(
        data.map((item) => ({
          ...item,
          raw_costo_total: Number(item.costo_estimado_total) || 0,
          raw_cantidad: Number(item.cantidad_total) || 0,
          costo_unitario: item.costo_unitario ? `C$ ${Number(item.costo_unitario).toFixed(2)}` : 'C$ 0.00',
          costo_estimado_total: item.costo_estimado_total ? `C$ ${Number(item.costo_estimado_total).toFixed(2)}` : 'C$ 0.00',
        }))
      );
    } catch (err) {
      setError('No se pudo cargar el reporte de repuestos.');
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
      await downloadJsonExcel(report, columns, `repuestos_usados_${fromDate || 'desde'}_${toDate || 'hasta'}.xlsx`);
    } catch (err) {
      setError('No se pudo descargar el reporte.');
    } finally {
      setDownloading(false);
    }
  };

  const downloadReportPdf = async () => {
    setDownloading(true);
    try {
      downloadJsonPdf(report, columns, `repuestos_usados_${fromDate || 'desde'}_${toDate || 'hasta'}.pdf`, 'Repuestos usados');
    } catch (err) {
      setError('No se pudo descargar el reporte en PDF.');
    } finally {
      setDownloading(false);
    }
  };

  // Memorización de cálculos globales para el panel informativo superior
  const { totalInversion, totalPiezas } = useMemo(() => {
    return {
      totalInversion: report.reduce((acc, item) => acc + (item.raw_costo_total || 0), 0),
      totalPiezas: report.reduce((acc, item) => acc + (item.raw_cantidad || 0), 0),
    };
  }, [report]);

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      
      {/* Título e introducción */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Repuestos usados - administración avanzada</h1>
        <p className="text-gray-400 text-sm mt-0.5">Analiza el comportamiento financiero de las piezas sustituidas en el taller técnico.</p>
      </div>

      {/* Panel Superior Completo de Filtros */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-md">
            <h3 className="text-base font-bold text-slate-800">Parámetros del reporte</h3>
            <p className="text-xs text-gray-400 mt-0.5">Establece límites cronológicos precisos para el análisis de inventario aprobado.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 w-full xl:max-w-4xl items-end">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha de apertura</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
            
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha de cierre</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>

            {/* Grupo unificado de acción */}
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
                disabled={downloading || loading || report.length === 0}
                className="rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={downloadReportPdf}
                disabled={downloading || loading || report.length === 0}
                className="rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-white hover:bg-slate-900 transition shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400"
              >
                PDF
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Resumen de Totales */}
      {!loading && !error && report.length > 0 && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 animate-fadeIn">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Inversión Estimada</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">C$ {totalInversion.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Unidades Desplegadas</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalPiezas} repuestos</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 col-span-2 md:col-span-1">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Ítems Distintos</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{report.length}</p>
          </div>
        </div>
      )}

      {/* Contenedor Principal de la Tabla de Datos */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Desglose de uso de componentes</h2>
          <p className="text-sm text-gray-400">Listado métrico de inventario consolidado en base a órdenes ejecutadas.</p>
        </div>

        {loading && <div className="text-gray-400 text-center py-10 text-sm">Procesando registros en el servidor...</div>}
        {error && <div className="text-red-600 bg-red-50 p-4 rounded-xl text-sm font-semibold">{error}</div>}
        
        {!loading && !error && (
          <div className="overflow-x-auto">
            {report.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200 text-sm">
                No se encontraron registros de repuestos aprobados o utilizados en el rango de tiempo seleccionado.
              </div>
            ) : (
              <Table columns={columns} data={report} sortable />
            )}
          </div>
        )}
      </section>
      
    </div>
  );
}
