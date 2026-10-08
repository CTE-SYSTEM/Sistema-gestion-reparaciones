import prisma from '../../app/prismaClient.js';
import { ORDEN_ESTADOS, PRIORIDADES, assertInList, parsePositiveId } from '../../utils/domainValidation.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';

const ordenInclude = {
  diagnostico: {
    include: {
      equipo: { include: { cliente: true } },
    },
  },
  tecnico: true,
  facturas: { select: { id_factura: true } },
  repuestos_usados: {
    include: {
      repuesto: { select: { nombre: true } },
      tecnico_solicitante: { select: { nombre: true } },
      usuario_aprobador: { select: { nombre_usuario: true } },
    },
    orderBy: { id_detalle_repuesto: 'desc' },
  },
};

const shapeOrden = (orden) => ({
  ...orden,
  diagnostico: orden.diagnostico
    ? {
        ...orden.diagnostico,
        presupuesto_estimado: orden.diagnostico.presupuesto_estimado === null
          ? null
          : Number(orden.diagnostico.presupuesto_estimado),
      }
    : null,
});


export const listarOrdenes = async (query = {}) => {
  const { page, pageSize, offset } = parsePagination(query);
  const search = String(query.search || '').trim();
  const numericSearch = /^\d+$/.test(search) && Number(search) <= 2147483647 ? Number(search) : null;
  const textMatch = { contains: search, mode: 'insensitive' };
  const where = search ? { OR: [
    ...(numericSearch ? [{ id_orden: numericSearch }] : []),
    { diagnostico: { equipo: { cliente: { nombre: textMatch } } } },
    { diagnostico: { equipo: { marca: textMatch } } },
    { diagnostico: { equipo: { modelo: textMatch } } },
  ] } : {};
  const [ordenes, total] = await Promise.all([
    prisma.ordenes.findMany({ where, include: ordenInclude, orderBy: { id_orden: 'desc' }, skip: offset, take: pageSize }),
    prisma.ordenes.count({ where }),
  ]);
  return { data: ordenes.map(shapeOrden), meta: buildPaginationMeta({ page, pageSize, total }) };
};

export const listarDiagnosticosListosParaOrden = async (query = {}) => {
  const { page, pageSize, offset } = parsePagination(query);
  const search = String(query.search || '').trim();
  const numericSearch = /^\d+$/.test(search) && Number(search) <= 2147483647 ? Number(search) : null;
  const textMatch = { contains: search, mode: 'insensitive' };
  const estadosListos = ['COMPLETADO', 'DIAGNOSTICADO'];
  const whereListos = {
    OR: [
      { estado_del_diagnostico: { in: estadosListos } },
      { estado_del_diagnostico: 'RECHAZADO', estado_equipo: 'ESPERANDO_RETIRO' },
    ],
    ordenes: { none: {} },
    factura_diagnostico: { is: null },
  };
  const where = search ? { AND: [whereListos, { OR: [
    ...(numericSearch ? [{ id_diagnostico: numericSearch }] : []),
    { falla_reportada: textMatch },
    { diagnostico_real: textMatch },
    { equipo: { cliente: { nombre: textMatch } } },
    { equipo: { marca: textMatch } },
    { equipo: { modelo: textMatch } },
    { equipo: { tipo: textMatch } },
  ] }] } : whereListos;
  const [diagnosticos, total, completados, completadosConOrden, enRevision] = await Promise.all([
    prisma.diagnosticos.findMany({
      where,
      include: {
        equipo: { include: { cliente: true } },
        tecnico: true,
      },
      orderBy: { id_diagnostico: 'desc' },
      skip: offset,
      take: pageSize,
    }),
    prisma.diagnosticos.count({ where }),
    prisma.diagnosticos.count({ where: { estado_del_diagnostico: { in: estadosListos } } }),
    prisma.diagnosticos.count({
      where: {
        estado_del_diagnostico: { in: estadosListos },
        ordenes: { some: {} },
      },
    }),
    prisma.diagnosticos.count({
      where: { estado_del_diagnostico: { in: ['PENDIENTE', 'INGRESADO', 'EN_REVISION'] } },
    }),
  ]);

  return {
    diagnosticos: diagnosticos.map((diagnostico) => ({
      id_diagnostico: diagnostico.id_diagnostico,
      falla_reportada: diagnostico.falla_reportada,
      diagnostico_real: diagnostico.diagnostico_real,
      presupuesto_estimado: diagnostico.presupuesto_estimado === null ? null : Number(diagnostico.presupuesto_estimado),
      moneda_presupuesto: diagnostico.moneda_presupuesto,
      prioridad: diagnostico.prioridad,
      estado_del_diagnostico: diagnostico.estado_del_diagnostico,
      estado_contacto: diagnostico.estado_contacto,
      estado_equipo: diagnostico.estado_equipo,
      fecha_envio_documento: diagnostico.fecha_envio_documento,
      fecha_respuesta_cliente: diagnostico.fecha_respuesta_cliente,
      observacion_respuesta: diagnostico.observacion_respuesta,
      fecha_hora: diagnostico.fecha_hora,
      equipo: diagnostico.equipo,
      tecnico: diagnostico.tecnico,
      ordenes: [],
    })),
    meta: {
      completados,
      completadosConOrden,
      listosParaOrden: total,
      enRevision,
      ...buildPaginationMeta({ page, pageSize, total }),
    },
  };
};

