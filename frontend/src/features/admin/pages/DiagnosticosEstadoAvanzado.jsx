import React, { useEffect, useMemo, useState } from 'react';
import Table from '../../../components/Table';
import { downloadJsonExcel, downloadJsonPdf } from '../utils/csvExport';
import { diagnosticosAdminService, tecnicosAdminService } from '../services';
import { formatoPresupuesto } from '../../../utils/monedaPresupuesto';

const reportColumns = [
  { header: 'Estado', accessor: 'estado' },
  { header: 'Aprobacion', accessor: 'aprobacion' },
  { header: 'Cantidad', accessor: 'cantidad' },
  { header: 'Moneda', accessor: 'moneda' },
  {
    header: 'Presupuesto total',
    accessor: 'presupuesto_total',
    render: (row) => formatoPresupuesto(row.presupuesto_total, row.moneda),
  },
  {
    header: 'Promedio',
    accessor: 'presupuesto_promedio',
    render: (row) => formatoPresupuesto(row.presupuesto_promedio, row.moneda),
  },
];

const diagnosticoColumnsBase = [
  { header: 'ID', accessor: 'id_diagnostico' },
  { header: 'Cliente', accessor: 'cliente' },
  { header: 'Equipo', accessor: 'equipo' },
  { header: 'Tecnico', accessor: 'tecnico' },
  { header: 'Estado', accessor: 'estado_del_diagnostico' },
  { header: 'Aprobacion', accessor: 'Estado_aprobacion' },
  { header: 'Prioridad', accessor: 'prioridad' },
  { header: 'Presupuesto', accessor: 'presupuesto', summarize: false },
];

const DIAGNOSTICO_ESTADOS = ['PENDIENTE', 'INGRESADO', 'EN_REVISION', 'DIAGNOSTICADO', 'COMPLETADO', 'APROBADO', 'RECHAZADO'];
const APROBACION_ESTADOS = ['Pendiente', 'Aprobado', 'Rechazado'];
const PRIORIDADES = ['Baja', 'Normal', 'Alta', 'Urgente'];

const formatDiagnostico = (diagnostico) => ({
  id_diagnostico: diagnostico.id_diagnostico,
  cliente: diagnostico.equipo?.cliente?.nombre || '-',
  equipo: [diagnostico.equipo?.marca, diagnostico.equipo?.modelo, diagnostico.equipo?.numero_serie].filter(Boolean).join(' ') || '-',
  tecnico: diagnostico.tecnico?.nombre || 'Sin asignar',
  tecnico_id: diagnostico.tecnico_id || '',
  estado_del_diagnostico: diagnostico.estado_del_diagnostico || 'PENDIENTE',
  Estado_aprobacion: diagnostico.Estado_aprobacion || 'Pendiente',
  prioridad: diagnostico.prioridad || 'Normal',
  presupuesto: formatoPresupuesto(diagnostico.presupuesto_estimado, diagnostico.moneda_presupuesto),
  moneda_presupuesto: diagnostico.moneda_presupuesto || 'NIO',
  presupuesto_estimado: diagnostico.presupuesto_estimado ? Number(diagnostico.presupuesto_estimado) : '',
  falla_reportada: diagnostico.falla_reportada || '',
  diagnostico_real: diagnostico.diagnostico_real || '',
  raw: diagnostico,
});

