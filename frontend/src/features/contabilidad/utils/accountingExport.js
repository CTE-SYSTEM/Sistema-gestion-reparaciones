export const money = value => `C$ ${Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const monthName = row => new Intl.DateTimeFormat('es-NI', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(row.anio,row.mes-1,1)));
export const monthColumns = [['periodo','Mes'],['cobros','Cobros'],['otros_ingresos','Otros ingresos'],['compras','Compras registradas'],['compras_pagadas','Compras pagadas'],['devoluciones','Devoluciones'],['reclamos','Reclamos'],['gastos_operativos','Gastos'],['ingresos','Ingresos'],['egresos','Egresos'],['neto','Flujo neto'],['acumulado','Flujo acumulado']].map(([accessor,header])=>({accessor,header}));

export async function captureAccountingCharts(element) {
  const images=[];
  for (const svg of element?.querySelectorAll('svg[data-report-chart]') || []) {
    const clone=svg.cloneNode(true), original=[svg,...svg.querySelectorAll('*')], nodes=[clone,...clone.querySelectorAll('*')];
    original.forEach((node,index)=>{const style=getComputedStyle(node);for(const key of ['fill','stroke','color','font-size','font-family','font-weight','opacity'])nodes[index].style.setProperty(key,style.getPropertyValue(key));nodes[index].style.animation='none';nodes[index].style.transform='none';if(node.classList.contains('accounting-bar')||node.classList.contains('accounting-line'))nodes[index].style.opacity='1';if(node.tagName.toLowerCase()==='text')nodes[index].style.fill='#475569';});
    const box=svg.viewBox.baseVal, width=box.width || 700, height=box.height || 260;
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',width);clone.setAttribute('height',height);
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));
    try {
      const image=new Image();image.src=url;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(2,2);ctx.drawImage(image,0,0,width,height);
      images.push({title:svg.dataset.reportChart,dataUrl:canvas.toDataURL('image/png'),width,height});
    } finally {URL.revokeObjectURL(url);}
  }
  return images;
}

export async function exportAccountingSummary(data, format, element, responsible) {
  const {downloadJsonExcel,downloadSectionedPdf}=await import('../../admin/utils/csvExport');
  const images=await captureAccountingCharts(element);
  const metadata=[{label:'Desde',value:data.filtros.fecha_inicio},{label:'Hasta',value:data.filtros.fecha_fin},
    {label:'Fecha de corte',value:new Date(data.generado_en).toLocaleString('es-NI',{timeZone:'America/Managua'})},
    {label:'Emitido por',value:responsible || 'Usuario autenticado'},{label:'Moneda',value:'Córdobas (C$)'}];
  const rows=data.months.map(row=>({...row,periodo:monthName(row)}));
  if(format==='xlsx')return downloadJsonExcel(rows,monthColumns,'resumen-contable.xlsx',{title:'Resumen contable',metadata,description:data.method,summary:data.totals,images});
  const columns=[{accessor:'indicador',header:'Indicador'},{accessor:'valor',header:'Valor'}];
  const indicators=Object.entries(data.totals).map(([key,value])=>({indicador:key.replaceAll('_',' '),valor:key==='facturas_pendientes'?value:money(value)}));
  return downloadSectionedPdf({title:'Resumen contable',filename:'resumen-contable.pdf',metadata,description:data.method,recordCount:rows.length,
    sections:[{title:'Indicadores del período y cartera actual',rows:indicators,columns},...images.map(image=>({title:image.title,image})),{title:'Detalle mensual',rows,columns:monthColumns,pageBreakBefore:true}]});
}