export const obtenerDiagnosticoParaOrden = async (diagnosticoId) => {
  const id = parsePositiveId(diagnosticoId);
  if (!id) return null;
  const diagnostico = await prisma.diagnosticos.findUnique({
    where: { id_diagnostico: id },
    include: {
      equipo: { include: { cliente: true } },
    },
  });
  if (!diagnostico) return null;

  return {
    id_diagnostico: diagnostico.id_diagnostico,
    estado_del_diagnostico: diagnostico.estado_del_diagnostico,
    diagnostico_real: diagnostico.diagnostico_real,
    presupuesto_estimado: diagnostico.presupuesto_estimado === null ? null : Number(diagnostico.presupuesto_estimado),
    moneda_presupuesto: diagnostico.moneda_presupuesto,
    equipo: diagnostico.equipo,
    orden_existente: await prisma.ordenes.count({ where: { diagnostico_id: id } }) > 0,
  };
};

export const crearOrden = async ({ diagnostico_id, tecnico_id, prioridad, monto_autorizado }, user) => {
  const diagnosticoId = parsePositiveId(diagnostico_id);
  if (!diagnosticoId) throw new Error('El diagnostico es inválido');
  const tecnicoId = tecnico_id ? parsePositiveId(tecnico_id) : null;
  if (tecnico_id && !tecnicoId) throw new Error('El técnico es inválido');
  const prioridadNormalizada = assertInList(prioridad || 'Normal', PRIORIDADES, 'Prioridad');
  const montoAutorizado = Number(monto_autorizado);
  if (!Number.isFinite(montoAutorizado) || montoAutorizado <= 0) throw new Error('El monto autorizado debe ser mayor que cero');

  const orden = await withAuditUser(user, async (tx) => {
    const diagnostico = await tx.diagnosticos.findUnique({
      where: { id_diagnostico: diagnosticoId },
      include: { equipo: { include: { cliente: true } } },
    });
    if (!diagnostico) throw new Error('Diagnostico no encontrado');
    if (!['COMPLETADO', 'DIAGNOSTICADO'].includes(diagnostico.estado_del_diagnostico)) {
      throw new Error('Solo se pueden crear ordenes desde diagnosticos completados');
    }
    if (!diagnostico.diagnostico_real || Number(diagnostico.presupuesto_estimado || 0) <= 0) {
      throw new Error('Complete informe tecnico y presupuesto antes de crear la orden');
    }
    const ordenExistente = await tx.ordenes.findFirst({ where: { diagnostico_id: diagnosticoId } });
    if (ordenExistente) throw new Error('Ya existe una orden para este diagnostico');
    if (await tx.facturas.findFirst({ where: { diagnostico_id: diagnosticoId }, select: { id_factura: true } })) {
      throw Object.assign(new Error('El diagnóstico ya fue facturado como servicio sin reparación; revise ese cobro antes de crear una orden'), { statusCode: 409 });
    }
    if (!['DOCUMENTO_ENVIADO', 'ESPERANDO_RESPUESTA'].includes(diagnostico.estado_contacto)) {
      throw new Error('Registre primero el envío del documento y la respuesta del cliente');
    }
    if (tecnicoId) await tx.tecnicos.findFirstOrThrow({ where: { id_tecnico: tecnicoId, activo: true } });

    await tx.diagnosticos.update({ where: { id_diagnostico: diagnosticoId }, data: {
      estado_contacto: 'APROBADO', estado_del_diagnostico: 'APROBADO', Estado_aprobacion: 'Aprobado',
    } });
    return tx.ordenes.create({
      data: {
        diagnostico_id: diagnosticoId,
        tecnico_id: tecnicoId,
        prioridad: prioridadNormalizada,
        estado: 'PENDIENTE',
        monto_autorizado: Math.round(montoAutorizado * 100) / 100,
        fecha_aprobacion_cliente: new Date(),
        requiere_piezas: true,
        fecha_asignacion: tecnicoId ? new Date() : null,
      },
      include: ordenInclude,
    });
  });

  return shapeOrden(orden);
};

