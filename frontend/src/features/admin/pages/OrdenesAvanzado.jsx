import React, { useEffect, useState, useRef, useMemo } from 'react';
import Table from '../../../components/Table';
import { downloadJsonPdf } from '../utils/csvExport';
import { ordenesAdminService, tecnicosAdminService } from '../services';

// Columnas principales de la tabla de órdenes maestras
const columns = [
  { header: 'ID', accessor: 'id_orden' },
  { header: 'Equipo', accessor: 'equipo' },
  { header: 'Cliente', accessor: 'cliente' },
  { header: 'Estado', accessor: 'estado' },
  { header: 'Técnico', accessor: 'tecnico' },
  { header: 'Facturas', accessor: 'facturas' },
  {
    header: 'Acciones',
    accessor: 'acciones',
    render: (row) => (
      <button
        type="button"
        onClick={row.onShowDetails}
        className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 shadow-sm"
      >
        Ver / Editar
      </button>
    ),
  },
];

// Columnas de la tabla de repuestos vinculados a la orden
const repuestosColumns = [
  { header: 'Repuesto', accessor: 'nombre' },
  { header: 'Categoría', accessor: 'categoria' },
  { header: 'Pieza solicitada', accessor: 'pieza_solicitada' },
  { header: 'Cantidad', accessor: 'cantidad_usada' },
  { header: 'Aprobación', accessor: 'estado_aprobacion' },
  { header: 'Costo Unitario', accessor: 'costo_unitario' },
];

const statusOptions = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_REPARACION', label: 'En reparacion' },
  { value: 'FINALIZADO', label: 'Finalizado' },
];

const fetchOrdenes = async (setOrdenes, setLoading, setError) => {
  setLoading(true);
  try {
    const res = await ordenesAdminService.getOrdenes();
    const data = res.data;
    if (data.data) {
      setOrdenes(
        data.data.map((o) => ({
          id_orden: o.id_orden,
          equipo: o.diagnostico?.equipo?.modelo || '-',
          cliente: o.diagnostico?.equipo?.cliente?.nombre || '-',
          estado: o.estado || '-',
          tecnico: o.tecnico?.nombre || 'Sin asignar',
          tecnico_id: o.tecnico?.id_tecnico || null,
          prioridades: o.prioridad || '-',
          facturas: o.facturas?.length || 0,
          diagnostico: o.diagnostico || null,
          raw: o,
        }))
      );
    } else {
      setError('No se pudo cargar la información de órdenes');
    }
  } catch (e) {
    setError('Error de red o servidor al intentar conectar.');
  } finally {
    setLoading(false);
  }
};

