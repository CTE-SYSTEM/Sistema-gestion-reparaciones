import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileDown, FileSpreadsheet, Search, BarChart3 } from 'lucide-react';
import { administracionService, errorText, saveBlob } from '../services/administracionService';
import { downloadSectionedPdf } from '../utils/csvExport';
import { AdminPage, AdminSection, AdminField, AdminButton, AdminNotice, AdminDataTable, inputClass, formatAdminDate } from '../components/AdministrationUI';

const filterKeys = { fechas: ['fecha_inicio', 'fecha_fin'], tecnico: ['tecnico_id'], proveedor: ['proveedor_id'], cliente: ['cliente_id'], equipo: ['equipo_id'], repuesto: ['repuesto_id'], orden: ['orden_id'], dias: ['dias'], year: ['year'], estado_orden: ['estado'], estado_garantia: ['estado'] };
const requiredFilters = ['equipo', 'repuesto', 'orden'];
const orderStates = ['PENDIENTE', 'ASIGNADO', 'APROBADO', 'EN_REPARACION', 'ESPERANDO_PIEZA', 'FINALIZADO', 'IRREPARABLE', 'ENTREGADO', 'CANCELADO'];
export default function Reportes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState([]), [options, setOptions] = useState({});
  const [selected, setSelected] = useState(searchParams.get('tipo') || 'resumen');
  const [filters, setFilters] = useState({}), [result, setResult] = useState(null), [page, setPage] = useState(1);
  const [initializing, setInitializing] = useState(true), [loading, setLoading] = useState(false), [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const request = useRef(null), generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([administracionService.getCatalogo(controller.signal), administracionService.getOpciones(controller.signal)])
      .then(([a, b]) => {
        setCatalog(a.data.data); setOptions(b.data.data);
        const initial = a.data.data.find((r) => r.id === (searchParams.get('tipo') || 'resumen')) || a.data.data.find((r) => r.id === 'resumen');
        const year = new Date().getFullYear();
        setFilters({ dias: a.data.defaults.garantia_aviso_dias, year,
          ...(initial?.categoria === 'Finanzas' && initial.filtros.includes('fechas') ? { fecha_inicio: `${year}-01-01`, fecha_fin: `${year}-12-31` } : {}) });
        setSelected(initial?.id || 'resumen');
      }).catch(async (e) => { if (!controller.signal.aborted) setError(await errorText(e)); })
      .finally(() => { if (!controller.signal.aborted) setInitializing(false); });
    return () => { controller.abort(); request.current?.abort(); generation.current++; };
  }, []);
  const definition = catalog.find((r) => r.id === selected);
  const categories = useMemo(() => [...new Set(catalog.map((r) => r.categoria))], [catalog]);
  const invalidate = () => { generation.current++; request.current?.abort(); setResult(null); setPage(1); setLoading(false); setError(''); };
  const selectReport = (id) => { invalidate(); setSelected(id); const report = catalog.find((r) => r.id === id);
    setFilters((old) => ({ dias: old.dias, year: old.year, ...(report?.categoria === 'Finanzas' && report.filtros.includes('fechas') ? { fecha_inicio: `${new Date().getFullYear()}-01-01`, fecha_fin: `${new Date().getFullYear()}-12-31` } : {}) }));
    setSearchParams({ tipo: id }, { replace: true }); };
  const change = (key, value) => { invalidate(); setFilters((old) => ({ ...old, [key]: value })); };
  const params = () => {
    const keys = [...(definition?.filtros || []).flatMap((f) => filterKeys[f] || []), 'buscar'];
    return Object.fromEntries(keys.filter((k) => filters[k] != null && filters[k] !== '').map((k) => [k, filters[k]]));
  };
  const missingRequired = definition?.filtros.some((f) => requiredFilters.includes(f) && !filters[filterKeys[f][0]]);
  const consult = async (event) => {
    event?.preventDefault(); request.current?.abort();
    const controller = new AbortController(), current = ++generation.current;
    request.current = controller; setLoading(true); setError(''); setResult(null);
    try { const { data } = await administracionService.getReporte(selected, params(), controller.signal); if (current === generation.current) { setResult(data); setPage(1); } }
    catch (e) { if (!controller.signal.aborted && current === generation.current) setError(await errorText(e)); }
    finally { if (current === generation.current) setLoading(false); }
  };
  const exportReport = async (format) => {
    setExporting(format); setError('');
    try {
      if (format === 'xlsx') {
        const { data } = await administracionService.getReporteExcel(selected, params()); saveBlob(data, `${selected}.xlsx`);
      } else {
        const { data } = await administracionService.getReporte(selected, params());
        downloadSectionedPdf({ title: data.reporte.nombre, filename: `${selected}.pdf`, description: data.nota || data.reporte.descripcion,
          metadata: [{ label: 'Generado', value: formatAdminDate(data.generado_en) }, { label: 'Registros', value: data.total },
            ...Object.entries(data.filtros).map(([k, v]) => ({ label: k.replaceAll('_', ' '), value: String(v) }))],
          sections: [{ title: data.reporte.nombre, rows: data.data, columns: data.columns }] });
      }
    } catch (e) { setError(await errorText(e)); } finally { setExporting(''); }
  };
  const selector = (label, key, collection, idKey, required = false) => <AdminField label={label} key={key}><select className={inputClass} value={filters[key] || ''} onChange={(e) => change(key, e.target.value)} required={required}>
    <option value="">{required ? 'Seleccione una opción' : 'Todos'}</option>{(options[collection] || []).map((r) => <option key={r[idKey]} value={r[idKey]}>{r.nombre}</option>)}
  </select></AdminField>;
  return <AdminPage title="Centro de reportes" description="Elige una categoría, selecciona el reporte y consulta sus resultados. Excel y PDF incluyen todos los registros de los filtros aplicados.">
    <AdminNotice error message={error} />
    <AdminSection title="Seleccionar reporte" description={`${catalog.length} reportes agrupados para encontrar la información del taller.`}>
      {initializing ? <p className="text-sm text-slate-500">Cargando reportes…</p> : !catalog.length ? <p className="text-sm text-slate-500">No se pudo cargar el catálogo. Recargue la página para reintentar.</p> :
        <form onSubmit={consult} className="space-y-5"><fieldset disabled={Boolean(exporting)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2"><AdminField label="Categoría"><select className={inputClass} value={definition?.categoria || ''} onChange={(e) => selectReport(catalog.find((r) => r.categoria === e.target.value).id)}>{categories.map((c) => <option key={c}>{c}</option>)}</select></AdminField>
            <AdminField label="Reporte"><select className={inputClass} value={selected} onChange={(e) => selectReport(e.target.value)}>{catalog.filter((r) => r.categoria === definition?.categoria).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></AdminField></div>
          {definition?.descripcion && <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">{definition.descripcion}</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {definition?.filtros.includes('fechas') && <><AdminField label="Desde" hint={definition.categoria === 'Finanzas' ? 'Vacío usa el inicio del año actual.' : 'Vacío incluye los registros anteriores.'}><input className={inputClass} type="date" value={filters.fecha_inicio || ''} onChange={(e) => change('fecha_inicio', e.target.value)} /></AdminField><AdminField label="Hasta" hint={definition.categoria === 'Finanzas' ? 'Vacío usa el fin del año actual.' : 'Incluye todo el día seleccionado.'}><input className={inputClass} type="date" min={filters.fecha_inicio || undefined} value={filters.fecha_fin || ''} onChange={(e) => change('fecha_fin', e.target.value)} /></AdminField></>}
            {definition?.filtros.includes('tecnico') && selector('Técnico', 'tecnico_id', 'tecnicos', 'id_tecnico')}
            {definition?.filtros.includes('proveedor') && selector('Proveedor', 'proveedor_id', 'proveedores', 'id_proveedor')}
            {definition?.filtros.includes('cliente') && selector('Cliente', 'cliente_id', 'clientes', 'id_cliente')}
            {definition?.filtros.includes('equipo') && selector('Equipo', 'equipo_id', 'equipos', 'id_equipo', true)}
            {definition?.filtros.includes('repuesto') && selector('Repuesto', 'repuesto_id', 'repuestos', 'id_repuesto', true)}
            {definition?.filtros.includes('orden') && <AdminField label="Número de orden"><input className={inputClass} type="number" min="1" required value={filters.orden_id || ''} onChange={(e) => change('orden_id', e.target.value)} /></AdminField>}
            {definition?.filtros.includes('dias') && <AdminField label="Vencen durante los próximos (días)"><input className={inputClass} type="number" min="1" max="365" required value={filters.dias || ''} onChange={(e) => change('dias', e.target.value)} /></AdminField>}
            {definition?.filtros.includes('year') && <AdminField label="Año"><input className={inputClass} type="number" min="2000" max={new Date().getFullYear() + 1} required value={filters.year || ''} onChange={(e) => change('year', e.target.value)} /></AdminField>}
            {(definition?.filtros.includes('estado_orden') || definition?.filtros.includes('estado_garantia')) && <AdminField label="Estado"><select className={inputClass} value={filters.estado || ''} onChange={(e) => change('estado', e.target.value)}><option value="">Todos</option>{(definition.filtros.includes('estado_orden') ? orderStates : ['VIGENTE', 'VENCIDA', 'SIN_INICIO']).map((s) => <option key={s}>{s}</option>)}</select></AdminField>}
            <AdminField label="Buscar en resultados"><input className={inputClass} value={filters.buscar || ''} maxLength={100} onChange={(e) => change('buscar', e.target.value)} placeholder="Nombre, referencia o estado" /></AdminField>
          </div></fieldset><AdminButton type="submit" disabled={initializing || loading || missingRequired || Boolean(exporting)}><Search size={16} />{loading ? 'Consultando…' : 'Consultar reporte'}</AdminButton>
        </form>}
    </AdminSection>
    {result ? <AdminSection title={result.reporte.nombre} description={`${result.total} registros · Consulta: ${formatAdminDate(result.generado_en)}`}>
      {(result.filtros.fecha_inicio || result.filtros.fecha_fin) && <p className="mb-4 text-sm text-slate-600">Período aplicado: {result.filtros.fecha_inicio || 'sin fecha inicial'} al {result.filtros.fecha_fin || 'sin fecha final'}.</p>}
      <div className="mb-4 flex flex-wrap gap-2"><AdminButton secondary disabled={Boolean(exporting) || !result.total} onClick={() => exportReport('xlsx')}><FileSpreadsheet size={16} />{exporting === 'xlsx' ? 'Generando…' : 'Descargar Excel'}</AdminButton><AdminButton secondary disabled={Boolean(exporting) || !result.total} onClick={() => exportReport('pdf')}><FileDown size={16} />{exporting === 'pdf' ? 'Generando…' : 'Descargar PDF'}</AdminButton></div>
      {result.nota && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{result.nota}</p>}
      <AdminDataTable rows={result.data} columns={result.columns} page={page} onPageChange={setPage} />
    </AdminSection> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500"><BarChart3 className="mx-auto mb-3 h-8 w-8 text-indigo-400" /><p className="text-sm">{loading ? 'Preparando los resultados…' : 'Seleccione un reporte y pulse Consultar reporte.'}</p></div>}
  </AdminPage>;
}
