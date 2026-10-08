import PDFDocument from 'pdfkit';
import { formatoPresupuesto } from '../../utils/monedaPresupuesto.js';

const fecha = (value) => value ? new Date(value).toLocaleDateString('es-NI', { timeZone: 'America/Managua', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin registrar';

export const crearInformeDiagnostico = (d) => {
  const nombreNegocio = (process.env.PDF_NOMBRE_NEGOCIO || '').trim().replace(/\s+/g, ' ') || 'Servicio técnico';
  const doc = new PDFDocument({ size: 'A4', margins: { top: 104, bottom: 80, left: 44, right: 44 }, bufferPages: true,
    info: { Title: `Informe de diagnóstico #${d.id_diagnostico}`, Author: nombreNegocio } });
  const left = 44, width = doc.page.width - 88;
  const ink = '#172554', muted = '#64748B', blue = '#4338CA';
  const reference = `DIAG-${String(d.id_diagnostico).padStart(6, '0')}`;
  const header = (first) => {
    doc.save().rect(0, 0, doc.page.width, first ? 116 : 84).fill('#172554');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF').text(nombreNegocio, left, 27, { width: width - 176, height: 16, ellipsis: true });
    doc.fontSize(first ? 22 : 15).text('Informe de diagnóstico', left, first ? 53 : 49, { width });
    if (first) doc.font('Helvetica').fontSize(12).fillColor('#C7D2FE').text('y presupuesto estimado', left, 82, { width });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF').text(reference, left + width - 160, 27, { width: 160, align: 'right' });
    doc.restore(); doc.y = first ? 134 : 104;
  };
  header(true);
  const ensure = (height) => { if (doc.y + height > doc.page.height - 80) doc.addPage(); };

  const fields = [
    ['CLIENTE', d.equipo?.cliente?.nombre || 'Sin registrar'], ['TELÉFONO', d.equipo?.cliente?.telefono || 'Sin registrar'],
    ['EQUIPO', [d.equipo?.tipo, d.equipo?.marca, d.equipo?.modelo].filter(Boolean).join(' ') || 'Sin registrar'], ['NÚMERO DE SERIE', d.equipo?.numero_serie || 'Sin registrar'],
    ['FECHA DE INGRESO', fecha(d.fecha_hora)], ['FECHA DEL INFORME', fecha(d.fecha_completado || new Date())],
  ];
  for (let i = 0; i < fields.length; i += 2) {
    const cellWidth = (width - 16) / 2;
    doc.font('Helvetica').fontSize(10);
    const height = Math.max(...fields.slice(i, i + 2).map(([, value]) => doc.heightOfString(String(value), { width: cellWidth - 24 }))) + 37;
    ensure(height); const y = doc.y;
    fields.slice(i, i + 2).forEach(([label, value], column) => {
      const x = left + column * (cellWidth + 16);
      doc.roundedRect(x, y, cellWidth, height - 8, 5).fill('#F1F5F9');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(muted).text(label, x + 12, y + 10, { width: cellWidth - 24 });
      doc.font('Helvetica').fontSize(10).fillColor(ink).text(String(value), x + 12, y + 23, { width: cellWidth - 24 });
    });
    doc.y = y + height;
  }
  doc.y += 14;
  const section = (number, title, content) => {
    ensure(66); const y = doc.y;
    doc.roundedRect(left, y, 22, 22, 4).fill('#EEF2FF');
    doc.font('Helvetica-Bold').fontSize(10).fillColor(blue).text(number, left, y + 6, { width: 22, align: 'center' });
    doc.fontSize(12).fillColor(ink).text(title, left + 32, y + 4, { width: width - 32 });
    doc.font('Helvetica').fontSize(10.5).fillColor('#334155').text(String(content || 'Sin registrar'), left, y + 34, { width, lineGap: 3, paragraphGap: 5 });
    doc.y += 20;
  };
  const solution = String(d.solucion_propuesta || '').trim();
  let findings = String(d.diagnostico_real || '').trim();
  const suffix = `\n\nSolución: ${solution}`;
  if (solution && findings.endsWith(suffix)) findings = findings.slice(0, -suffix.length);
  section('01', 'Falla reportada', d.falla_reportada);
  section('02', 'Resultado del diagnóstico', findings);
  if (solution) section('03', 'Solución propuesta', solution);

  ensure(104); const budgetY = doc.y;
  doc.roundedRect(left, budgetY, width, 84, 7).fill('#EEF2FF');
  doc.font('Helvetica-Bold').fontSize(12).fillColor(ink).text('Presupuesto estimado', left + 16, budgetY + 16, { width: width - 32 });
  doc.font('Helvetica').fontSize(9).fillColor(muted).text(d.moneda_presupuesto === 'USD' ? 'Dólares estadounidenses (USD)' : 'Córdobas nicaragüenses (NIO)', left + 16, budgetY + 38, { width: width - 32 });
  doc.font('Helvetica-Bold').fontSize(22).fillColor(blue).text(d.presupuesto_estimado == null ? 'Por confirmar' : formatoPresupuesto(d.presupuesto_estimado, d.moneda_presupuesto), left + 16, budgetY + 54, { width: width - 32 });
  doc.y = budgetY + 104;

  ensure(88); const termsY = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text('Autorización y condiciones del servicio', left, termsY, { width });
  doc.font('Helvetica').fontSize(9).fillColor(muted).text('Este importe es estimado y corresponde a la moneda indicada. La reparación requiere autorización del cliente. El monto final acordado y la facturación se registran en córdobas. Los repuestos y el tiempo de reparación se confirman con el taller antes de iniciar el servicio.', left, termsY + 20, { width, lineGap: 3 });

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i); const y = doc.page.height - 44;
    if (i > 0) header(false);
    const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.save().moveTo(left, y - 12).lineTo(left + width, y - 12).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(muted).text(`Informe de diagnóstico  |  ${reference}`, left, y, { width, lineBreak: false });
    doc.text(`Página ${i + 1} de ${range.count}`, left, y, { width, align: 'right', lineBreak: false }); doc.restore();
    doc.page.margins.bottom = bottom;
  }
  return doc;
};
