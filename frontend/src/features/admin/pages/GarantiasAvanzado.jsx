import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import Table from '../../../components/Table';
import { garantiasAdminService } from '../services';
import { administracionService } from '../services/administracionService';

const transformGarantias = (garantias) =>
  garantias.map((g) => {
    const fechaVencimiento = g.fecha_vencimiento ? new Date(g.fecha_vencimiento) : null;
    const isExpired = fechaVencimiento ? fechaVencimiento < new Date() : true;
    return {
      id_garantia: g.id_garantia,
      factura_id: g.factura_id,
      orden_id: g.factura?.orden?.id_orden || '-',
      cliente: g.factura?.orden?.diagnostico?.equipo?.cliente?.nombre || '-',
      equipo: g.factura?.orden?.diagnostico?.equipo?.modelo || '-',
      fecha_inicio: g.fecha_inicio ? new Date(g.fecha_inicio).toLocaleDateString() : '-',
      fecha_vencimiento: g.fecha_vencimiento ? new Date(g.fecha_vencimiento).toLocaleDateString() : '-',
      duracion_meses: g.duracion_meses ?? '-',
      condiciones: g.condiciones || '-',
      estado: isExpired ? 'Vencida' : 'Vigente',
      isExpired,
      duracion_actual: g.duracion_meses ?? 3,
    };
  });

const sectionOptions = [
  { id: 'todos', label: 'Todos los apartados', hint: 'Vista completa del módulo de garantías' },
  { id: 'revalidacion', label: 'Revalidación por equipo', hint: 'Revalida o asigna garantías a equipos' },
  { id: 'manual', label: 'Registro manual', hint: 'Genera una póliza desde una factura' },
  { id: 'global', label: 'Listado global', hint: 'Revisa todas las garantías registradas' },
];

