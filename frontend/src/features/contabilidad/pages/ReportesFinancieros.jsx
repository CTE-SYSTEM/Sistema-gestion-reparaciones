import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { AdminDataTable, formatAdminDate } from '../../admin/components/AdministrationUI';
import { reportFilename, reportIdentity, reportPeriod } from '../../admin/utils/reportIdentity';

const financeLabels = { facturado: 'Facturado', compras_registradas: 'Compras registradas', entradas_caja: 'Entradas de caja', salidas_caja: 'Salidas de caja', neto_caja: 'Neto de caja' };
const money = (value) => `C$ ${Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ReportesFinancieros({ integral = false }) {
  const basePath = integral ? '/secretaria/reportes' : '/contabilidad/resumen/reportes';
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(integral ? 'ordenes_estado' : 'facturacion');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const identity = result ? reportIdentity(result.reporte) : null;
  useEffect(() => { api.get(`${basePath}/catalogo`).then(({ data }) => setCatalog(data.data || [])).catch(() => setError('No se pudo cargar el catálogo de reportes.')); }, [basePath]);
  const consult = async () => {
    setBusy(true); setError(''); setResult(null);
    try { const { data } = await api.get(`${basePath}/${selected}`, { params: { fecha_inicio: desde || undefined, fecha_fin: hasta || undefined } }); setResult(data); setPage(1); }
    catch (err) { setError(err.response?.data?.error || 'No se pudo consultar el reporte.'); }
    finally { setBusy(false); }
  };
  const exportReport = async (format) => {
    if (!result?.data?.length) return;
    setBusy(true); setError('');
    try {
      const { downloadJsonExcel, downloadSectionedPdf } = await import('../../admin/utils/csvExport');
      const filters = result.filtros || {};
      const filename = reportFilename(result.reporte, filters, format, result.generado_en);
      if (format === 'xlsx') await downloadJsonExcel(result.data, result.columns, filename);
      else downloadSectionedPdf({ title: result.reporte.nombre, filename, description: result.nota || result.reporte.descripcion,
        metadata: [{ label: 'Área', value: identity.area }, ...(identity.type ? [{ label: 'Tipo', value: identity.type }] : []),
          ...(reportPeriod(filters) ? [{ label: 'Período', value: reportPeriod(filters) }] : []),
          { label: 'Generado', value: formatAdminDate(result.generado_en) }, { label: 'Registros', value: result.total },
          ...Object.entries(result.resumen_financiero || {}).map(([key, value]) => ({ label: financeLabels[key], value: money(value) }))],
        sections: [{ title: result.reporte.nombre, rows: result.data, columns: result.columns }] });
    } catch { setError('No se pudo descargar el reporte.'); }
    finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6"><header className="rounded-3xl bg-slate-900 p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-white">{integral ? 'Operación integral' : 'Contabilidad'}</p><h1 className="mt-1 text-3xl font-bond text-white">{integral ? 'Reportes del taller' : 'Reportes financieros'}</h1><p className="mt-2 text-sm text-slate-200">{integral ? 'Consulte la actividad de las áreas y descargue el detalle en PDF o Excel.' : 'Consulte facturación, costos, márgenes y rentabilidad con los datos registrados.'}</p></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-[2fr_1fr_1fr_auto]"><label className="text-sm">Reporte<select value={selected} onChange={(e) => { setSelected(e.target.value); setResult(null); }} className="mt-1 block w-full rounded border p-2">{catalog.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="text-sm">Desde<input type="date" value={desde} max={hasta || undefined} onChange={(e) => { setDesde(e.target.value); setResult(null); }} className="mt-1 block w-full rounded border p-2" /></label><label className="text-sm">Hasta<input type="date" value={hasta} min={desde || undefined} onChange={(e) => { setHasta(e.target.value); setResult(null); }} className="mt-1 block w-full rounded border p-2" /></label><button type="button" disabled={busy} onClick={consult} className="self-end rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-50">Consultar</button></div>
    {result && <div className="rounded-2xl border bg-white p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{result.reporte.nombre}</h2><p className="text-sm text-slate-600">{[identity.area, identity.type, reportPeriod(result.filtros), `${result.total} registros`, `Generado: ${formatAdminDate(result.generado_en)}`].filter(Boolean).join(' · ')}</p>{result.nota && <p className="text-sm text-slate-600">{result.nota}</p>}</div><div className="flex gap-2"><button disabled={busy || !result.total} onClick={() => exportReport('xlsx')} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Excel</button><button disabled={busy || !result.total} onClick={() => exportReport('pdf')} className="rounded border px-3 py-2 text-sm disabled:opacity-50">PDF</button></div></div>{result.resumen_financiero && <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Object.entries(result.resumen_financiero).map(([key, value]) => <div key={key} className="rounded-xl border bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-600">{financeLabels[key]}</p><p className="mt-1 text-lg font-black text-slate-900">{money(value)}</p></div>)}</div>}<AdminDataTable rows={result.data} columns={result.columns} page={page} onPageChange={setPage} /></div>}
  </section>;
}
