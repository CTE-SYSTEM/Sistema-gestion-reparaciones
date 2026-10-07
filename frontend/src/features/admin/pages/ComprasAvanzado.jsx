import React, { useEffect, useState } from 'react';
import Table from '../../../components/Table';
import { reportesAdminService } from '../services';
import { downloadJsonExcel, downloadJsonPdf } from '../utils/csvExport';

const columns = [
  { header: 'Compra', accessor: 'id_compra' },
  { header: 'Fecha', accessor: 'fecha_obtencion' },
  { header: 'Proveedor', accessor: 'proveedor' },
  { header: 'Repuesto', accessor: 'repuesto' },
  { header: 'Documento', accessor: 'documento' },
  { header: 'Cantidad', accessor: 'cantidad' },
  { header: 'Costo unitario', accessor: 'costo_unitario' },
  { header: 'Costo total', accessor: 'costo_total' },
  { header: 'Pago', accessor: 'metodo_pago' },
];

export default function ComprasAvanzado() {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [downloading, setDownloading] = useState(false);

  const fetchCompras = async () => {
    setLoading(true);
    setError('');
    try {
      const query = [];
      if (fromDate) query.push(`fecha_inicio=${fromDate}`);
      if (toDate) query.push(`fecha_fin=${toDate}`);
      const res = await reportesAdminService.getCompras(query.join('&'));
      const data = res.data?.data || [];
      
      setCompras(
        data.map((item) => ({
          ...item,
          raw_costo_total: Number(item.costo_total) || 0,
          raw_cantidad: Number(item.cantidad) || 0,
          fecha_obtencion: item.fecha_obtencion ? new Date(item.fecha_obtencion).toLocaleDateString() : '-',
          costo_unitario: item.costo_unitario ? `C$ ${Number(item.costo_unitario).toFixed(2)}` : 'C$ 0.00',
          costo_total: item.costo_total ? `C$ ${Number(item.costo_total).toFixed(2)}` : 'C$ 0.00',
        }))
      );
    } catch (err) {
      setError('No se pudo cargar las compras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompras();
  }, []);

  const downloadComprasCsv = async () => {
    setDownloading(true);
    try {
      await downloadJsonExcel(compras, columns, `compras_${fromDate || 'desde'}_${toDate || 'hasta'}.xlsx`);
    } catch (err) {
      setError('No se pudo descargar el reporte de compras.');
    } finally {
      setDownloading(false);
    }
  };

  const downloadComprasPdf = async () => {
    setDownloading(true);
    try {
      downloadJsonPdf(compras, columns, `compras_${fromDate || 'desde'}_${toDate || 'hasta'}.pdf`, 'Reporte de Compras');
    } catch (err) {
      setError('No se pudo descargar el reporte en PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const totalInversion = compras.reduce((total, item) => total + (item.raw_costo_total || 0), 0);
  const totalArticulos = compras.reduce((total, item) => total + (item.raw_cantidad || 0), 0);

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      
      {/* Encabezado Principal */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Compras y proveedores</h1>
        <p className="text-gray-400 text-sm mt-0.5">Monitorea la adquisición de repuestos, gestión de comprobantes y flujo de caja con proveedores.</p>
      </div>

      {/* Panel Unificado de Filtros de Búsqueda */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-md">
            <h3 className="text-base font-bold text-slate-800">Rango de búsqueda</h3>
            <p className="text-xs text-gray-400 mt-0.5">Segmenta las facturas y órdenes de compra según su fecha de ingreso.</p>
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

            {/* Grupo de Botones de Control */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={fetchCompras}
                disabled={loading}
                className="rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm disabled:bg-slate-300"
              >
                Consultar
              </button>
              <button
                type="button"
                onClick={downloadComprasCsv}
                disabled={downloading || compras.length === 0}
                className="rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={downloadComprasPdf}
                disabled={downloading || compras.length === 0}
                className="rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-white hover:bg-slate-900 transition shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400"
              >
                PDF
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Grid Dinámico de KPIs */}
      {!loading && !error && compras.length > 0 && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Egreso Total</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">C$ {totalInversion.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Unidades Adquiridas</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalArticulos} piezas</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 col-span-2 md:col-span-1">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Transacciones</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{compras.length} facturas</p>
          </div>
        </div>
      )}

      {/* Tabla de Registros */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Historial de adquisiciones</h2>
          <p className="text-sm text-gray-400">Auditoría detallada de repuestos ingresados al inventario general.</p>
        </div>

        {loading && <div className="text-gray-400 text-center py-10 text-sm">Consultando registros de compras...</div>}
        {error && <div className="text-red-600 bg-red-50 p-4 rounded-xl text-sm font-semibold">{error}</div>}
        
        {!loading && !error && (
          <div className="overflow-x-auto">
            {compras.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200 text-sm">
                No se encontraron compras documentadas en el periodo seleccionado.
              </div>
            ) : (
              <Table columns={columns} data={compras} sortable />
            )}
          </div>
        )}
      </section>

    </div>
  );
}