const normalizeSearchText = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export default function GarantiasAvanzado() {
  const [garantias, setGarantias] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [equiposGarantia, setEquiposGarantia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [facturaId, setFacturaId] = useState('');
  const [condiciones, setCondiciones] = useState('');
  const [duracionMeses, setDuracionMeses] = useState('3');
  const [defaults, setDefaults] = useState({ garantia_meses: 3, garantia_condiciones: '' });
  useEffect(() => {
    let active = true;
    administracionService.getConfiguracion().then(({ data }) => {
      if (active) { const business = data.data.valores.negocio; setDefaults(business); setDuracionMeses(String(business.garantia_meses)); setCondiciones(business.garantia_condiciones); }
    }).catch(() => { if (active) setError('No se pudieron cargar los valores de garantía del negocio.'); });
    return () => { active = false; };
  }, []);
  const [equipoSearch, setEquipoSearch] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [activeSection, setActiveSection] = useState('todos');
  const [selectedEquipoId, setSelectedEquipoId] = useState('');
  const [createMessage, setCreateMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Petición optimizada con useCallback
  const fetchGarantias = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [garantiasRes, facturasRes, equiposRes] = await Promise.all([
        garantiasAdminService.getGarantias(),
        garantiasAdminService.getFacturas(),
        garantiasAdminService.getEquipos(),
      ]);
      const data = garantiasRes.data?.data || [];
      setGarantias(transformGarantias(data));
      setFacturas(facturasRes.data?.data || []);
      setEquiposGarantia(equiposRes.data?.data || []);
    } catch (err) {
      setError('No se pudieron cargar los registros de garantías.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGarantias();
  }, [fetchGarantias]);

  // Auxiliares puros para legibilidad
  const getFacturaEquipoId = (factura) => factura?.orden?.diagnostico?.equipo?.id_equipo;
  const getFacturaGarantia = useCallback((factura) => (
    garantias.find((garantia) => Number(garantia.factura_id) === Number(factura.id_factura))
  ), [garantias]);
  const getEquipoLabel = (equipo) => [equipo.marca, equipo.modelo, equipo.tipo].filter(Boolean).join(' ') || `Equipo #${equipo.id_equipo}`;

  // Columnas del Listado Principal de Garantías
  const columns = useMemo(() => [
    { header: 'ID Garantía', accessor: 'id_garantia' },
    { header: 'Factura', accessor: 'factura_id' },
    { header: 'Orden', accessor: 'orden_id' },
    { header: 'Cliente', accessor: 'cliente' },
    { header: 'Equipo', accessor: 'equipo' },
    { header: 'Inicio', accessor: 'fecha_inicio' },
    { header: 'Vence', accessor: 'fecha_vencimiento' },
    { header: 'Duración (meses)', accessor: 'duracion_meses' },
    {
      header: 'Estado',
      accessor: 'estado',
      render: (row) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.isExpired ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
        }`}>
          {row.estado}
        </span>
      )
    },
    {
      header: 'Acciones',
      accessor: 'acciones',
      render: (row) => (
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => handleRenewGarantia(row.id_garantia, row.duracion_actual)}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 transition whitespace-nowrap"
        >
          Revalidar
        </button>
      ),
    },
    { header: 'Condiciones', accessor: 'condiciones' },
  ], [isProcessing]);

  // Columnas de la Tabla de Equipos
  const equiposColumns = useMemo(() => [
    { header: 'ID Equipo', accessor: 'id_equipo' },
    { header: 'Cliente', accessor: 'cliente' },
    { header: 'Detalle', accessor: 'equipo' },
    { header: 'Factura', accessor: 'factura_id' },
    { header: 'Garantía ID', accessor: 'garantia_id' },
    { header: 'Estado', accessor: 'estado' },
    {
      header: 'Acción',
      accessor: 'accion',
      render: (row) => (
        <button
          type="button"
          disabled={isProcessing || row.accion === 'Sin factura'}
          onClick={() => handleEquipoGarantiaAction(row)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400 whitespace-nowrap ${
            row.garantia ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {row.accion}
        </button>
      ),
    },
  ], [isProcessing]);

  // Memoización del filtrado y mapeo de equipos para evitar lag al escribir en el buscador
  const equiposRevalidacion = useMemo(() => {
    return equiposGarantia
      .map((equipo) => {
        const facturasEquipo = facturas
          .filter((factura) => Number(getFacturaEquipoId(factura)) === Number(equipo.id_equipo))
          .sort((a, b) => new Date(b.fecha_emision || 0) - new Date(a.fecha_emision || 0));
        const garantia = facturasEquipo.map(getFacturaGarantia).find(Boolean);
        const facturaAsignable = facturasEquipo.find((factura) => !getFacturaGarantia(factura)) || facturasEquipo[0] || null;

        return {
          id_equipo: equipo.id_equipo,
          cliente: equipo.cliente?.nombre || '-',
          equipo: getEquipoLabel(equipo),
          factura_id: facturaAsignable?.id_factura || garantia?.factura_id || '-',
          garantia_id: garantia?.id_garantia || '-',
          estado: garantia ? garantia.estado : 'Sin garantía',
          accion: garantia ? 'Revalidar' : (facturaAsignable ? 'Asignar' : 'Sin factura'),
          garantia,
          facturaAsignable,
        };
      })
      .filter((equipo) => {
        const term = equipoSearch.trim().toLowerCase();
        if (!term) return true;
        return [equipo.id_equipo, equipo.cliente, equipo.equipo, equipo.estado, equipo.factura_id]
          .some((field) => field?.toString().toLowerCase().includes(term));
      });
  }, [equiposGarantia, facturas, getFacturaGarantia, equipoSearch]);

  const selectedEquipo = useMemo(() => (
    equiposRevalidacion.find((equipo) => Number(equipo.id_equipo) === Number(selectedEquipoId))
  ), [equiposRevalidacion, selectedEquipoId]);

  const filteredSectionOptions = useMemo(() => {
    const term = normalizeSearchText(sectionSearch.trim());
    return sectionOptions.filter((option) =>
      normalizeSearchText(`${option.label} ${option.hint}`).includes(term)
    );
  }, [sectionSearch]);

  const selectedSection = useMemo(
    () => sectionOptions.find((option) => option.id === activeSection) || sectionOptions[0],
    [activeSection]
  );

  const showRevalidacion = activeSection === 'todos' || activeSection === 'revalidacion';
  const showManual = activeSection === 'todos' || activeSection === 'manual';
  const showGlobal = activeSection === 'todos' || activeSection === 'global';

  const handleSectionSearchSubmit = useCallback(() => {
    if (!sectionSearch.trim() || filteredSectionOptions.length === 0) return;
    setActiveSection(filteredSectionOptions[0].id);
  }, [filteredSectionOptions, sectionSearch]);

  const handleEquipoGarantiaAction = async (equipo) => {
    if (!equipo) return;
    setIsProcessing(true);
    setError('');
    setCreateMessage('');
    setActionMessage('');

    try {
      if (equipo.garantia) {
        const res = await garantiasAdminService.renovarGarantia(equipo.garantia.id_garantia, {
          duracion_meses: Number(duracionMeses) || Number(equipo.garantia.duracion_actual) || defaults.garantia_meses,
          condiciones: condiciones || equipo.garantia.condiciones,
        });
        setActionMessage(res.data?.message || 'Garantía revalidada correctamente.');
      } else if (equipo.facturaAsignable) {
        const res = await garantiasAdminService.createGarantia({
          factura_id: Number(equipo.facturaAsignable.id_factura),
          condiciones,
          duracion_meses: Number(duracionMeses) || defaults.garantia_meses,
        });
        setCreateMessage(res.data?.message || 'Garantía asignada correctamente.');
      } else {
        setError('Este equipo no tiene una factura asociada.');
        return;
      }

      setCondiciones(defaults.garantia_condiciones);
      setDuracionMeses(String(defaults.garantia_meses));
      setSelectedEquipoId('');
      await fetchGarantias();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo procesar la acción de garantía.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setCreateMessage('');
    setActionMessage('');
    setError('');

    if (!facturaId || !duracionMeses) {
      setError('La factura y duración son parámetros requeridos.');
      return;
    }

    try {
      const res = await garantiasAdminService.createGarantia({
        factura_id: Number(facturaId),
        condiciones,
        duracion_meses: Number(duracionMeses),
      });

      setCreateMessage(res.data?.message || 'Garantía creada correctamente.');
      setFacturaId('');
      setCondiciones(defaults.garantia_condiciones);
      setDuracionMeses(String(defaults.garantia_meses));
      fetchGarantias();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la nueva garantía.');
    }
  };

  const handleRenewGarantia = async (id, duracion) => {
    setIsProcessing(true);
    setError('');
    setCreateMessage('');
    setActionMessage('');

    try {
      const res = await garantiasAdminService.renovarGarantia(id, {
        duracion_meses: Number(duracion) || defaults.garantia_meses,
      });
      setActionMessage(res.data?.message || 'Garantía revalidada correctamente.');
      fetchGarantias();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo revalidar la garantía.');
    } finally {
      setIsProcessing(false);
    }
  };

  // KPIs calculados eficientemente
  const totalGarantias = garantias.length;
  const vigentes = useMemo(() => garantias.filter((g) => !g.isExpired).length, [garantias]);
  const vencidas = useMemo(() => garantias.filter((g) => g.isExpired).length, [garantias]);

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      
      {/* Encabezado Principal */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gestión de garantías</h1>
        <p className="text-gray-400 text-sm mt-0.5">Controla el ciclo de vida de las garantías y revalida las que correspondan.</p>
      </div>

      {/* KPI de Resumen Rápido */}
      {!loading && (
        <div className="grid gap-4 grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total expedidas</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalGarantias}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Garantías Vigentes</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{vigentes} pólizas</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Pólizas Vencidas</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{vencidas} casos</p>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-indigo-500">Buscar apartado</p>
              <p className="mt-1 text-sm text-gray-400">Escribe para filtrar los apartados del módulo de garantías.</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={sectionSearch}
                onChange={(event) => setSectionSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSectionSearchSubmit();
                  }
                }}
                placeholder="Buscar: revalidación, manual, global..."
                className="w-full rounded-xl border border-gray-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {sectionSearch && (
                <button
                  type="button"
                  onClick={() => setSectionSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition hover:bg-slate-100 hover:text-slate-700"
                  title="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
              <p className="text-xs font-black uppercase tracking-wider text-indigo-500">Vista activa</p>
              <p className="mt-0.5 text-sm font-bold text-slate-800">{selectedSection.label}</p>
              <p className="text-xs font-semibold text-slate-500">{selectedSection.hint}</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-slate-50 p-2">
            <div className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
              {filteredSectionOptions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-xs font-semibold text-gray-400">
                  No hay apartados con ese texto.
                </div>
              ) : (
                filteredSectionOptions.map((option) => {
                  const active = option.id === activeSection;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setActiveSection(option.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        active
                          ? 'border-indigo-200 bg-white text-indigo-700 shadow-sm'
                          : 'border-transparent bg-transparent text-slate-600 hover:border-gray-200 hover:bg-white'
                      }`}
                    >
                      <span className="block text-xs font-bold">{option.label}</span>
                      <span className={`block text-[11px] font-semibold ${active ? 'text-indigo-400' : 'text-gray-400'}`}>
                        {option.hint}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 1: Revalidación y Asignación Directa por Equipo */}
      {showRevalidacion && (
        <section className="bg-white shadow-sm rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-gray-50 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Revalidación y asignación por equipo</h2>
            <p className="text-sm text-gray-400">Asigna pólizas a equipos con factura o extiende la duración de vigencias existentes.</p>
          </div>
          <input
            value={equipoSearch}
            onChange={(e) => setEquipoSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 lg:w-80"
            placeholder="Buscar equipo, cliente o ID factura..."
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0 overflow-x-auto">
            {loading ? (
              <div className="text-gray-400 text-center py-10 text-sm">Sincronizando inventario de equipos...</div>
            ) : (
              <Table columns={equiposColumns} data={equiposRevalidacion} sortable />
            )}
          </div>

          {/* Panel Lateral de Acción sobre el Equipo Seleccionado */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-4 h-fit">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase">Equipo seleccionado</label>
              <select
                value={selectedEquipoId}
                onChange={(e) => setSelectedEquipoId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Elige un equipo --</option>
                {equiposRevalidacion.map((eq) => (
                  <option key={eq.id_equipo} value={eq.id_equipo}>
                    #{eq.id_equipo} - {eq.equipo}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl bg-white p-3.5 text-xs text-slate-600 space-y-1.5 shadow-sm border border-gray-100">
              <p className="font-bold text-slate-800 truncate">{selectedEquipo?.equipo || 'Ningún equipo seleccionado'}</p>
              <p>Clnt: <span className="font-semibold text-slate-700">{selectedEquipo?.cliente || '-'}</span></p>
              <p>Fact: <span className="font-semibold text-slate-700">{selectedEquipo?.factura_id || '-'}</span></p>
              <p>Garantía: <span className="font-semibold text-slate-700">{selectedEquipo?.garantia_id || '-'}</span></p>
              <p>Estado: <span className="font-semibold text-slate-700">{selectedEquipo?.estado || '-'}</span></p>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block">Duración (meses)</span>
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={duracionMeses}
                  onChange={(e) => setDuracionMeses(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block">Condiciones</span>
                <textarea
                  value={condiciones}
                  onChange={(e) => setCondiciones(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Especificaciones o exclusiones de la póliza..."
                />
              </div>
              <button
                type="button"
                disabled={!selectedEquipo || isProcessing || selectedEquipo?.accion === 'Sin factura'}
                onClick={() => handleEquipoGarantiaAction(selectedEquipo)}
                className="w-full px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {selectedEquipo?.garantia ? 'Confirmar Revalidación' : 'Asignar Nueva Garantía'}
              </button>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* SECCIÓN 2: Registro Manual y Tabla Global */}
      {(showManual || showGlobal) && (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {showManual && (
            <section className="bg-white shadow-sm rounded-2xl border border-gray-100 p-5 h-fit space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Emisión manual</h2>
                <p className="text-xs text-gray-400">Genera una cobertura directa vinculando un ID de factura existente.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">Factura ID</span>
                  <input
                    type="number"
                    value={facturaId}
                    onChange={(e) => setFacturaId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Ej. 1042"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">Duración (meses)</span>
                  <input
                    type="number"
                    min="1"
                    value={duracionMeses}
                    onChange={(e) => setDuracionMeses(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">Condiciones de cobertura</span>
                  <textarea
                    value={condiciones}
                    onChange={(e) => setCondiciones(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    rows={3}
                    placeholder="Detalla los términos..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-900 transition shadow-sm"
                >
                  Guardar Póliza
                </button>
              </form>
            </section>
          )}

          {showGlobal && (
            <section className="bg-white shadow-sm rounded-2xl border border-gray-100 p-6 space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-50 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Libro de garantías expedidas</h2>
                  <p className="text-sm text-gray-400">Historial completo de estados, plazos de vencimiento y clientes contables.</p>
                </div>
              </div>

              {/* Renderizado de Feedback de acciones de la API */}
              {createMessage && <div className="rounded-xl bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-700">{createMessage}</div>}
              {actionMessage && <div className="rounded-xl bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-700">{actionMessage}</div>}
              {error && <div className="rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-700">{error}</div>}

              <div className="overflow-x-auto">
                {loading ? (
                  <div className="text-gray-400 text-center py-10 text-sm">Consultando libros contables...</div>
                ) : garantias.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200 text-sm">
                    No hay pólizas de garantía registradas en el sistema todavía.
                  </div>
                ) : (
                  <Table columns={columns} data={garantias} sortable />
                )}
              </div>
            </section>
          )}
        </div>
      )}

    </div>
  );
}
