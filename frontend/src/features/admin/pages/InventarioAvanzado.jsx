import React, { useEffect, useState, useMemo } from 'react';
import Table from '../../../components/Table';
import { downloadJsonExcel, downloadJsonPdf } from '../utils/csvExport';
import { inventarioAdminService, reportesAdminService } from '../services';

// Estructura estática extraída fuera del render para optimizar memoria
const columns = [
  { header: 'ID', accessor: 'id_repuesto' },
  { header: 'Repuesto', accessor: 'repuesto' },
  { header: 'Categoría', accessor: 'categoria' },
  { header: 'Entradas', accessor: 'cantidad_comprada' },
  { header: 'Salidas', accessor: 'cantidad_usada' },
  { header: 'Stock actual', accessor: 'stock_estimado' },
  { header: 'Último costo', accessor: 'ultimo_costo' },
  { header: 'Historial', accessor: 'historial' },
  {
    header: 'Acciones',
    accessor: 'acciones',
    render: (row) => (
      <button
        type="button"
        onClick={row.onViewHistory}
        className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700 shadow-sm"
      >
        Ver historial
      </button>
    ),
  },
];

const historialColumns = [
  { header: 'Fecha instalación', accessor: 'fecha_instalacion' },
  { header: 'Equipo / Dispositivo', accessor: 'equipo' },
  { header: 'Cliente asignado', accessor: 'cliente' },
  { header: 'Número de Orden', accessor: 'orden' },
];

const fetchInventario = async (setRepuestos, setLoading, setError) => {
  setLoading(true);
  setError('');
  try {
    const res = await reportesAdminService.getInventario();
    const data = res.data;
    if (data.data) {
      setRepuestos(
        data.data.map((r) => ({
          id_repuesto: r.id_repuesto,
          repuesto: r.repuesto || '-',
          categoria: r.categoria || '-',
          cantidad_comprada: r.cantidad_comprada ?? 0,
          cantidad_usada: r.cantidad_usada ?? 0,
          stock_estimado: r.stock_estimado ?? 0,
          ultimo_costo: r.ultimo_costo ? `C$ ${Number(r.ultimo_costo).toFixed(2)}` : 'C$ 0.00',
          historial: `${r.cantidad_usada || 0} salidas`,
          raw_stock: Number(r.stock_estimado) || 0,
          raw_usos: Number(r.cantidad_usada) || 0,
          raw: r,
        }))
      );
    } else {
      setError('No se pudo cargar el inventario');
    }
  } catch (e) {
    setError('Error de red o servidor al intentar conectar.');
  } finally {
    setLoading(false);
  }
};

