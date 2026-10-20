export function flowStepStatus(item, key) {
  const result = (label, complete = false) => ({ label, complete });
  if (key === 'cliente' || key === 'equipo') return result(item[key] ? 'Registrado' : 'Pendiente', Boolean(item[key]));
  if (key === 'diagnostico') {
    const state = item.diagnostico?.estado;
    return result(state ? state.replaceAll('_', ' ') : 'Pendiente', ['COMPLETADO', 'DIAGNOSTICADO', 'APROBADO'].includes(state));
  }
  if (key === 'orden') {
    const state = item.orden?.estado;
    return result(state ? state.replaceAll('_', ' ') : 'Pendiente', ['FINALIZADO', 'IRREPARABLE', 'ENTREGADO'].includes(state));
  }
  if (key === 'repuestos') {
    const { total = 0, entregados = 0 } = item.repuestos || {};
    return total ? result(`${entregados}/${total} entregadas`, entregados === total) : result('Sin solicitudes');
  }
  if (key === 'calidad') {
    const state = item.orden?.calidad_estado;
    return result(state ? state.replaceAll('_', ' ') : 'Pendiente', ['APROBADO', 'NO_REQUERIDO'].includes(state));
  }
  if (key === 'factura') return result(item.factura ? 'Emitida' : 'Pendiente', Boolean(item.factura));
  if (key === 'garantia') return result(item.garantia ? 'Registrada' : 'Sin garantía', Boolean(item.garantia));
  if (key === 'entrega') return result(item.orden?.estado === 'ENTREGADO' ? 'Entregado' : item.orden?.estado === 'CANCELADO' ? 'Cancelada' : 'Pendiente', item.orden?.estado === 'ENTREGADO');
  return result('Pendiente');
}
