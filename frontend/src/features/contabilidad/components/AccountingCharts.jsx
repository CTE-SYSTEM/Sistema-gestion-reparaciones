import './accounting.css';

const money = value => `C$ ${Number(value || 0).toLocaleString('es-NI', { maximumFractionDigits: 2 })}`;
const monthName = month => new Intl.DateTimeFormat('es-NI', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(month.anio,month.mes-1,1)));
const activate = action => event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } };
export const expenseCategories = [ ['COMPRA','Compras pagadas','compras_pagadas'], ['GASTO_OPERATIVO','Gastos operativos','gastos_operativos'], ['DEVOLUCION','Devoluciones','devoluciones'], ['COSTO_RECLAMO','Reclamos','reclamos'] ];

export function MonthlyChart({ months, onMonth }) {
  const max=Math.max(1,...months.flatMap(m=>[m.ingresos,m.egresos]));
  const width=Math.max(700,months.length*56), plot=width-70, step=plot/Math.max(1,months.length);
  return <svg data-report-chart="Ingresos y egresos por mes" role="group" aria-label="Ingresos y egresos mensuales. Seleccione un mes para ver sus registros." viewBox={`0 0 ${width} 260`} style={months.length>12?{minWidth:width}:undefined} className="h-64 w-full text-slate-500">
    <title>Ingresos y egresos mensuales</title>
    {[0,.5,1].map(r=><g key={r}><line x1="60" x2={width-10} y1={210-r*175} y2={210-r*175} stroke="currentColor" opacity=".15"/><text x="53" y={214-r*175} textAnchor="end" fill="currentColor" fontSize="14">{(max*r/1000).toLocaleString('es-NI',{maximumFractionDigits:1})} mil</text></g>)}
    {months.map((month,i)=><g key={`${month.anio}-${month.mes}`} role="button" tabIndex="0" aria-label={`${monthName(month)} ${month.anio}: ingresos ${money(month.ingresos)}, egresos ${money(month.egresos)}`} onClick={()=>onMonth(month)} onKeyDown={activate(()=>onMonth(month))} className="cursor-pointer accounting-mark">
      <title>{`${monthName(month)} ${month.anio} · Ingresos ${money(month.ingresos)} · Egresos ${money(month.egresos)} · Abrir registros`}</title>
      <rect x={60+i*step+step*.16} y={210-month.ingresos/max*175} width={step*.28} height={Math.max(month.ingresos?2:0,month.ingresos/max*175)} fill="#4f46e5" className="accounting-bar"/>
      <rect x={60+i*step+step*.49} y={210-month.egresos/max*175} width={step*.28} height={Math.max(month.egresos?2:0,month.egresos/max*175)} fill="#ea580c" className="accounting-bar"/>
      <text x={60+(i+.5)*step} y="230" textAnchor="middle" fill="currentColor" fontSize="14">{monthName(month)}</text>
      <rect x={60+i*step} y="24" width={step} height="215" fill="transparent"/>
    </g>)}
    <circle cx="75" cy="251" r="4" fill="#4f46e5"/><text x="85" y="255" fontSize="14" fill="currentColor">Ingresos</text><circle cx="165" cy="251" r="4" fill="#ea580c"/><text x="175" y="255" fontSize="14" fill="currentColor">Egresos</text>
  </svg>;
}

