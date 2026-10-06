export const diagnosticosCerrados = ['COMPLETADO', 'DIAGNOSTICADO', 'APROBADO', 'RECHAZADO'];
export const ordenCerradaWhere = { OR: [{ estado: { in: ['FINALIZADO', 'ENTREGADO', 'CANCELADO'] } }, { estado: 'IRREPARABLE', irreparable_estado: 'APROBADO' }] };

export const inicioPeriodo = (periodo, now = new Date()) => {
  if (!['hoy', 'mes', 'anio'].includes(periodo)) return null;
  const local = new Date(now.getTime() - 6 * 3600000);
  return new Date(Date.UTC(local.getUTCFullYear(), periodo === 'anio' ? 0 : local.getUTCMonth(),
    periodo === 'hoy' ? local.getUTCDate() : 1, 6));
};
export const filtroFecha = (fields, periodo) => {
  const inicio = inicioPeriodo(periodo);
  if (!inicio) return {};
  return { OR: fields.map((field, i) => ({ AND: [
    ...fields.slice(0, i).map((previous) => ({ [previous]: null })), { [field]: { gte: inicio } },
  ] })) };
};
export const filtroTrabajo = (kind, tecnicoId, query = {}) => {
  const diagnostico = kind === 'diagnostico';
  const grupo = query.grupo || 'activos';
  const closed = diagnostico ? { estado_del_diagnostico: { in: diagnosticosCerrados } } : ordenCerradaWhere;
  const active = { NOT: closed };
  const states = diagnostico ? 'estado_del_diagnostico' : 'estado';
  const filters = [{ tecnico_id: tecnicoId }, grupo === 'completados' ? closed : active];
  if (diagnostico && grupo !== 'completados') filters.push({ ordenes: { none: {} } });
  if (grupo === 'por_iniciar') filters.push({ [diagnostico ? 'fecha_inicio' : 'fecha_inicio_reparacion']: null });
  if (grupo === 'revision_jefe' && !diagnostico) filters.push({ estado: 'IRREPARABLE', irreparable_estado: 'PENDIENTE' });
  if (grupo === 'esperando_piezas' && !diagnostico) filters.push({ estado: 'ESPERANDO_PIEZA' });
  if (query.estado) filters.push({ [states]: String(query.estado).toUpperCase() });
  if (query.prioridad) filters.push({ prioridad: { equals: String(query.prioridad), mode: 'insensitive' } });
  const fields = grupo === 'completados'
    ? diagnostico ? ['fecha_completado', 'fecha_hora'] : ['fecha_finalizacion', 'fecha_entrega', 'fecha_cancelacion', 'fecha_ingreso']
    : diagnostico ? ['fecha_asignacion', 'fecha_hora'] : ['fecha_asignacion', 'fecha_ingreso'];
  filters.push(filtroFecha(fields, query.periodo));
  const search = String(query.search || '').trim().slice(0, 120);
  if (search) {
    const equipment = { OR: ['tipo', 'marca', 'modelo'].map((key) => ({ [key]: { contains: search, mode: 'insensitive' } })) };
    // Nunca buscar en informes/notas originales: sus coincidencias revelarían texto reservado.
    const diagSearch = { equipo: equipment };
    filters.push({ OR: [
      ...(Number.isInteger(Number(search)) && Number(search) > 0 ? [{ [diagnostico ? 'id_diagnostico' : 'id_orden']: Number(search) }] : []),
      diagnostico ? diagSearch : { diagnostico: diagSearch },
    ] });
  }
  return { AND: filters };
};

// Ordenar por urgencia antes de paginar, sin cambiar el enum legado de prioridades.
export const paginaPrioritaria = async (model, where, include, pagination, kind) => {
  const priorities = [{ prioridad: { in: ['URGENTE', 'Urgente'] } }, { prioridad: { in: ['ALTA', 'Alta'] } },
    { OR: [{ prioridad: null }, { prioridad: { notIn: ['URGENTE', 'Urgente', 'ALTA', 'Alta'] } }] }];
  const groups = await Promise.all(priorities.map((priority) => model.count({ where: { AND: [where, priority] } })));
  const data = [];
  let skip = pagination.offset, remaining = pagination.pageSize;
  for (let i = 0; i < groups.length && remaining > 0; i += 1) {
    if (skip >= groups[i]) { skip -= groups[i]; continue; }
    const rows = await model.findMany({ where: { AND: [where, priorities[i]] }, include,
      orderBy: [{ fecha_asignacion: 'asc' }, { [kind === 'diagnostico' ? 'id_diagnostico' : 'id_orden']: 'asc' }], skip, take: remaining });
    data.push(...rows); remaining -= rows.length; skip = 0;
  }
  return { data, total: groups.reduce((sum, n) => sum + n, 0) };
};
