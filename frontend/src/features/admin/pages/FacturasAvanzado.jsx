import React, { useEffect, useState, useMemo } from 'react';
import Table from '../../../components/Table';
import { reportesAdminService } from '../services';
import { AdminStatCard } from '../components';

const columns = [
  { header: 'ID', accessor: 'id_factura' },
  { header: 'Orden', accessor: 'id_orden' },
  { 
    header: 'Fecha', 
    accessor: 'fecha_emision',
    render: (row) => row.fecha_emision ? new Date(row.fecha_emision).toLocaleDateString() : '-'
  },
  { header: 'Cliente', accessor: 'cliente' },
  { header: 'Equipo', accessor: 'equipo' },
  { header: 'Técnico', accessor: 'tecnico' },
  { 
    header: 'Total', 
    accessor: 'total',
    render: (row) => row.total ? `C$ ${Number(row.total).toFixed(2)}` : 'C$ 0.00'
  },
  { header: 'Método de Pago', accessor: 'metodo_pago' },
];

export default function FacturasAvanzado() {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Nuevo estado para la búsqueda global multiparámetro
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFacturas = async () => {
    setLoading(true);
    setError('');
    try {
      const query = [];
      if (fromDate) query.push(`fecha_inicio=${fromDate}`);
      if (toDate) query.push(`fecha_fin=${toDate}`);
      const res = await reportesAdminService.getFacturacion(query.join('&'));
      const data = res.data?.data || [];
      
      setFacturas(
        data.map((f) => ({
          id_factura: f.id_factura,
          id_orden: f.id_orden,
          fecha_emision: f.fecha_emision || null,
          cliente: f.cliente || '-',
          equipo: f.equipo || '-',
          tecnico: f.tecnico || '-',
          total: f.total ? Number(f.total) : 0, 
          metodo_pago: f.metodo_pago || '-',
        }))
      );
    } catch (err) {
      setError('No se pudo cargar la información de facturas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacturas();
  }, []);

  // Motor de filtrado en tiempo real en múltiples propiedades (Ignora mayúsculas y acentos)
  const facturasFiltradas = useMemo(() => {
    if (!searchTerm.trim()) return facturas;

    const normalizeText = (text) => 
      String(text || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const term = normalizeText(searchTerm);

    return facturas.filter((f) => {
      return (
        normalizeText(f.id_factura).includes(term) ||
        normalizeText(f.id_orden).includes(term) ||
        normalizeText(f.cliente).includes(term) ||
        normalizeText(f.equipo).includes(term) ||
        normalizeText(f.tecnico).includes(term) ||
        normalizeText(f.metodo_pago).includes(term)
      );
    });
  }, [facturas, searchTerm]);

  // Cálculos reactivos basados estrictamente en el array filtrado
  const totalFacturado = facturasFiltradas.reduce((acc, f) => acc + f.total, 0);
  const operacionesEfectivo = facturasFiltradas.filter(f => f.metodo_pago.toLowerCase().includes('efectivo')).length;
  const operationsDigital = facturasFiltradas.filter(f => ['transferencia', 'tarjeta'].includes(f.metodo_pago.toLowerCase())).length;

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      
      {/* Encabezado Principal */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Visualización y control de facturas</h1>
        <p className="text-gray-400 text-sm mt-0.5">Analiza los ingresos percibidos del taller por rangos de fecha y métodos de pago.</p>
      </div>

      {/* Grid Dinámico de KPIs Financieros */}
      {!loading && !error && facturas.length > 0 && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <AdminStatCard label="Total facturado (filtrado)" value={`C$ ${totalFacturado.toFixed(2)}`} tone="text-slate-900" />
          <AdminStatCard label="Facturas con método efectivo" value={`${operacionesEfectivo} facturas`} />
          <AdminStatCard label="Transferencia o tarjeta" value={`${operationsDigital} facturas`} className="col-span-2 md:col-span-1" />
        </div>
      )}

      {/* Tarjeta de Filtros y Tabla */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-6">
        
        {/* Barra de Filtros de Fecha e Input de Texto */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-gray-50 pb-4">
          <div className="shrink-0">
            <h2 className="text-lg font-bold text-slate-800">Parámetros de conciliación</h2>
            <p className="text-sm text-gray-400">Digita cualquier valor para buscar o acota los libros contables por fecha.</p>
          </div>
          
          <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3 w-full lg:w-auto">
            
            {/* Input de Búsqueda de Texto Abierto */}
            <div className="flex-1 lg:w-[280px]">
              <span className="text-xs font-bold text-gray-500 uppercase block">Búsqueda rápida</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ID, orden, cliente, técnico, pago..."
                className="mt-1 w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400"
              />
            </div>

            {/* Input Desde */}
            <div className="w-full md:w-[140px] shrink-0">
              <span className="text-xs font-bold text-gray-500 uppercase block">Desde</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Input Hasta */}
            <div className="w-full md:w-[140px] shrink-0">
              <span className="text-xs font-bold text-gray-500 uppercase block">Hasta</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            
            {/* Grupo de Acciones Rápidas */}
            <div className="flex gap-2 items-end w-full md:w-auto mt-2 md:mt-0">
              <button
                type="button"
                onClick={fetchFacturas}
                disabled={loading}
                className="flex-1 md:flex-none px-5 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm disabled:bg-slate-300 whitespace-nowrap"
              >
                Consultar
              </button>
          </div>
          </div>
        </div>

        {/* Control de Estados de Respuesta de la API */}
        {loading && <div className="text-gray-400 text-center py-10 text-sm">Conciliando extractos financieros...</div>}
        {error && <div className="text-red-600 bg-red-50 p-4 rounded-xl text-sm font-semibold">{error}</div>}
        
        {!loading && !error && (
          <div className="overflow-x-auto">
            {facturasFiltradas.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200 text-sm">
                {facturas.length === 0 
                  ? "No se encontraron facturas ni cobros registrados en el rango de fechas seleccionado."
                  : "No hay registros que coincidan con los términos de búsqueda ingresados."}
              </div>
            ) : (
              <Table columns={columns} data={facturasFiltradas} sortable />
            )}
          </div>
        )}
      </section>

    </div>
  );
}