export default function OrdenesAvanzado() {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedOrden, setSelectedOrden] = useState(null);
  const [status, setStatus] = useState('');
  const [assignedTechnician, setAssignedTechnician] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [repuestosOrden, setRepuestosOrden] = useState([]);
  const [repuestoLoading, setRepuestoLoading] = useState(false);
  const [repuestoError, setRepuestoError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const editSectionRef = useRef(null);

  useEffect(() => {
    fetchOrdenes(setOrdenes, setLoading, setError);
    tecnicosAdminService.getTecnicos()
      .then((response) => setTechnicians(response.data?.data || []))
      .catch(() => {});
  }, []);

  const loadRepuestosOrden = async (ordenId) => {
    setRepuestoLoading(true);
    setRepuestoError('');
    setRepuestosOrden([]);
    try {
      const res = await ordenesAdminService.getRepuestos(ordenId);
      setRepuestosOrden(res.data?.data || []);
    } catch (err) {
      setRepuestoError(err.response?.data?.error || 'No se pudo cargar los repuestos.');
    } finally {
      setRepuestoLoading(false);
    }
  };

  const handleShowDetails = (orden) => {
    setSelectedOrden(orden);
    setStatus(orden.estado);
    setAssignedTechnician(orden.tecnico_id);
    setMessage('');
    loadRepuestosOrden(orden.id_orden);

    setTimeout(() => {
      editSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleDownloadRepuestosReport = async () => {
    if (!selectedOrden) return;
    setDownloading(true);
    setMessage('');
    try {
      const response = await ordenesAdminService.getRepuestosReporte(selectedOrden.id_orden, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `repuestos-orden-${selectedOrden.id_orden}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('Reporte descargado correctamente.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo generar el reporte.');
    } finally {
      setDownloading(false);
    }
  };

  const handleUpdateOrden = async () => {
    if (!selectedOrden) return;
    setSaving(true);
    setMessage('');
    try {
      await ordenesAdminService.updateOrden(selectedOrden.id_orden, {
        estado: status,
        tecnico_id: assignedTechnician,
      });
      setMessage('Orden actualizada correctamente.');
      fetchOrdenes(setOrdenes, setLoading, setError);
      setSelectedOrden((prev) => ({ ...prev, estado: status, tecnico_id: assignedTechnician }));
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo actualizar la orden.');
    } finally {
      setSaving(false);
    }
  };

  // Mapeo seguro de callbacks de acción mediante memorización
  const filteredOrdenes = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return ordenes;
    return ordenes.filter((orden) => [
      orden.id_orden,
      orden.equipo,
      orden.cliente,
      orden.estado,
      orden.tecnico,
      orden.prioridades,
      orden.diagnostico?.falla_reportada,
      orden.diagnostico?.diagnostico_real,
    ].some((field) => String(field || '').toLowerCase().includes(term)));
  }, [ordenes, searchText]);

  const reportColumns = columns.filter((column) => column.accessor !== 'acciones');
  const downloadGeneralReport = () => {
    downloadJsonPdf(filteredOrdenes, reportColumns, 'ordenes_general.pdf', 'Reporte General de Ordenes');
  };

  const ordenesWithActions = useMemo(() => (
    filteredOrdenes.map((orden) => ({
      ...orden,
      onShowDetails: () => handleShowDetails(orden),
    }))
  ), [filteredOrdenes]);

  // Indicadores estadísticos consolidados
  const { ordenesPendientes, ordenesReparacion } = useMemo(() => ({
    ordenesPendientes: ordenes.filter(o => o.estado === 'PENDIENTE').length,
    ordenesReparacion: ordenes.filter(o => o.estado === 'EN_REPARACION').length,
  }), [ordenes]);

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      
      {/* Encabezado Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión avanzada de órdenes</h1>
          <p className="text-gray-400 text-sm mt-0.5">Supervisa el estado de órdenes en taller, técnicos asignados y repuestos vinculados.</p>
        </div>
        <button
          type="button"
          onClick={downloadGeneralReport}
          disabled={filteredOrdenes.length === 0}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
        >
          Generar Reporte General
        </button>
      </div>

      {/* Grid de KPIs Superiores */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Órdenes Totales</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{ordenes.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Pendientes</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{ordenesPendientes}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">En Reparación</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{ordenesReparacion}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Técnicos Activos</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{technicians.length}</p>
        </div>
      </div>

      {/* Tabla General de Órdenes */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Flujo de trabajo general</h2>
          <p className="text-sm text-gray-400">Listado Maestro de las hojas de servicio técnico generadas.</p>
        </div>
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Buscador inteligente: orden, cliente, equipo, tecnico, estado o falla..."
          className="w-full rounded-xl border border-gray-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100/50"
        />

        {loading && <div className="text-gray-400 text-center py-6 text-sm">Consultando base de datos de órdenes...</div>}
        {error && <div className="text-red-600 bg-red-50 p-4 rounded-xl text-sm font-semibold">{error}</div>}
        
        {!loading && !error && (
          <div className="overflow-x-auto">
            <Table columns={columns} data={ordenesWithActions} sortable />
          </div>
        )}
      </div>

      {/* Editor y Gestión de Repuestos Avanzado */}
      {selectedOrden && (
        <div ref={editSectionRef} className="grid gap-6 lg:grid-cols-3 pt-2 animate-fadeIn">
          
          {/* Controles de la Orden */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-5 h-fit">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Editar Orden #{selectedOrden.id_orden}</h3>
              <p className="text-sm text-gray-400 truncate">Mantenimiento asignado a este documento.</p>
            </div>

            <div className="p-4 bg-slate-50 border border-gray-100 rounded-xl space-y-2 text-sm">
              <div>
                <span className="text-xs text-gray-400 block font-bold uppercase tracking-wide">Cliente</span>
                <span className="font-semibold text-slate-700">{selectedOrden.cliente}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block font-bold uppercase tracking-wide">Equipo / Dispositivo</span>
                <span className="font-semibold text-slate-700">{selectedOrden.equipo}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block font-bold uppercase tracking-wide">Estado Inicial</span>
                <span className="inline-flex mt-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-100">{selectedOrden.estado}</span>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Actualizar flujo</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Técnico encargado</span>
                <select
                  value={assignedTechnician || ''}
                  onChange={(e) => setAssignedTechnician(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Sin asignar</option>
                  {technicians.map((tech) => (
                    <option key={tech.id_tecnico} value={tech.id_tecnico}>{tech.nombre}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleUpdateOrden}
                disabled={saving}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:bg-slate-300 shadow-sm disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : 'Aplicar Cambios'}
              </button>
              
              <button
                type="button"
                onClick={handleDownloadRepuestosReport}
                disabled={downloading}
                className="w-full rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {downloading ? 'Exportando...' : 'Exportar Excel de repuestos'}
              </button>
            </div>

            {message && (
              <div className="p-3 bg-slate-50 text-xs font-semibold text-slate-600 rounded-xl text-center border border-gray-100">
                {message}
              </div>
            )}
          </div>

          {/* Tabla Secundaria de Repuestos */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 lg:col-span-2 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Inventario y repuestos vinculados</h3>
                <p className="text-sm text-gray-400">Piezas solicitadas por el técnico para completar la reparación.</p>
              </div>
              <span className="rounded-xl bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 border border-indigo-100 self-start sm:self-center">
                {repuestosOrden.length} Solicitudes
              </span>
            </div>

            {repuestoLoading && <div className="text-gray-400 text-center py-6 text-sm">Cargando lista de materiales...</div>}
            {repuestoError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl font-semibold">{repuestoError}</div>}
            
            {!repuestoLoading && !repuestoError && (
              <div className="overflow-x-auto">
                {repuestosOrden.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200 text-sm">
                    Esta orden no requiere o no se le han asignado repuestos hasta el momento.
                  </div>
                ) : (
                  <Table columns={repuestosColumns} data={repuestosOrden} sortable />
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
