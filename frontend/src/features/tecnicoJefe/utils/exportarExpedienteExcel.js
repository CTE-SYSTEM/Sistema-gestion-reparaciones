const asText = (value) => {
  if (value == null || value === '') return 'Sin registrar';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).replaceAll('_', ' ');
};

const asDate = (value) => value
  ? new Date(value).toLocaleString('es-NI', { timeZone: 'America/Managua', dateStyle: 'short', timeStyle: 'short' })
  : 'Sin registrar';

const addTitle = (sheet, title, subtitle) => {
  sheet.mergeCells('A1:D2');
  const cell = sheet.getCell('A1');
  cell.value = title;
  cell.font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172554' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 26;
  sheet.getRow(2).height = 20;
  sheet.mergeCells('A3:D3');
  sheet.getCell('A3').value = subtitle;
  sheet.getCell('A3').font = { italic: true, color: { argb: 'FF475569' }, size: 10 };
  sheet.getRow(3).height = 24;
  sheet.columns = [{ width: 27 }, { width: 28 }, { width: 29 }, { width: 30 }];
  sheet.views = [{ state: 'frozen', ySplit: 3 }];
  sheet.pageSetup = { fitToPage: true, fitToWidth: 1, orientation: 'portrait', paperSize: 9 };
};

const addSection = (sheet, title) => {
  sheet.addRow([]);
  const row = sheet.addRow([title]);
  sheet.mergeCells(row.number, 1, row.number, 4);
  const cell = row.getCell(1);
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  cell.alignment = { vertical: 'middle', indent: 1 };
  row.height = 23;
};

const addField = (sheet, name, value) => {
  const text = asText(value);
  const row = sheet.addRow([name, text]);
  sheet.mergeCells(row.number, 2, row.number, 4);
  row.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  row.height = Math.min(96, Math.max(22, Math.ceil(text.length / 80) * 16));
  row.eachCell((cell) => { cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }; });
};

const addTable = (sheet, headings, rows) => {
  const heading = sheet.addRow(headings);
  heading.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
  });
  heading.height = 24;
  rows.forEach((values, index) => {
    const row = sheet.addRow(values.map(asText));
    row.alignment = { wrapText: true, vertical: 'top' };
    row.height = 32;
    if (index % 2 === 0) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
  });
  if (!rows.length) addField(sheet, 'Estado', 'Sin registros');
};

export const exportarExpedienteExcel = async (detail, row) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Gestión de Reparaciones';
  workbook.created = new Date();
  const order = row.tipo === 'orden';
  const record = detail.registro;
  const diagnosis = order ? record.diagnostico : record;
  const equipment = diagnosis?.equipo;
  const title = `${order ? 'Orden' : 'Diagnóstico'} #${row.id}`;
  const sheet = workbook.addWorksheet('Expediente');
  addTitle(sheet, `Informe técnico · ${title}`, `Emitido: ${asDate(new Date())} · Jefatura técnica`);
  addSection(sheet, 'Datos generales');
  [
    ['Cliente', equipment?.cliente?.nombre], ['Teléfono', equipment?.cliente?.telefono],
    ['Equipo', [equipment?.tipo, equipment?.marca, equipment?.modelo].filter(Boolean).join(' ')],
    ['Número de serie', equipment?.numero_serie], ['Técnico responsable', record.tecnico?.nombre],
    ['Estado', record.estado || record.estado_del_diagnostico], ['Prioridad', record.prioridad],
    ['Ingreso', asDate(record.fecha_ingreso || diagnosis?.fecha_ingreso || diagnosis?.fecha_hora)],
    ['Finalización', asDate(record.fecha_finalizacion || record.fecha_completado)],
  ].forEach(([name, value]) => addField(sheet, name, value));
  addSection(sheet, 'Diagnóstico e informe');
  [
    ['Falla reportada', diagnosis?.falla_reportada], ['Informe de diagnóstico', diagnosis?.diagnostico_real],
    ['Solución propuesta', diagnosis?.solucion_propuesta],
    ['Presupuesto estimado', diagnosis?.presupuesto_estimado == null ? null : `${diagnosis.presupuesto_estimado} ${diagnosis.moneda_presupuesto || 'NIO'}`],
  ].forEach(([name, value]) => addField(sheet, name, value));
  if (order) {
    addSection(sheet, 'Resultado de la orden');
    [
      ['Orden vinculada al diagnóstico', `#${record.diagnostico_id}`], ['Monto autorizado', record.monto_autorizado],
      ['Resultado final', record.resultado_final], ['Informe de reparación', record.observacion_final],
      ['Pruebas de salida', record.pruebas_salida], ['Encendido al salir', record.enciende_salida],
      ['Alimentación al salir', record.usa_corriente_ac_salida],
      ['Justificación de irreparabilidad', record.justificacion_irreparable],
      ['Control de calidad', record.calidad_estado], ['Facturas', (record.facturas || []).map((factura) => `#${factura.id_factura}`).join(', ')],
      ['Fecha de entrega', asDate(record.fecha_entrega)], ['Persona que recibió', record.persona_recibe],
    ].forEach(([name, value]) => addField(sheet, name, value));
    const pieces = workbook.addWorksheet('Repuestos');
    addTitle(pieces, `Repuestos · ${title}`, 'Piezas registradas en el expediente');
    addTable(pieces, ['Pieza', 'Cantidad', 'Aprobación', 'Entrega'], (record.repuestos_usados || []).map((piece) => [piece.repuesto?.nombre || piece.pieza_solicitada, piece.cantidad_usada, piece.estado_aprobacion, piece.estado_entrega]));
  }
  const history = workbook.addWorksheet('Historial');
  addTitle(history, `Historial · ${title}`, 'Cambios de estado, avances y correcciones');
  addTable(history, ['Fecha', 'Tipo', 'Responsable', 'Detalle'], [
    ...(detail.historial_estados || []).map((item) => [item.fecha_hora, 'Estado', item.usuario?.nombre_usuario, `${asText(item.estado_anterior)} → ${asText(item.estado_nuevo)}. ${item.observacion || ''}`]),
    ...(detail.avances || []).map((item) => [item.fecha_hora, 'Avance', item.usuario?.nombre_usuario, item.observacion]),
    ...(detail.intervenciones || []).map((item) => [item.fecha_hora, 'Corrección', item.usuario?.nombre_usuario, `${asText(item.tipo)}: ${item.motivo || ''}`]),
  ].sort((a, b) => new Date(b[0]) - new Date(a[0])).map(([fecha, ...rest]) => [asDate(fecha), ...rest]));
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `informe-${order ? 'orden' : 'diagnostico'}-${row.id}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
