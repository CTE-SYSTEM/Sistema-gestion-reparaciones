import { createReportWorkbook } from './reportWorkbook.js';
import PDFDocument from 'pdfkit';

const text = (value) => value == null ? '' : value instanceof Date || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:/.test(value)
  ? new Date(value).toLocaleString('es-NI', { timeZone: 'America/Managua' })
  : typeof value === 'object' ? JSON.stringify(value) : String(value);
const name = (report, extension) => `${String(report.id || 'reporte').replace(/[^a-zA-Z_-]/g, '').toLowerCase() || 'reporte'}.${extension}`;
const metadata = (result) => [
  ['Reporte', result.reporte.nombre], ['Generado', text(new Date(result.generado_en))], ['Registros', result.total],
  ...Object.entries(result.filtros || {}).filter(([key]) => !['page','pageSize'].includes(key)).map(([key,value])=>[key.replaceAll('_',' '),text(value)]),
  ...(result.nota ? [['Criterio',result.nota]] : []),
  ...Object.entries(result.resumen_financiero || result.summary || {}).map(([key,value])=>[key.replaceAll('_',' '),Number(value)]),
];

export async function sendReportExcel(res, result, creator = 'SGR') {
  const book = createReportWorkbook(result, creator);
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',`attachment; filename="${name(result.reporte,'xlsx')}"`);
  return res.send(Buffer.from(await book.xlsx.writeBuffer()));
}

export async function sendReportPdf(res, result) {
  const doc=new PDFDocument({size:result.columns.length>9?'A3':'A4',layout:'landscape',margin:32,bufferPages:true,
    info:{Title:result.reporte.nombre,Author:'SGR'}});
  const chunks=[]; const bytes=new Promise((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  const width=doc.page.width-64;
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#172554').text(result.reporte.nombre);
  doc.moveDown(.5).font('Helvetica').fontSize(9).fillColor('#475569');
  for(const [label,value] of metadata(result))doc.text(`${label}: ${text(value)}`);
  doc.moveDown();
  const weights=result.columns.map(column=>/motivo|descripcion|nota/.test(column.accessor)?3:/fecha|responsable|origen|referencia/.test(column.accessor)?1.5:1);
  const weight=weights.reduce((sum,n)=>sum+n,0)||1,cellWidths=weights.map(n=>width*n/weight);
  const cellX=cellWidths.map((_,index)=>32+cellWidths.slice(0,index).reduce((sum,n)=>sum+n,0));
  const wrap = (value,index) => {
    const cellWidth=cellWidths[index];
    const lines=[];
    for(const paragraph of text(value).split('\n')) {
      let line='';
      for(const word of paragraph.split(/\s+/)) {
        if(line && doc.widthOfString(line+' '+word)>cellWidth-8){lines.push(line);line='';}
        for(const char of (line?' ':'')+word){if(line && doc.widthOfString(line+char)>cellWidth-8){lines.push(line);line='';}line+=char;}
      }
      lines.push(line);
    }
    return lines;
  };
  const header=()=>{
    doc.font('Helvetica-Bold').fontSize(8);
    const labels=result.columns.map((column,i)=>wrap(column.header,i)),height=Math.max(24,...labels.map(lines=>lines.length*11+10));
    if(doc.y+height>doc.page.height-65)doc.addPage();
    const y=doc.y;doc.rect(32,y,width,height).fill('#4338CA');
    labels.forEach((lines,i)=>lines.forEach((line,j)=>doc.fillColor('#FFFFFF').text(line,cellX[i]+4,y+5+j*11,{lineBreak:false})));
    doc.y=y+height+4;
  };
  header();
  for(const row of result.data){
    doc.font('Helvetica').fontSize(8);
    const values=result.columns.map((column,i)=>wrap(row[column.accessor],i)),lineCount=Math.max(1,...values.map(lines=>lines.length));
    let offset=0;
    while(offset<lineCount){
      if(doc.y+20>doc.page.height-38){doc.addPage();header();}
      doc.font('Helvetica').fontSize(8);
      const available=Math.max(1,Math.floor((doc.page.height-38-doc.y-8)/11)),count=Math.min(available,lineCount-offset),y=doc.y;
      values.forEach((lines,i)=>lines.slice(offset,offset+count).forEach((line,j)=>doc.fillColor('#334155').text(line,cellX[i]+4,y+3+j*11,{lineBreak:false})));
      doc.y=y+count*11+8;offset+=count;
      doc.moveTo(32,doc.y).lineTo(32+width,doc.y).strokeColor('#E2E8F0').stroke();
    }
  }
  const count=doc.bufferedPageRange().count;
  for(let i=0;i<count;i++){doc.switchToPage(i);doc.fontSize(8).fillColor('#64748B').text(`SGR · ${i+1} / ${count}`,32,doc.page.height-25,{lineBreak:false});}
  doc.end();
  res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${name(result.reporte,'pdf')}"`);
  return res.send(await bytes);
}

