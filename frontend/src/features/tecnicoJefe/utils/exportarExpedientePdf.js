const text = (value) => {
  if (value == null || value === '') return 'Sin registrar';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).replaceAll('_', ' ');
};
const date = (value) => value ? new Date(value).toLocaleString('es-NI', { timeZone: 'America/Managua', dateStyle: 'short', timeStyle: 'short' }) : 'Sin registrar';

export async function exportarExpedientePdf(detail, row) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const order = row.tipo === 'orden';
  const record = detail.registro;
  const diagnosis = order ? record.diagnostico : record;
  const equipment = diagnosis?.equipo;
  const title = `${order ? 'Orden' : 'Diagnóstico'} #${row.id}`;
  pdf.setFillColor(23, 37, 84);
  pdf.rect(0, 0, 210, 30, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(17);
  pdf.text(`Informe técnico · ${title}`, 14, 16);
  pdf.setFontSize(9);
  pdf.text(`SGR · Jefatura técnica · ${date(new Date())}`, 14, 24);
  pdf.setTextColor(30, 41, 59);
  let y = 36;
  const section = (heading, rows) => {
    autoTable(pdf, {
      startY: y,
      head: [[heading, 'Detalle']],
      body: rows.map(([label, value]) => [label, text(value)]),
      theme: 'grid', margin: { left: 14, right: 14, bottom: 18 },
      headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } },
    });
    y = pdf.lastAutoTable.finalY + 6;
  };
  section('Datos generales', [
    ['Cliente', equipment?.cliente?.nombre], ['Teléfono', equipment?.cliente?.telefono],
    ['Equipo', [equipment?.tipo, equipment?.marca, equipment?.modelo].filter(Boolean).join(' ')],
    ['Número de serie', equipment?.numero_serie], ['Técnico', record.tecnico?.nombre],
    ['Estado', record.estado || record.estado_del_diagnostico], ['Prioridad', record.prioridad],
    ['Ingreso', date(record.fecha_ingreso || diagnosis?.fecha_ingreso || diagnosis?.fecha_hora)],
    ['Finalización', date(record.fecha_finalizacion || record.fecha_completado)],
  ]);
  section('Diagnóstico', [
    ['Falla reportada', diagnosis?.falla_reportada], ['Informe técnico', diagnosis?.diagnostico_real],
    ['Solución propuesta', diagnosis?.solucion_propuesta],
    ['Presupuesto', diagnosis?.presupuesto_estimado == null ? null : `${diagnosis.presupuesto_estimado} ${diagnosis.moneda_presupuesto || 'NIO'}`],
    ['Control de calidad', diagnosis?.calidad_estado],
  ]);
  if (order) {
    section('Reparación y entrega', [
      ['Diagnóstico vinculado', `#${record.diagnostico_id}`], ['Monto autorizado', record.monto_autorizado],
      ['Resultado', record.resultado_final], ['Informe de reparación', record.observacion_final],
      ['Pruebas de salida', record.pruebas_salida], ['Enciende al salir', record.enciende_salida],
      ['Alimentación al salir', record.usa_corriente_ac_salida], ['Irreparabilidad', record.justificacion_irreparable],
      ['Control de calidad', record.calidad_estado], ['Entrega', date(record.fecha_entrega)],
      ['Persona que recibe', record.persona_recibe],
    ]);
    section('Piezas utilizadas', (record.repuestos_usados || []).length
      ? record.repuestos_usados.map((piece) => [piece.repuesto?.nombre || piece.pieza_solicitada || 'Pieza', `${piece.cantidad_usada || 0} unidad(es) · ${text(piece.estado_aprobacion)} · ${text(piece.estado_entrega)}`])
      : [['Piezas', 'Sin piezas registradas']]);
  }
  const history = [
    ...(detail.historial_estados || detail.historial || []).map((item) => [item.fecha_hora, 'Cambio de estado', `${text(item.estado_anterior)} → ${text(item.estado_nuevo)}. ${item.observacion || ''}`]),
    ...(detail.avances || []).map((item) => [item.fecha_hora, 'Avance técnico', item.observacion]),
    ...(detail.intervenciones || detail.correcciones || []).map((item) => [item.fecha_hora, 'Corrección', `${text(item.tipo)}: ${item.motivo || ''}`]),
  ].sort((a, b) => new Date(a[0]) - new Date(b[0]));
  section('Historial', history.length ? history.map(([when, type, note]) => [`${date(when)} · ${type}`, note]) : [['Historial', 'Sin movimientos registrados']]);
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor(100, 116, 139);
    pdf.text(`Página ${page} de ${pages}`, 196, 290, { align: 'right' });
  }
  pdf.save(`informe-${order ? 'orden' : 'diagnostico'}-${row.id}.pdf`);
}