export default function InventarioAvanzado() {
  const [repuestos, setRepuestos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRepuesto, setSelectedRepuesto] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchInventario(setRepuestos, setLoading, setError);
  }, []);

  const downloadInventoryCsv = async () => {
    setDownloading(true);
    try {
      await downloadJsonExcel(repuestos, columns, 'inventario_repuestos.xlsx');
    } catch (err) {
      setError('No se pudo descargar el reporte de inventario.');
    } finally {
      setDownloading(false);
    }
  };

  const downloadInventoryPdf = async () => {
    setDownloading(true);
    try {
      downloadJsonPdf(repuestos, columns, 'inventario_repuestos.pdf', 'Inventario de repuestos');
    } catch (err) {
      setError('No se pudo descargar el reporte de inventario en PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleViewHistory = async (repuesto) => {
    setSelectedRepuesto(repuesto);
    setHistoryLoading(true);
    setHistoryError('');
    setHistorial([]);

    try {
      const res = await inventarioAdminService.getHistorialRepuesto(repuesto.id_repuesto);
      const data = res.data?.data || [];
      setHistorial(
        data.map((item) => ({
          fecha_instalacion: item.fecha_instalacion ? new Date(item.fecha_instalacion).toLocaleString() : '-',
          equipo: item.orden?.diagnostico?.equipo?.modelo || '-',
          cliente: item.orden?.diagnostico?.equipo?.cliente?.nombre || '-',
          orden: item.orden_id || '-',
        }))
      );
    } catch (err) {
      setHistoryError('No se pudo cargar el historial de este repuesto.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Filtrado optimizado de componentes
  const filteredRepuestos = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return repuestos;
    return repuestos.filter((repuesto) => 
      [repuesto.id_repuesto, repuesto.repuesto, repuesto.categoria, repuesto.stock_estimado, repuesto.ultimo_costo, repuesto.historial].some((field) => 
        field?.toString().toLowerCase().includes(term)
      )
    );
  }, [searchText, repuestos]);

  // Inyección segura de callbacks para las acciones de la tabla
  const repuestosWithActions = useMemo(() => (
    filteredRepuestos.map((repuesto) => ({
      ...repuesto,
      onViewHistory: () => handleViewHistory(repuesto),
    }))
  ), [filteredRepuestos]);

  // KPIs consolidados de la parte superior
  const { totalItemsDistintos, totalStockDisponible, totalUsosHistoricos } = useMemo(() => ({
    totalItemsDistintos: repuestos.length,
    totalStockDisponible: repuestos.reduce((acc, item) => acc + item.raw_stock, 0),
    totalUsosHistoricos: repuestos.reduce((acc, item) => acc + item.raw_usos, 0),
  }), [repuestos]);

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      
      {/* Encabezado Principal */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Control avanzado de inventario</h1>
        <p className="text-gray-400 text-sm mt-0.5">Monitorea niveles de existencias, costos de adquisición y la trazabilidad de uso de cada pieza.</p>
      </div>

      {/* Grid Dinámico de KPIs de Inventario */}
      {!loading && !error && repuestos.length > 0 && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Variedad de Repuestos</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalItemsDistintos} ítems</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Existencias Totales</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalStockDisponible} unidades</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 col-span-2 md:col-span-1">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Salidas / Usos Totales</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalUsosHistoricos} colocaciones</p>
          </div>
        </div>
      )}

      {/* Sección General del Catálogo de Repuestos */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-gray-50 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Disponibilidad física de almacén</h2>
            <p className="text-sm text-gray-400">Balance calculado a partir de facturas de proveedores y órdenes cerradas.</p>
          </div>
          
          {/* Controles de Búsqueda y Descarga Unificados */}
          <div className="flex flex-col gap-2 sm:flex-row w-full lg:w-auto">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscador inteligente: ID, repuesto, categoria, stock, costo o uso..."
              className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-64"
            />
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={downloadInventoryCsv}
                disabled={downloading || loading || repuestos.length === 0}
                className="w-full sm:w-auto rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={downloadInventoryPdf}
                disabled={downloading || loading || repuestos.length === 0}
                className="w-full sm:w-auto rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 transition shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400"
              >
                Generar Reporte General
              </button>
            </div>
          </div>
        </div>

        {/* Control de Estados de Carga y Tablas */}
        {loading && <div className="text-gray-400 text-center py-10 text-sm">Sincronizando existencias de repuestos...</div>}
        {error && <div className="text-red-600 bg-red-50 p-4 rounded-xl text-sm font-semibold">{error}</div>}
        
        {!loading && !error && (
          <div className="overflow-x-auto">
            {filteredRepuestos.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200 text-sm">
                No se encontraron componentes que coincidan con los términos de búsqueda introducidos.
              </div>
            ) : (
              <Table columns={columns} data={repuestosWithActions} sortable />
            )}
          </div>
        )}
      </section>

      {/* Panel Inferior: Historial Detallado del Componente Seleccionado */}
      {selectedRepuesto && (
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between border-b border-gray-50 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">Historial de {selectedRepuesto.repuesto}</h3>
                <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600">
                  Stock actual: {selectedRepuesto.stock_estimado} ud
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">Asignaciones directas del componente técnico a dispositivos reparados.</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRepuesto(null)}
              className="text-gray-400 hover:text-slate-600 text-xl font-semibold px-2 transition"
              title="Cerrar panel de historial"
            >
              &times;
            </button>
          </div>

          {historyLoading && <div className="text-gray-400 text-center py-8 text-sm">Rastreando órdenes vinculadas...</div>}
          {historyError && <div className="text-red-600 bg-red-50 p-4 rounded-xl text-sm font-semibold">{historyError}</div>}
          
          {!historyLoading && !historyError && (
            <div className="overflow-x-auto">
              {historial.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200 text-sm">
                  Este repuesto está registrado en el inventario pero no se ha instalado en ningún equipo hasta la fecha.
                </div>
              ) : (
                <Table columns={historialColumns} data={historial} sortable />
              )}
            </div>
          )}
        </section>
      )}
      
    </div>
  );
}