export const crearOrdenDirecta = async ({ cliente_id, equipo_id, falla_reportada, tecnico_id, prioridad, monto_autorizado, autorizado }, user) => {
  const clienteId = cliente_id ? parsePositiveId(cliente_id) : null;
  const equipoId = parsePositiveId(equipo_id);
  const falla = String(falla_reportada || '').trim();
  const monto = Number(monto_autorizado);
  if (cliente_id && !clienteId) throw Object.assign(new Error('Seleccione un cliente válido'), { statusCode: 400 });
  if (!equipoId) throw Object.assign(new Error('Seleccione un equipo válido'), { statusCode: 400 });
  if (tecnico_id !== undefined && tecnico_id !== null && tecnico_id !== '') throw Object.assign(new Error('El jefe técnico asigna al técnico después de crear la orden'), { statusCode: 403 });
  if (falla.length < 5 || falla.length > 2000) throw Object.assign(new Error('Describa la falla conocida (5 a 2000 caracteres)'), { statusCode: 400 });
  if (!Number.isFinite(monto) || monto <= 0 || monto > 10000000) throw Object.assign(new Error('Indique el monto autorizado por el cliente'), { statusCode: 400 });
  if (autorizado !== true) throw Object.assign(new Error('Confirme que el cliente autorizó el trabajo y el monto'), { statusCode: 400 });
  const prioridadNormalizada = assertInList(prioridad || 'Normal', PRIORIDADES, 'Prioridad');
  return withAuditUser(user, async (tx) => {
    const equipo = await tx.equipos.findUnique({ where: { id_equipo: equipoId }, include: { cliente: true } });
    if (!equipo?.cliente) throw Object.assign(new Error('El equipo debe pertenecer a un cliente'), { statusCode: 400 });
    if (clienteId && equipo.cliente_id !== clienteId) throw Object.assign(new Error('El equipo no pertenece al cliente seleccionado'), { statusCode: 400 });
    const ordenActiva = await tx.ordenes.findFirst({ where: { diagnostico: { equipo_id: equipoId }, estado: { notIn: ['ENTREGADO', 'CANCELADO'] } }, select: { id_orden: true } });
    if (ordenActiva) throw Object.assign(new Error(`El equipo ya tiene la orden #${ordenActiva.id_orden} sin entregar`), { statusCode: 409 });
    const diagnostico = await tx.diagnosticos.create({ data: {
      equipo_id: equipoId, origen_directo: true, falla_reportada: falla,
      estado_del_diagnostico: 'APROBADO', Estado_aprobacion: 'Aprobado', estado_contacto: 'APROBADO',
      presupuesto_estimado: Math.round(monto * 100) / 100, prioridad: prioridadNormalizada,
      fecha_completado: new Date(), fecha_respuesta_cliente: new Date(),
    } });
    const orden = await tx.ordenes.create({ data: {
      diagnostico_id: diagnostico.id_diagnostico, tecnico_id: null, prioridad: prioridadNormalizada,
      estado: 'PENDIENTE', monto_autorizado: Math.round(monto * 100) / 100,
      fecha_aprobacion_cliente: new Date(), fecha_asignacion: null,
      requiere_piezas: true,
    }, include: ordenInclude });
    return shapeOrden(orden);
  });
};