export default function DiagnosticosEstadoAvanzado() {
  const [reportData, setReportData] = useState([]);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [editingDiagnostico, setEditingDiagnostico] = useState(null);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const query = [];
      if (fromDate) query.push(`fecha_inicio=${fromDate}`);
      if (toDate) query.push(`fecha_fin=${toDate}`);
      const [reportRes, diagnosticosRes, tecnicosRes] = await Promise.all([
        diagnosticosAdminService.getReporteEstado(query.join('&')),
        diagnosticosAdminService.getDiagnosticos(),
        tecnicosAdminService.getTecnicos(),
      ]);

      setReportData((reportRes.data?.data || []).map((item) => ({
        ...item,
        presupuesto_total: item.presupuesto_total ? Number(item.presupuesto_total) : 0,
        presupuesto_promedio: item.presupuesto_promedio ? Number(item.presupuesto_promedio) : 0,
      })));
      setDiagnosticos((diagnosticosRes.data?.data || []).map(formatDiagnostico));
      setTecnicos(tecnicosRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar la informacion de diagnosticos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const filteredDiagnosticos = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return diagnosticos;

    return diagnosticos.filter((item) => [
      item.id_diagnostico,
      item.cliente,
      item.equipo,
      item.tecnico,
      item.estado_del_diagnostico,
      item.Estado_aprobacion,
      item.prioridad,
      item.falla_reportada,
      item.diagnostico_real,
    ].some((field) => String(field || '').toLowerCase().includes(term)));
  }, [diagnosticos, searchText]);

  const diagnosticoColumns = useMemo(() => [
    ...diagnosticoColumnsBase,
    {
      header: 'Acciones',
      accessor: 'acciones',
      render: (row) => (
        <button
          type="button"
          onClick={() => {
            setEditingDiagnostico({ ...row });
            setMessage('');
          }}
          className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
        >
          Editar
        </button>
      ),
    },
  ], []);

  const downloadReportCsv = async () => {
    setDownloading(true);
    try {
      await downloadJsonExcel(filteredDiagnosticos, diagnosticoColumnsBase, 'diagnosticos_general.xlsx');
    } catch (err) {
      setError('No se pudo descargar el reporte general.');
    } finally {
      setDownloading(false);
    }
  };

  const downloadReportPdf = () => {
    setDownloading(true);
    try {
      downloadJsonPdf(filteredDiagnosticos, diagnosticoColumnsBase, 'diagnosticos_general.pdf', 'Reporte General de Diagnosticos');
    } catch (err) {
      setError('No se pudo descargar el reporte general en PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleUpdateDiagnostico = async (event) => {
    event.preventDefault();
    if (!editingDiagnostico) return;

    setSaving(true);
    setMessage('');
    try {
      const response = await diagnosticosAdminService.updateDiagnostico(editingDiagnostico.id_diagnostico, {
        tecnico_id: editingDiagnostico.tecnico_id || null,
        falla_reportada: editingDiagnostico.falla_reportada,
        diagnostico_real: editingDiagnostico.diagnostico_real,
        presupuesto_estimado: editingDiagnostico.presupuesto_estimado,
        moneda_presupuesto: editingDiagnostico.moneda_presupuesto,
        prioridad: editingDiagnostico.prioridad,
        estado_del_diagnostico: editingDiagnostico.estado_del_diagnostico,
        Estado_aprobacion: editingDiagnostico.Estado_aprobacion,
      });

      const updated = formatDiagnostico(response.data?.data || {});
      setDiagnosticos((prev) => prev.map((item) => (
        item.id_diagnostico === updated.id_diagnostico ? updated : item
      )));
      setMessage('Diagnostico actualizado correctamente.');
      setTimeout(() => setEditingDiagnostico(null), 800);
      fetchReport();
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo actualizar el diagnostico.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Diagnosticos por estado</h1>
          <p className="text-gray-400 text-sm mt-0.5">Supervisa, busca y edita diagnosticos desde una sola vista.</p>
        </div>
        <button
          type="button"
          onClick={downloadReportPdf}
          disabled={downloading || loading || filteredDiagnosticos.length === 0}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
        >
          Generar Reporte General
        </button>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-6">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-end">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase block">Buscador inteligente</span>
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar por ID, cliente, equipo, tecnico, estado o falla..."
              className="mt-1 w-full rounded-xl border border-gray-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <label className="block">
            <span className="text-xs font-bold text-gray-500 uppercase block">Desde</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-gray-500 uppercase block">Hasta</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </label>
          <button type="button" onClick={fetchReport} disabled={loading} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:bg-slate-300">
            Consultar
          </button>
          <button type="button" onClick={downloadReportCsv} disabled={downloading || filteredDiagnosticos.length === 0} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300">
            Excel
          </button>
        </div>

        {loading && <div className="text-gray-400 text-center py-10 text-sm">Procesando diagnosticos...</div>}
        {error && <div className="text-red-600 bg-red-50 p-4 rounded-xl text-sm font-semibold">{error}</div>}

        {!loading && !error && (
          <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
            <div className="overflow-x-auto">
              <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Resumen por estado</h2>
              <Table columns={reportColumns} data={reportData} sortable />
            </div>
            <div className="overflow-x-auto">
              <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Diagnosticos editables</h2>
              {filteredDiagnosticos.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200 text-sm">
                  No se encontraron diagnosticos con ese termino.
                </div>
              ) : (
                <Table columns={diagnosticoColumns} data={filteredDiagnosticos} sortable />
              )}
            </div>
          </div>
        )}
      </section>

      {editingDiagnostico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-slate-800">Editar diagnostico #{editingDiagnostico.id_diagnostico}</h3>
              <p className="text-sm text-gray-400">{editingDiagnostico.cliente} - {editingDiagnostico.equipo}</p>
            </div>

            <form onSubmit={handleUpdateDiagnostico} className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase">Tecnico</span>
                <select value={editingDiagnostico.tecnico_id || ''} onChange={(e) => setEditingDiagnostico((prev) => ({ ...prev, tecnico_id: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Sin asignar</option>
                  {tecnicos.map((tecnico) => <option key={tecnico.id_tecnico} value={tecnico.id_tecnico}>{tecnico.nombre}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase">Prioridad</span>
                <select value={editingDiagnostico.prioridad || 'Normal'} onChange={(e) => setEditingDiagnostico((prev) => ({ ...prev, prioridad: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none">
                  {PRIORIDADES.map((prioridad) => <option key={prioridad} value={prioridad}>{prioridad}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase">Estado</span>
                <select value={editingDiagnostico.estado_del_diagnostico || 'PENDIENTE'} onChange={(e) => setEditingDiagnostico((prev) => ({ ...prev, estado_del_diagnostico: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none">
                  {DIAGNOSTICO_ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase">Aprobacion</span>
                <select value={editingDiagnostico.Estado_aprobacion || 'Pendiente'} onChange={(e) => setEditingDiagnostico((prev) => ({ ...prev, Estado_aprobacion: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none">
                  {APROBACION_ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Falla reportada</span>
                <textarea value={editingDiagnostico.falla_reportada || ''} onChange={(e) => setEditingDiagnostico((prev) => ({ ...prev, falla_reportada: e.target.value }))} className="mt-1.5 block min-h-20 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none" />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Diagnostico real</span>
                <textarea value={editingDiagnostico.diagnostico_real || ''} onChange={(e) => setEditingDiagnostico((prev) => ({ ...prev, diagnostico_real: e.target.value }))} className="mt-1.5 block min-h-24 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase">Presupuesto estimado</span>
                <input type="number" min="0" step="0.01" value={editingDiagnostico.presupuesto_estimado || ''} onChange={(e) => setEditingDiagnostico((prev) => ({ ...prev, presupuesto_estimado: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase">Moneda del presupuesto</span>
                <select value={editingDiagnostico.moneda_presupuesto} onChange={(e) => setEditingDiagnostico((prev) => ({ ...prev, moneda_presupuesto: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="NIO">Córdobas · C$ (NIO)</option><option value="USD">Dólares · US$ (USD)</option>
                </select>
              </label>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingDiagnostico(null)} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-400">
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
              {message && <div className="md:col-span-2 text-center text-sm font-semibold text-indigo-600">{message}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
