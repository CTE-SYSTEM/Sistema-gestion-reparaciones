import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Table from '../../../components/Table';
import { reportesAdminService } from '../services';
import { Search } from 'lucide-react';

const COLUMNS = [
  { header: 'Cliente', accessor: 'cliente' },
  { header: 'Teléfono', accessor: 'telefono' },
  { header: 'Equipos', accessor: 'total_equipos' },
  { header: 'Diagnósticos', accessor: 'total_diagnosticos' },
  { header: 'Órdenes', accessor: 'total_ordenes' },
  { header: 'Última visita', accessor: 'ultima_visita' },
];

export default function ClientesAvanzado() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados para el buscador multiparámetro
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParam, setSearchParam] = useState('global'); // 'global', 'cliente', 'telefono'

  // Petición de datos a la API
  const fetchClientes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportesAdminService.getClientesEquipos();
      const data = res.data?.data || [];
      
      const formateados = data.map((item) => ({
        ...item,
        raw_equipos: Number(item.total_equipos) || 0,
        raw_ordenes: Number(item.total_ordenes) || 0,
        ultima_visita: item.ultima_visita 
          ? new Date(item.ultima_visita).toLocaleDateString() 
          : '-',
      }));
      
      setClientes(formateados);
    } catch (err) {
      setError('No se pudo cargar la información de clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  // Lógica de filtrado multiparámetro (Optimizada con useMemo)
  const clientesFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return clientes;

    const normalizeText = (text) => 
      String(text || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const term = normalizeText(searchTerm);

    return clientes.filter((item) => {
      const clienteMatch = normalizeText(item.cliente).includes(term);
      const telefonoMatch = normalizeText(item.telefono).includes(term);

      if (searchParam === 'cliente') return clienteMatch;
      if (searchParam === 'telefono') return telefonoMatch;
      
      // 'global' -> Busca en cualquiera de los dos campos
      return clienteMatch || telefonoMatch;
    });
  }, [clientes, searchTerm, searchParam]);

  // Cálculos derivados del estado en tiempo real (basados en los datos filtrados)
  const totalEquiposGarantia = clientesFiltrados.reduce((total, item) => total + (item.raw_equipos || 0), 0);
  const totalOrdenesAsignadas = clientesFiltrados.reduce((total, item) => total + (item.raw_ordenes || 0), 0);

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      
      {/* Encabezado Principal */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Clientes y equipos</h1>
        <p className="text-gray-400 text-sm mt-0.5">Identifica clientes clave, volumen de dispositivos ingresados y la última actividad registrada en el centro.</p>
      </div>

      {/* Grid Dinámico de KPIs */}
      {!loading && !error && clientes.length > 0 && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Base de Clientes</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{clientesFiltrados.length} usuarios</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Historial de Equipos</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalEquiposGarantia} unidades</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 col-span-2 md:col-span-1">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Servicios Vinculados</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalOrdenesAsignadas} órdenes</p>
          </div>
        </div>
      )}

      {/* Contenedor Principal de la Tabla */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
        
        {/* Barra de herramientas y búsqueda */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-gray-50 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Resumen de clientes</h2>
            <p className="text-sm text-gray-400">Auditoría de activos, diagnósticos parciales y flujos de trabajo.</p>
          </div>

          {/* Bloque de Búsqueda y Filtros */}
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <div className="flex flex-1 items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 focus-within:border-indigo-500 focus-within:bg-white transition">
              <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <select
                value={searchParam}
                onChange={(e) => setSearchParam(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-600 outline-none cursor-pointer border-r border-gray-200 pr-2 mr-1 h-full"
              >
                <option value="global">Todo</option>
                <option value="cliente">Cliente</option>
                <option value="telefono">Teléfono</option>
              </select>
              <input
                type="search"
                aria-label="Buscar clientes"
                placeholder={searchParam === 'cliente' ? 'Buscar por nombre del cliente...' : searchParam === 'telefono' ? 'Buscar por teléfono...' : 'Buscar cliente o teléfono...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-700 outline-none"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="text-gray-400 hover:text-gray-600 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>
            
          </div>
        </div>

        {/* Estados Dinámicos: Carga, Error o Tabla */}
        {loading && (
          <div className="text-gray-400 text-center py-10 text-sm">
            Procesando registros de la cartera...
          </div>
        )}
        
        {error && (
          <div className="text-red-600 bg-red-50 p-4 rounded-xl text-sm font-semibold">
            {error}
          </div>
        )}
        
        {!loading && !error && (
          <div className="overflow-x-auto">
            {clientesFiltrados.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200 text-sm">
                {clientes.length === 0 
                  ? "No se registran datos o movimientos de clientes disponibles en este momento."
                  : "No se encontraron resultados que coincidan con la búsqueda."}
              </div>
            ) : (
              <Table columns={COLUMNS} data={clientesFiltrados} sortable />
            )}
          </div>
        )}
      </section>

    </div>
  );
}