export const actualizarOrden = async (id, { tecnico_id, prioridad, estado }, user) => {
  const ordenId = parsePositiveId(id);
  if (!ordenId) throw new Error('El ID de la orden es inválido');
  const existente = await prisma.ordenes.findUniqueOrThrow({ where: { id_orden: ordenId }, include: { diagnostico: { select: { origen_directo: true } } } });
  if (['CANCELADO', 'ENTREGADO'].includes(existente.estado)) {
    const error = new Error('La orden cerrada no admite modificaciones'); error.statusCode = 409; throw error;
  }
  const data = {};

  if (tecnico_id !== undefined) {
    if (existente.diagnostico.origen_directo) throw Object.assign(new Error('El jefe técnico asigna al técnico de una orden directa'), { statusCode: 403 });
    const tecnicoId = tecnico_id === null || tecnico_id === '' ? null : parsePositiveId(tecnico_id);
    if (tecnico_id && !tecnicoId) throw new Error('El técnico es inválido');
    if (tecnicoId) await prisma.tecnicos.findFirstOrThrow({ where: { id_tecnico: tecnicoId, activo: true } });
    data.tecnico_id = tecnicoId;
    data.fecha_asignacion = tecnicoId && !existente.fecha_asignacion ? new Date() : existente.fecha_asignacion;
  }
  if (prioridad !== undefined) data.prioridad = assertInList(prioridad, PRIORIDADES, 'Prioridad');
  if (estado !== undefined) {
    if (['ENTREGADO', 'CANCELADO'].includes(estado)) throw new Error('Use el registro de entrega o cancelación');
    data.estado = assertInList(estado, ORDEN_ESTADOS, 'Estado de la orden');
  }
  const estadoFinal = data.estado || existente.estado;
  if (['FINALIZADO', 'IRREPARABLE'].includes(estadoFinal)) data.fecha_finalizacion = existente.fecha_finalizacion || new Date();
  if (data.estado === 'FINALIZADO') Object.assign(data, { calidad_estado: 'PENDIENTE', calidad_observacion: null, calidad_revisada_en: null });
  if (estadoFinal === 'ENTREGADO') data.fecha_cierre = existente.fecha_cierre || new Date();

  const orden = await withAuditUser(user, async (tx) => {
    return tx.ordenes.update({ where: { id_orden: ordenId }, data, include: ordenInclude });
  });
  return shapeOrden(orden);
};

export const eliminarOrden = (id) => {
  const ordenId = parsePositiveId(id);
  if (!ordenId) throw new Error('El ID de la orden es inválido');
  const error = new Error('Para conservar el historial, cancele la orden en lugar de eliminarla');
  error.statusCode = 409;
  throw error;
};

export const validarOrdenDiagnosticoId = parsePositiveId;

export default {
  listarOrdenes,
  listarDiagnosticosListosParaOrden,
  obtenerDiagnosticoParaOrden,
  crearOrden,
  crearOrdenDirecta,
  actualizarOrden,
  eliminarOrden,
  validarOrdenDiagnosticoId,
};