export function AccumulatedChart({ months, onMonth }) {
  const values=months.map(m=>m.acumulado), min=Math.min(0,...values), max=Math.max(1,...values), span=max-min;
  const width=Math.max(700,months.length*56);
  const x=i=>60+(i+.5)*(width-80)/Math.max(months.length,1), y=value=>210-(value-min)/span*175;
  return <svg data-report-chart="Flujo neto acumulado" role="group" aria-label="Flujo acumulado del período, sin saldo inicial. Seleccione un mes para ver registros." viewBox={`0 0 ${width} 260`} style={months.length>12?{minWidth:width}:undefined} className="h-64 w-full text-slate-500">
    <title>Flujo neto acumulado del período</title>
    {[min,(max+min)/2,max].map((value,i)=><g key={i}><line x1="60" x2={width-10} y1={y(value)} y2={y(value)} stroke="currentColor" opacity=".15"/><text x="53" y={y(value)+4} textAnchor="end" fill="currentColor" fontSize="14">{(value/1000).toLocaleString('es-NI',{maximumFractionDigits:1})} mil</text></g>)}
    <line x1="60" x2={width-10} y1={y(0)} y2={y(0)} stroke="currentColor" strokeDasharray="4 4" opacity=".4"/>
    <polyline points={months.map((m,i)=>`${x(i)},${y(m.acumulado)}`).join(' ')} fill="none" stroke="#4f46e5" strokeWidth="3" className="accounting-line"/>
    {months.map((m,i)=><g key={`${m.anio}-${m.mes}`} role="button" tabIndex="0" aria-label={`${monthName(m)}: flujo acumulado ${money(m.acumulado)}`} onClick={()=>onMonth(m)} onKeyDown={activate(()=>onMonth(m))} className="cursor-pointer accounting-mark"><title>{`${monthName(m)} ${m.anio}: ${money(m.acumulado)}`}</title><circle cx={x(i)} cy={y(m.acumulado)} r="5" fill="#4f46e5"/><circle cx={x(i)} cy={y(m.acumulado)} r="16" fill="transparent"/><text x={x(i)} y="233" fill="currentColor" textAnchor="middle" fontSize="14">{monthName(m)}</text></g>)}
  </svg>;
}

export function ExpenseChart({ months, onCategory }) {
  const rows=expenseCategories.map(([type,label,key])=>({type,label,value:months.reduce((sum,m)=>sum+m[key],0)}));
  const max=Math.max(1,...rows.map(row=>row.value));
  return <svg data-report-chart="Distribución de egresos" role="group" aria-label="Egresos por categoría. Seleccione una categoría para ver sus registros." viewBox="0 0 700 250" className="h-64 w-full text-slate-500"><title>Distribución de egresos</title>{rows.map((row,i)=><g key={row.type} role="button" tabIndex="0" onClick={()=>onCategory(row.type)} onKeyDown={activate(()=>onCategory(row.type))} aria-label={`${row.label}: ${money(row.value)}`} className="cursor-pointer accounting-mark"><title>{`${row.label}: ${money(row.value)} · Abrir registros`}</title><text x="15" y={35+i*53} fontSize="13" fill="currentColor">{row.label}</text><rect x="190" y={17+i*53} width={row.value/max*325} height="27" rx="5" fill="#ea580c" className="accounting-bar"/><text x="530" y={35+i*53} fontSize="13" fill="currentColor">{money(row.value)}</text><rect x="0" y={10+i*53} width="700" height="45" fill="transparent"/></g>)}</svg>;
}

export function MoneyFlow({ totals, onCategory }) {
  const others=totals.ingresos-totals.cobros;
  return <svg data-report-chart="Recorrido del dinero registrado" role="group" aria-label="Los cobros y otros ingresos alimentan el flujo registrado, del que se descuentan los egresos." viewBox="0 0 700 250" className="h-64 w-full text-slate-500">
    <title>Recorrido del dinero registrado</title>
    <path d="M210 65 C275 65 230 125 290 125 M210 180 C275 180 230 125 290 125 M490 65 C425 65 470 125 410 125" stroke="#a5b4fc" strokeWidth="3" fill="none" className="accounting-line"/>
    <text x="245" y="83" fill="currentColor" fontSize="18">+</text><text x="245" y="177" fill="currentColor" fontSize="18">+</text><text x="445" y="83" fill="currentColor" fontSize="18">−</text>
    {[[15,35,195,60,'Cobros',totals.cobros,'COBRO'],[15,150,195,60,'Otros ingresos',others,'OTRO_INGRESO'],[290,95,120,60,'Flujo neto',totals.neto,''],[490,35,195,60,'Egresos',totals.egresos,''],[490,150,195,60,'Por cobrar actual',totals.cartera_total,'']].map(([x,y,w,h,label,value,type])=><g key={label} role={type?'button':undefined} tabIndex={type?0:undefined} onClick={type?()=>onCategory(type):undefined} onKeyDown={type?activate(()=>onCategory(type)):undefined} aria-label={`${label}: ${money(value)}`} className={type?'cursor-pointer accounting-mark':''}><rect x={x} y={y} width={w} height={h} rx="10" fill="#4f46e5" opacity=".12"/><text x={x+w/2} y={y+22} textAnchor="middle" fill="currentColor" fontSize="12">{label}</text><text x={x+w/2} y={y+44} textAnchor="middle" fill="currentColor" fontSize="15" fontWeight="600">{money(value)}</text></g>)}
  </svg>;
}
