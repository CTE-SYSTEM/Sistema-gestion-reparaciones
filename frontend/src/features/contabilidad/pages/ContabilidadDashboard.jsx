import { useContext, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, WalletCards, FileDown, RefreshCw } from 'lucide-react';
import api from '../../../services/api';
import { AuthContext } from '../../../context/AuthContext';
import { MonthlyChart, AccumulatedChart, ExpenseChart, MoneyFlow } from '../components/AccountingCharts';
import { exportAccountingSummary, money, monthName, monthColumns } from '../utils/accountingExport';

const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Managua', year: 'numeric' }).format(new Date()));
const dates = (year, month = '') => ({ fecha_inicio: `${year}-${month ? String(month).padStart(2,'0') : '01'}-01`, fecha_fin: month ? `${year}-${String(month).padStart(2,'0')}-${new Date(Date.UTC(year,Number(month),0)).getUTCDate()}` : `${year}-12-31` });
const inputClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';
function ChartCard({ title, hint, children }) { return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-base font-bold text-slate-800">{title}</h2><p className="mt-1 text-xs text-slate-500">{hint}</p><div className="accounting-chart-scroll">{children}</div><p className="mt-1 text-xs text-slate-500 sm:hidden">Deslice el gráfico para ver todos los valores.</p></section>; }

export default function ContabilidadDashboard() {
  const { user } = useContext(AuthContext), navigate = useNavigate(), charts = useRef(null);
  const [year,setYear] = useState(currentYear), [month,setMonth] = useState('');
  const [filters,setFilters] = useState(dates(currentYear)), [draft,setDraft] = useState(dates(currentYear));
  const [exporting,setExporting] = useState(''), [error,setError] = useState('');
  const query = useQuery({ queryKey:['contabilidad','resumen',filters], queryFn:async({signal})=>(await api.get('/contabilidad/resumen',{params:filters,signal,cache:false})).data.data });
  const data=query.data;
  const changePeriod=(nextYear,nextMonth)=>{const next=dates(nextYear,nextMonth);setYear(nextYear);setMonth(nextMonth);setDraft(next);setFilters(next);setError('');};
  const openRecords=(type='',period=filters)=>{if(!exporting)navigate(`/contabilidad/movimientos?${new URLSearchParams({...period,...(type?{tipo:type}:{})})}`);};
  const openMonth=selected=>{const range=dates(selected.anio,selected.mes);openRecords('',{fecha_inicio:range.fecha_inicio>filters.fecha_inicio?range.fecha_inicio:filters.fecha_inicio,fecha_fin:range.fecha_fin<filters.fecha_fin?range.fecha_fin:filters.fecha_fin});};
  const download=async format=>{if(!data || query.isFetching)return;setExporting(format);setError('');try{await exportAccountingSummary(data,format,charts.current,user?.personName || user?.username);}catch{setError('No se pudo generar el reporte. Intente de nuevo.');}finally{setExporting('');}};
  const reportQuery = new URLSearchParams({...filters,reporte:'margen_orden'}).toString();
  return <section className="mx-auto max-w-7xl space-y-5 p-4">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4"><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Contabilidad</p><h1 className="m-0 mt-1 text-2xl font-bold text-slate-900">Movimiento del dinero</h1><p className="mt-1 text-sm text-slate-500">Consulte ingresos, salidas y cartera pendiente; abra los registros desde cada gráfico.</p></div><Link to={`/contabilidad/reportes?${reportQuery}`} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700">Márgenes y reportes</Link></header>
    <fieldset disabled={Boolean(exporting)} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="text-xs font-semibold text-slate-600">Año<select value={year} onChange={e=>changePeriod(Number(e.target.value),month)} className={`mt-1 block ${inputClass}`}>{Array.from({length:6},(_,i)=>currentYear-i).map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">Mes<select value={month} onChange={e=>changePeriod(year,e.target.value)} className={`mt-1 block ${inputClass}`}><option value="">Todo el año</option>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{new Intl.DateTimeFormat('es-NI',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,i,1)))}</option>)}</select></label>
      <form onSubmit={e=>{e.preventDefault();setFilters({...draft});setError('');}} className="flex flex-wrap items-end gap-3"><label className="text-xs font-semibold text-slate-600">Desde<input type="date" required value={draft.fecha_inicio} max={draft.fecha_fin} onChange={e=>setDraft(old=>({...old,fecha_inicio:e.target.value}))} className={`mt-1 block ${inputClass}`}/></label><label className="text-xs font-semibold text-slate-600">Hasta<input type="date" required value={draft.fecha_fin} min={draft.fecha_inicio} onChange={e=>setDraft(old=>({...old,fecha_fin:e.target.value}))} className={`mt-1 block ${inputClass}`}/></label><button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Aplicar período</button></form>
      <button type="button" aria-label="Actualizar resumen" disabled={query.isFetching} onClick={()=>query.refetch()} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-40"><RefreshCw size={17}/></button>
    </fieldset>
    {(error || query.isError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error || query.error?.response?.data?.error || 'No se pudo cargar el resumen contable.'}</p>}
    {query.isPending && <p role="status" className="p-6 text-sm text-slate-500">Cargando cifras del período…</p>}
    {data && !query.isError && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Período: {data.filtros.fecha_inicio} al {data.filtros.fecha_fin} · Corte: {new Date(data.generado_en).toLocaleString('es-NI',{timeZone:'America/Managua'})}{query.isFetching?' · Actualizando…':''}</p><div className="flex gap-2">{['pdf','xlsx'].map(format=><button type="button" key={format} disabled={Boolean(exporting)||query.isFetching} onClick={()=>download(format)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-40"><FileDown size={15}/>{exporting===format?'Generando…':format==='xlsx'?'Excel':'PDF'}</button>)}</div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Ingresos registrados',data.totals.ingresos,ArrowUpRight],['Egresos registrados',data.totals.egresos,ArrowDownRight],['Flujo neto del período',data.totals.neto,WalletCards],['Cartera pendiente · todos los años',data.totals.cartera_total,WalletCards]].map(([label,value,Icon])=><article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><Icon size={20} className="text-indigo-600"/><p className={`mt-3 text-2xl font-bold ${value<0?'text-rose-700':'text-slate-900'}`}>{money(value)}</p><p className="mt-1 text-xs text-slate-500">{label}</p></article>)}</div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900"><span>Facturado: <strong>{money(data.totals.facturado)}</strong></span><span>Cobrado: <strong>{money(data.totals.cobros)}</strong></span><span>Otros ingresos: <strong>{money(data.totals.ingresos-data.totals.cobros)}</strong></span><span>Por cobrar de facturas del período: <strong>{money(data.totals.por_cobrar)}</strong></span></div>
      {(data.totals.facturas_pendientes>0 || data.totals.compras_sin_pago>0) && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{data.totals.facturas_pendientes>0 && <Link to="/contabilidad/facturacion" className="font-semibold underline">{data.totals.facturas_pendientes} facturas con saldo pendiente</Link>}{data.totals.compras_sin_pago>0 && <span>Compras sin pago documentado en el período: <strong>{money(data.totals.compras_sin_pago)}</strong></span>}</div>}
      <div ref={charts} className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Ingresos y egresos mensuales" hint="Seleccione un mes para consultar sus registros."><MonthlyChart months={data.months} onMonth={openMonth}/></ChartCard>
        <ChartCard title="Flujo acumulado" hint="Suma del flujo neto del período. No representa saldo bancario ni utilidad."><AccumulatedChart months={data.months} onMonth={openMonth}/></ChartCard>
        <ChartCard title="En qué se registra el dinero de salida" hint="Seleccione una categoría para abrir el detalle."><ExpenseChart months={data.months} onCategory={openRecords}/></ChartCard>
        <ChartCard title="Recorrido del dinero" hint="Cobros y otros ingresos, menos egresos, forman el flujo neto. La cartera se consulta aparte."><MoneyFlow totals={data.totals} onCategory={openRecords}/></ChartCard>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">{data.method}</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>openRecords()} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">Ver todos los registros del período</button><Link to={`/contabilidad/reportes?${reportQuery}`} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">Consultar margen por orden</Link></div>
      <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Detalle mensual</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{monthColumns.map(column=><th key={column.accessor} className="whitespace-nowrap p-2">{column.header}</th>)}</tr></thead><tbody>{data.months.map(row=><tr key={`${row.anio}-${row.mes}`} className="border-t border-slate-100">{monthColumns.map(column=><td key={column.accessor} className="whitespace-nowrap p-2">{column.accessor==='periodo'?monthName(row):money(row[column.accessor])}</td>)}</tr>)}</tbody></table></div></details>
    </>}
  </section>;
}
