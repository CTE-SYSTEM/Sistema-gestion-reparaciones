import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowDownRight, ArrowUpRight, WalletCards } from 'lucide-react';
import api from '../../../services/api';
import { reportFilename } from '../../admin/utils/reportIdentity';

const money = (value) => `C$ ${Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthName = (value) => new Intl.DateTimeFormat('es-NI', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, value - 1, 1)));
const annualReport = { id: 'resumen_contable', categoria: 'Finanzas', nombre: 'Resumen contable anual' };
export default function ContabilidadDashboard() {
  const [year, setYear] = useState(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Managua', year: 'numeric' }).format(new Date()));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api.get('/contabilidad/resumen', { params: { anio: year } }).then(({ data: result }) => { if (active) setData(result.data); }).catch(() => { if (active) setError('No se pudo cargar el resumen contable.'); }); return () => { active = false; }; }, [year]);
  const download = async () => {
    setBusy(true); setError('');
    try { const response = await api.get('/contabilidad/resumen/excel', { params: { anio: year }, responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = reportFilename(annualReport, { year }, 'xlsx'); link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
    catch { setError('No se pudo descargar el informe.'); }
    finally { setBusy(false); }
  };
  const downloadPdf = async () => {
    setBusy(true); setError('');
    try {
      const { downloadSectionedPdf } = await import('../../admin/utils/csvExport');
      const active = data.months.filter((row) => row.ingresos || row.egresos || row.compras);
      downloadSectionedPdf({ title: `Contabilidad ${year}`, filename: reportFilename(annualReport, { year }, 'pdf'), description: data.method,
        metadata: [{ label: 'Área', value: 'Finanzas' }, { label: 'Tipo', value: 'General' }, { label: 'Año', value: year },
          { label: 'Generado', value: new Date().toLocaleString('es-NI') }],
        sections: [{ title: 'Resumen anual', rows: [data.totals], columns: [
          { accessor: 'facturado', header: 'Facturado' }, { accessor: 'por_cobrar', header: 'Por cobrar' },
          { accessor: 'ingresos', header: 'Ingresos registrados' }, { accessor: 'egresos', header: 'Egresos registrados' },
          { accessor: 'compras_registradas', header: 'Compras registradas' }, { accessor: 'compras_pagadas', header: 'Compras pagadas' }, { accessor: 'neto', header: 'Flujo neto' },
        ] }, { title: 'Meses con actividad', rows: active, columns: [
          { accessor: 'mes', header: 'Mes' }, { accessor: 'cobros', header: 'Cobros' },
          { accessor: 'otros_ingresos', header: 'Otros ingresos' }, { accessor: 'compras', header: 'Compras registradas' }, { accessor: 'compras_pagadas', header: 'Compras pagadas' },
          { accessor: 'devoluciones', header: 'Devoluciones' }, { accessor: 'reclamos', header: 'Reclamos' },
          { accessor: 'gastos_operativos', header: 'Gastos' }, { accessor: 'neto', header: 'Flujo neto' },
        ] }] });
    } catch { setError('No se pudo generar el PDF.'); }
    finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
    <header className="sgr-summary-header flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-900 p-6 text-white"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Contabilidad</p><h1 className="mt-1 text-3xl font-black">Inicio financiero</h1><p className="mt-2 text-sm text-slate-200">Ingresos y salidas registrados por mes para revisar el movimiento de dinero.</p></div><label className="text-sm">Año<select value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 block rounded-lg bg-white px-3 py-2 text-slate-900">{Array.from({ length: 5 }, (_, index) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Managua', year: 'numeric' }).format(new Date())) - index).map((value) => <option key={value} value={value}>{value}</option>)}</select></label></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!data ? <p>Cargando resumen…</p> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
        ['Facturado en el año', data.totals.facturado, ArrowUpRight], ['Saldo actual por cobrar de esas facturas', data.totals.por_cobrar, WalletCards],
        ['Ingresos registrados', data.totals.ingresos, ArrowUpRight], ['Egresos registrados', data.totals.egresos, ArrowDownRight],
        ['Compras registradas', data.totals.compras_registradas, ArrowDownRight], ['Compras pagadas', data.totals.compras_pagadas, ArrowDownRight],
        ['Flujo neto registrado', data.totals.neto, WalletCards],
      ].map(([label, value, Icon]) => <div key={label} className="rounded-2xl border bg-white p-5"><Icon className="text-indigo-600" /><p className="mt-2 text-2xl font-black">{money(value)}</p><p className="text-sm text-slate-600">{label}</p></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm text-slate-600">{data.method}</p><div className="flex flex-wrap gap-2"><Link to="/contabilidad/movimientos" className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-indigo-700">Ver y crear movimientos</Link><button type="button" disabled={busy} onClick={download} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><ArrowDownToLine size={16} /> Excel</button><button type="button" disabled={busy} onClick={downloadPdf} className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50">PDF</button></div></div>
      {data.months.some((row) => row.ingresos || row.egresos || row.compras) ? <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-900 text-white"><tr>{['Mes', 'Cobros', 'Otros ingresos', 'Compras registradas', 'Compras pagadas', 'Devoluciones', 'Reclamos', 'Gastos', 'Ingresos', 'Egresos', 'Flujo neto'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.months.filter((row) => row.ingresos || row.egresos || row.compras).map((row) => <tr key={row.mes} className="border-t even:bg-slate-50"><th className="p-3 capitalize">{monthName(row.mes)}</th>{['cobros', 'otros_ingresos', 'compras', 'compras_pagadas', 'devoluciones', 'reclamos', 'gastos_operativos', 'ingresos', 'egresos', 'neto'].map((key) => <td key={key} className="p-3 whitespace-nowrap">{money(row[key])}</td>)}</tr>)}</tbody></table></div> : <p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">No hay movimientos ni compras registrados en {year}.</p>}
    </>}
  </section>;
}
