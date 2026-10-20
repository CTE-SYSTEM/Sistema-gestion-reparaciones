import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { FileDown, BarChart3 } from 'lucide-react';
import api from '../../../services/api';
import { AdminDataTable, formatAdminDate } from '../../admin/components/AdministrationUI';
import { reportFilename, reportIdentity, reportPeriod } from '../../admin/utils/reportIdentity';
import { saveBlob, errorText } from '../../admin/services/administracionService';

const financeLabels={facturado:'Facturado',compras_registradas:'Compras registradas',entradas_caja:'Entradas de caja',salidas_caja:'Salidas de caja',neto_caja:'Neto de caja'};
const money=value=>'C$ '+Number(value||0).toLocaleString('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2});
const year=new Intl.DateTimeFormat('en',{timeZone:'America/Managua',year:'numeric'}).format(new Date());
const control='mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm';
export default function ReportesFinancieros({integral=false}){
 const location=useLocation(),url=new URLSearchParams(location.search),basePath=integral?'/secretaria/reportes':'/contabilidad/resumen/reportes';
 const [selected,setSelected]=useState(url.get('reporte')||(integral?'ordenes_estado':'facturacion'));
 const [desde,setDesde]=useState(url.get('fecha_inicio')||year+'-01-01'),[hasta,setHasta]=useState(url.get('fecha_fin')||year+'-12-31');
 const [criteria,setCriteria]=useState(()=>url.get('reporte')?{tipo:url.get('reporte'),fecha_inicio:url.get('fecha_inicio')||year+'-01-01',fecha_fin:url.get('fecha_fin')||year+'-12-31'}:null);
 const [page,setPage]=useState(1),[exporting,setExporting]=useState(''),[error,setError]=useState('');
 const catalog=useQuery({queryKey:['reportes','catalogo',basePath],queryFn:async({signal})=>(await api.get(basePath+'/catalogo',{signal})).data.data||[]});
 const query=useQuery({queryKey:['reportes',basePath,criteria,page],enabled:Boolean(criteria),queryFn:async({signal})=>(await api.get(basePath+'/'+criteria.tipo,{params:{fecha_inicio:criteria.fecha_inicio||undefined,fecha_fin:criteria.fecha_fin||undefined,page,pageSize:20},signal,cache:false})).data});
 const result=criteria?query.data:null,identity=result?reportIdentity(result.reporte):null;
 const usesDates=Boolean(catalog.data?.find(item=>item.id===selected)?.filtros?.includes('fechas'));
 const reset=()=>{setCriteria(null);setPage(1);setError('');};
 const consult=e=>{e.preventDefault();setError('');setPage(1);setCriteria({tipo:selected,...(usesDates?{fecha_inicio:desde,fecha_fin:hasta}:{})});};
 const download=async format=>{if(!result||query.isFetching)return;setExporting(format);setError('');try{const response=await api.get(basePath+'/'+criteria.tipo+'/'+(format==='xlsx'?'excel':'pdf'),{params:{fecha_inicio:criteria.fecha_inicio||undefined,fecha_fin:criteria.fecha_fin||undefined},responseType:'blob',cache:false});saveBlob(response.data,reportFilename(result.reporte,{},format));}catch(err){setError(await errorText(err));}finally{setExporting('');}};
 return <section className="mx-auto max-w-7xl space-y-5 p-4">
 <header className="flex items-start gap-3 border-b border-slate-200 pb-4"><span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><BarChart3 size={23}/></span><div><h1 className="m-0 text-2xl font-bold text-slate-900">{integral?'Reportes del taller':'Reportes financieros'}</h1><p className="mt-1 text-sm text-slate-500">Consulte por período. PDF y Excel incluyen todos los registros filtrados y los criterios dentro del documento.</p></div></header>
 {(error||catalog.isError||criteria&&query.isError)&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error||query.error?.response?.data?.error||'No se pudo cargar el reporte o su catálogo.'}</p>}
 <form onSubmit={consult}><fieldset disabled={Boolean(exporting)||catalog.isPending} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[2fr_1fr_1fr_auto]"><label className="text-xs font-semibold text-slate-600">Reporte<select value={selected} onChange={e=>{setSelected(e.target.value);reset();}} className={control}>{(catalog.data||[]).map(item=><option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Desde<input type="date" disabled={!usesDates} value={desde} max={hasta||undefined} onChange={e=>{setDesde(e.target.value);reset();}} className={control}/></label><label className="text-xs font-semibold text-slate-600">Hasta<input type="date" disabled={!usesDates} value={hasta} min={desde||undefined} onChange={e=>{setHasta(e.target.value);reset();}} className={control}/></label><button type="submit" disabled={!selected||query.isFetching} className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Consultar</button></fieldset>{!usesDates&&<p className="mt-2 text-xs text-slate-500">Este reporte muestra el estado actual de todos los años, sin filtro de fechas.</p>}</form>
 {criteria&&query.isPending&&<p role="status" className="p-6 text-sm text-slate-500">Cargando reporte…</p>}
 {result&&!query.isError&&<section className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-bold text-slate-800">{result.reporte.nombre}</h2><p className="mt-1 text-xs text-slate-500">{[identity.area,identity.type,reportPeriod(result.filtros),result.total+' registros','Corte: '+formatAdminDate(result.generado_en)].filter(Boolean).join(' · ')}</p></div><div className="flex gap-2">{['pdf','xlsx'].map(format=><button key={format} type="button" disabled={Boolean(exporting)||query.isFetching||!result.total} onClick={()=>download(format)} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-40"><FileDown size={14}/>{exporting===format?'Generando…':format==='xlsx'?'Excel':'PDF'}</button>)}</div></div>
 {result.nota&&<p className="mb-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{result.nota}</p>}
 {result.resumen_financiero&&<div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Object.entries(result.resumen_financiero).map(([key,value])=><div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{financeLabels[key]||key.replaceAll('_',' ')}</p><p className="mt-1 text-lg font-semibold text-slate-800">{money(value)}</p></div>)}</div>}
 <AdminDataTable rows={result.data} columns={result.columns} page={page} onPageChange={setPage} pageSize={20} total={result.total} server/>
 </section>}
 {!criteria&&<p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">Seleccione un reporte y consulte el período que necesita.</p>}
 </section>;
}
