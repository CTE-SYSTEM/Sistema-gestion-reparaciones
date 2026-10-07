import React, { useEffect, useState } from 'react';
import Table from '../../../components/Table';
import { reportesAdminService } from '../services';
import { downloadJsonExcel, downloadJsonPdf } from '../utils/csvExport';

// Estructura estática extraída fuera del render para optimizar memoria
const columns = [
  { header: 'Estado', accessor: 'estado' },
  { header: 'Cantidad', accessor: 'cantidad' },
  { header: 'Normal', accessor: 'prioridad_normal' },
  { header: 'Alta', accessor: 'prioridad_alta' },
  { header: 'Urgente', accessor: 'prioridad_urgente' },
];

export default function OrdenesEstadoAvanzado() {
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
      const res = await reportesAdminService.getOrdenesEstado(queryString);
      setData(res.data?.data || []);
    } catch (err) {
      setError('No se pudo cargar el reporte de órdenes por estado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const downloadReportCsv = async () => {
    setDownloading(true);
    setError('');
    try {
      await downloadJsonExcel(data, columns, `ordenes_estado_${fromDate || 'desde'}_${toDate || 'hasta'}.xlsx`);
    } catch (err) {
      setError('No se pudo descargar el reporte.');
    } finally {
      setDownloading(false);
    }
  };

  const downloadReportPdf = async () => {
    setDownloading(true);
    setError('');
    try {
      downloadJsonPdf(data, columns, `ordenes_estado_${fromDate || 'desde'}_${toDate || 'hasta'}.pdf`, 'Órdenes por estado');
    } catch (err) {
      setError('No se pudo descargar el reporte en PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      
      {/* Encabezado Principal */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Órdenes por estado</h1>
        <p className="text-gray-400 text-sm mt-0.5">Observa cómo evolucionan las órdenes según su estado y prioridad.</p>
      </div>

      {/* Tarjeta de Filtros y Tabla */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-6">
        
        {/* Fila superior: Título del filtro e Inputs de Fecha */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-gray-50 pb-4">
          <div className="shrink-0">
            <h2 className="text-lg font-bold text-slate-800">Filtrar periodo</h2>
            <p className="text-sm text-gray-400">Ajusta el rango para ver las tendencias de estado.</p>
          </div>
          
          {/* Estructura Flex equilibrada para el manejo al milímetro de los anchos */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full lg:w-auto">
            
            {/* Input Desde */}
            <div className="w-full sm:w-[150px] shrink-0">
              <span className="text-xs font-bold text-gray-500 uppercase block tracking-wide">Desde</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Input Hasta */}
            <div className="w-full sm:w-[150px] shrink-0">
              <span className="text-xs font-bold text-gray-500 uppercase block tracking-wide">Hasta</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            
            {/* Grupo de Botones de Control Estilizados */}
            <div className="flex gap-2 items-end w-full sm:w-auto mt-2 sm:mt-0">
              <button
                type="button"
                onClick={fetchReport}
                disabled={loading}
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm disabled:bg-slate-300 whitespace-nowrap disabled:cursor-not-allowed"
              >
                Consultar
              </button>
              <button
                type="button"
                onClick={downloadReportCsv}
                disabled={downloading || loading || data.length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400 whitespace-nowrap"
                title="Exportar a Excel"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={downloadReportPdf}
                disabled={downloading || loading || data.length === 0}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-900 transition shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400 whitespace-nowrap"
                title="Exportar a PDF impreso"
              >
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Control de Estados de Respuesta de la API */}
        {loading && <div className="text-gray-400 text-center py-10 text-sm">Procesando métricas de órdenes...</div>}
        {error && <div className="text-red-600 bg-red-50 p-4 rounded-xl text-sm font-semibold">{error}</div>}
        
        {!loading && !error && (
          <div className="overflow-x-auto">
            {data.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200 text-sm">
                No se registraron movimientos de órdenes en el rango de fechas seleccionado.
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
