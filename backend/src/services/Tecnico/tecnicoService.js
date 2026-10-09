import prisma from '../../app/prismaClient.js';
import { Prisma } from '@prisma/client';
import { withAuditUser } from '../../utils/auditContext.js';
import { ORDEN_ESTADOS, RESULTADOS_ORDEN, assertInList, parseNonNegativeMoney, parsePositiveId } from '../../utils/domainValidation.js';
import { assertPuedeFinalizar, assertTrabajoPropio, auditMotivo, fail, lockTrabajo, motivoObligatorio } from '../../utils/tecnicoWorkflow.js';
import { stockDisponible } from './stockDisponible.js';
import { monedaPresupuesto } from '../../utils/monedaPresupuesto.js';
import { normalizeRole } from '../../utils/roles.js';
import { pruebasSalidaPorTipo } from '../../utils/pruebasSalida.js';
import { validarCorreccionCierre } from '../../utils/correccionCierre.js';
import { getBusinessSettings } from '../adminSettingsService.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';
import { diagnosticoTecnico, ordenTecnica, solicitudTecnica, historialTecnico, avanceTecnico, textoTecnico } from './expedienteTecnico.js';
import { diagnosticosCerrados, filtroTrabajo, filtroFecha, ordenCerradaWhere, paginaPrioritaria } from './consultaTecnica.js';

const repuestoSafeSelect = {
  id_repuesto: true,
  tipo_repuesto_id: true,
  proveedor_id: true,
  nombre: true,
  descripcion: true,
  costo_individual: true,
  porcentaje_de_ganacia: true,
  ganancia_cordobas: true,
  activo: true,
  descontinuada: true,
};

const ordenInclude = {
  historial_estados: { orderBy: { fecha_hora: 'desc' }, take: 1 },
  avances_tecnicos: { orderBy: { fecha_hora: 'desc' }, take: 1 },
  tecnico: true,
  facturas: { select: { id_factura: true } },
  diagnostico: {
    include: {
      equipo: { include: { cliente: true } },
      tecnico: true,
    },
  },
  repuestos_usados: {
    include: { repuesto: { select: repuestoSafeSelect }, usuario_aprobador: { select: { nombre_usuario: true } }, usuario_entregador: { select: { nombre_usuario: true } } },
    orderBy: { id_detalle_repuesto: 'desc' },
  },
};

const diagnosticoInclude = {
  historial_estados: { orderBy: { fecha_hora: 'desc' }, take: 1 },
  avances_tecnicos: { orderBy: { fecha_hora: 'desc' }, take: 1 },
  equipo: { include: { cliente: true } },
  tecnico: true,
  ordenes: { select: { id_orden: true }, take: 1 },
  factura_diagnostico: { select: { id_factura: true } },
};

export const getDatabaseMessage = (error) => {
  const message = error?.meta?.message || error?.message || '';
  const match = message.match(/ERROR:\s*(.*)$/m);
  return match?.[1] || message;
};

export const findTecnicos = () => prisma.tecnicos.findMany({ orderBy: { id_tecnico: 'asc' } });

export const createTecnico = async (data) => {
  const nombre = String(data.nombre || '').trim();
  if (!nombre) {
    const error = new Error('El nombre del tecnico es obligatorio');
    error.statusCode = 400;
    throw error;
  }
  const usuarioId = data.usuario_id === undefined || data.usuario_id === null || data.usuario_id === ''
    ? null
    : parsePositiveId(data.usuario_id);
  if (data.usuario_id !== undefined && data.usuario_id !== null && data.usuario_id !== '' && !usuarioId) {
    const error = new Error('El usuario seleccionado no es valido');
    error.statusCode = 400;
    throw error;
  }
  if (usuarioId) {
    const usuario = await prisma.usuarios.findUnique({ where: { id_usuario: usuarioId } });
    if (!usuario?.activo || normalizeRole(usuario.rol) !== 'tecnico') fail(400, 'El perfil debe vincularse a una cuenta activa de rol Técnico');
  }

  return prisma.tecnicos.create({
    data: {
      nombre,
      especialidad: data.especialidad?.trim() || null,
      horario: data.horario?.trim() || null,
      contacto: data.contacto?.trim() || null,
      usuario_id: usuarioId,
      activo: data.activo === undefined ? true : Boolean(data.activo),
    },
  });
};

export const getTecnicoActivoByUsername = (username) =>
  prisma.tecnicos.findFirst({
    where: { usuario: { nombre_usuario: username }, activo: true },
  });

export const getMisDiagnosticos = async (username, query = {}) => {
  const tecnico = await getTecnicoActivoByUsername(username);
  if (!tecnico) return { tecnico: null, data: [] };

  const pagination = parsePagination(query);
  const result = await paginaPrioritaria(prisma.diagnosticos, filtroTrabajo('diagnostico', tecnico.id_tecnico, query), diagnosticoInclude, pagination, 'diagnostico');
  return { data: result.data.map(diagnosticoTecnico), meta: buildPaginationMeta({ ...pagination, total: result.total }) };
};

export const getMisOrdenes = async (username, query = {}) => {
  const tecnico = await getTecnicoActivoByUsername(username);
  if (!tecnico) return { tecnico: null, data: [] };

  const pagination = parsePagination(query);
  const [result, settings] = await Promise.all([
    paginaPrioritaria(prisma.ordenes, filtroTrabajo('orden', tecnico.id_tecnico, query), ordenInclude, pagination, 'orden'),
    getBusinessSettings(),
  ]);
  return { data: result.data.map((orden) => ordenTecnica(orden, settings.reglas)), meta: buildPaginationMeta({ ...pagination, total: result.total }) };
};

export const completarDiagnostico = async (diagnosticoId, payload, user) => {
  const id = parsePositiveId(diagnosticoId);
  if (!id) {
    const error = new Error('El diagnostico seleccionado no es valido');
    error.statusCode = 400;
    throw error;
  }
  const diagnosticoReal = String(payload.diagnostico_real || '').trim();
  if (!diagnosticoReal) {
    const error = new Error('El informe tecnico es obligatorio');
    error.statusCode = 400;
    throw error;
  }
  const presupuestoEstimado = payload.presupuesto_estimado === '' || payload.presupuesto_estimado === null || payload.presupuesto_estimado === undefined
    ? null
    : parseNonNegativeMoney(payload.presupuesto_estimado, 'El presupuesto estimado');

  const diagnostico = await withAuditUser(user, async (tx) => {
    await lockTrabajo(tx, 'diagnostico', id);
    const actual = await tx.diagnosticos.findUnique({ where: { id_diagnostico: id } });
    if (!actual) {
      const error = new Error('Diagnostico no encontrado');
      error.statusCode = 404;
      throw error;
    }
    await assertTrabajoPropio(tx, user, actual.tecnico_id);
    if (actual.estado_del_diagnostico !== 'EN_REVISION' || !actual.fecha_inicio) {
      fail(409, 'Registre el inicio del diagnóstico antes de completarlo; los diagnósticos cerrados no admiten cambios');
    }
    return tx.diagnosticos.update({
      where: { id_diagnostico: id },
      data: {
        // Recepción y su documento conservan el informe completo del contrato existente.
        diagnostico_real: payload.solucion_propuesta ? `${diagnosticoReal}\n\nSolución: ${String(payload.solucion_propuesta).trim()}` : diagnosticoReal,
        solucion_propuesta: String(payload.solucion_propuesta || '').trim() || null,
        borrador_tecnico: Prisma.DbNull,
        presupuesto_estimado: presupuestoEstimado,
        moneda_presupuesto: monedaPresupuesto(payload.moneda_presupuesto, actual.moneda_presupuesto),
        estado_del_diagnostico: 'COMPLETADO',
        calidad_estado: 'PENDIENTE',
        fecha_completado: new Date(),
      },
      include: diagnosticoInclude,
    });
  });
  return diagnosticoTecnico(diagnostico);
};

export const actualizarEstadoOrden = async (ordenId, payload, user) => {
  const id = parsePositiveId(ordenId);
  if (!id) {
    const error = new Error('La orden seleccionada no es valida');
    error.statusCode = 400;
    throw error;
  }
  const { estado, resultado_final, enciende_salida, usa_corriente_ac_salida, observacion_final } = payload;
  if (!estado) {
    const error = new Error('El estado es obligatorio');
    error.statusCode = 400;
    throw error;
  }
  const estadoNuevo = String(assertInList(String(estado).toUpperCase(), ORDEN_ESTADOS, 'Estado de la orden')).toUpperCase();
  if (!['EN_REPARACION', 'FINALIZADO', 'IRREPARABLE'].includes(estadoNuevo)) {
    const error = new Error('Este estado solo puede cambiarse desde el flujo del tecnico');
    error.statusCode = 400;
    throw error;
  }
  const estadoCierre = estadoNuevo === 'FINALIZADO';
  const estadoIrreparable = estadoNuevo === 'IRREPARABLE';
  const observacion = String(observacion_final || '').trim();
  if (estadoCierre && !observacion) {
    const error = new Error('La observacion final es obligatoria para cerrar la orden');
    error.statusCode = 400;
    throw error;
  }
  if (estadoCierre && (typeof enciende_salida !== 'boolean' || typeof usa_corriente_ac_salida !== 'boolean')) {
    fail(400, 'Registre explícitamente las pruebas de encendido y alimentación antes de finalizar');
  }
  if (estadoIrreparable && [enciende_salida, usa_corriente_ac_salida].some((value) => value !== undefined && value !== null && typeof value !== 'boolean')) {
    fail(400, 'Los resultados de encendido y alimentación deben ser booleanos o quedar sin registrar');
  }
  if (estadoIrreparable && !observacion) {
    const error = new Error('La justificacion de irreparabilidad es obligatoria');
    error.statusCode = 400;
    throw error;
  }

  const orden = await withAuditUser(user, async (tx) => {
    await lockTrabajo(tx, 'orden', id);
    const actual = await tx.ordenes.findUnique({
      where: { id_orden: id },
      include: { repuestos_usados: true, diagnostico: { select: { equipo: { select: { tipo: true } } } } },
    });
    if (!actual) {
      const error = new Error('Orden no encontrada');
      error.statusCode = 404;
      throw error;
    }
    await assertTrabajoPropio(tx, user, actual.tecnico_id);
    if (estadoCierre) assertPuedeFinalizar(actual);
    const pruebasSalida = estadoCierre ? validarPruebas(payload.pruebas_salida, actual.diagnostico.equipo.tipo) : null;
    if (estadoIrreparable && !actual.fecha_inicio_reparacion) fail(409, 'Inicie la reparación antes de reportar irreparabilidad');
    if (estadoNuevo === 'EN_REPARACION' && actual.estado === 'ESPERANDO_PIEZA' && actual.repuestos_usados.some((p) => p.estado_aprobacion === 'PENDIENTE' || (p.estado_aprobacion === 'APROBADO' && p.estado_entrega !== 'ENTREGADO'))) fail(409, 'Las piezas pendientes deben resolverse antes de reanudar');
    await auditMotivo(tx, observacion || 'Inicio o reanudación de reparación');
    if (['FINALIZADO', 'ENTREGADO', 'IRREPARABLE', 'CANCELADO'].includes(String(actual.estado || '').toUpperCase())) {
      const error = new Error('Esta orden ya esta cerrada');
      error.statusCode = 409;
      throw error;
    }

    return tx.ordenes.update({
      where: { id_orden: id },
      data: {
        estado: estadoNuevo,
        fecha_inicio_reparacion: actual.fecha_inicio_reparacion || (estadoNuevo === 'EN_REPARACION' ? new Date() : null),
        resultado_final: estadoCierre || estadoIrreparable
          ? assertInList(resultado_final || (estadoIrreparable ? 'IRREPARABLE' : 'REPARADO'), RESULTADOS_ORDEN, 'Resultado final')
          : actual.resultado_final,
        enciende_salida: estadoCierre || estadoIrreparable ? enciende_salida ?? null : actual.enciende_salida,
        usa_corriente_ac_salida: estadoCierre || estadoIrreparable ? usa_corriente_ac_salida ?? null : actual.usa_corriente_ac_salida,
        observacion_final: estadoCierre || estadoIrreparable ? observacion : actual.observacion_final,
        pruebas_salida: estadoCierre ? pruebasSalida : actual.pruebas_salida,
        fecha_cierre: estadoCierre ? new Date() : actual.fecha_cierre,
        fecha_finalizacion: estadoCierre ? new Date() : actual.fecha_finalizacion,
        calidad_estado: estadoCierre ? 'PENDIENTE' : actual.calidad_estado,
        ...(estadoCierre ? { calidad_observacion: null, calidad_revisada_en: null } : {}),
        justificacion_irreparable: estadoIrreparable ? observacion : actual.justificacion_irreparable,
        irreparable_estado: estadoIrreparable ? 'PENDIENTE' : actual.irreparable_estado,
        ...(estadoIrreparable ? { usuario_revisor_irreparable_id: null, fecha_revision_irreparable: null, motivo_revision_irreparable: null } : {}),
      },
      include: ordenInclude,
    });
  });
  return ordenTecnica(orden);
};

export const iniciarDiagnostico = (value, user) => withAuditUser(user, async (tx) => {
  const id = parsePositiveId(value);
  if (!id) fail(400, 'Diagnóstico no válido');
  await lockTrabajo(tx, 'diagnostico', id);
  const actual = await tx.diagnosticos.findUnique({ where: { id_diagnostico: id } });
  if (!actual) fail(404, 'Diagnóstico no encontrado');
  await assertTrabajoPropio(tx, user, actual.tecnico_id);
  if (!['PENDIENTE', 'INGRESADO', 'ASIGNADO', 'EN_REVISION'].includes(actual.estado_del_diagnostico) || actual.fecha_inicio) fail(409, 'Este diagnóstico ya comenzó o está cerrado');
  await auditMotivo(tx, 'Inicio real del diagnóstico por el técnico asignado');
  return diagnosticoTecnico(await tx.diagnosticos.update({ where: { id_diagnostico: id }, data: { estado_del_diagnostico: 'EN_REVISION', fecha_inicio: new Date() }, include: diagnosticoInclude }));
});

export const solicitarRepuesto = async (ordenId, payload, username, user) => {
  const id = parsePositiveId(ordenId);
  if (!id) {
    const error = new Error('La orden seleccionada no es valida');
    error.statusCode = 400;
    throw error;
  }
  const { repuesto_id, repuesto, cantidad, solicitar_sin_registro } = payload;
  const cantidadUsada = cantidad === undefined || cantidad === '' ? 1 : Number(cantidad);
  if (!Number.isInteger(cantidadUsada) || cantidadUsada < 1) {
    const error = new Error('La cantidad debe ser un entero mayor a cero');
    error.statusCode = 400;
    throw error;
  }
  const esSolicitudSinRegistro = solicitar_sin_registro === true || solicitar_sin_registro === 'true';
  const tecnico = await getTecnicoActivoByUsername(username);
  if (!tecnico) {
    const error = new Error('Tecnico no encontrado o inactivo');
    error.statusCode = 403;
    throw error;
  }

  const solicitud = await withAuditUser(user, async (tx) => {
    await lockTrabajo(tx, 'orden', id);
    const orden = await tx.ordenes.findUnique({
      where: { id_orden: id },
      include: { tecnico: true, diagnostico: { include: { tecnico: true } } },
    });
    if (!orden) {
      const error = new Error('Orden no encontrada');
      error.statusCode = 404;
      throw error;
    }
    if (['FINALIZADO', 'ENTREGADO', 'IRREPARABLE', 'CANCELADO'].includes(String(orden.estado || '').toUpperCase())) {
      const error = new Error('No se pueden solicitar repuestos para una orden cerrada');
      error.statusCode = 409;
      throw error;
    }
    const tecnicoOrdenId = orden.tecnico_id;
    if (Number(tecnicoOrdenId) !== Number(tecnico.id_tecnico)) {
      const error = new Error('No puede solicitar repuestos para una orden que no tiene asignado este tecnico');
      error.statusCode = 403;
      throw error;
    }
    if (!orden.fecha_inicio_reparacion) fail(409, 'Inicie la reparación antes de solicitar piezas');

    let repuestoId = repuesto_id === undefined || repuesto_id === null || repuesto_id === '' ? null : parsePositiveId(repuesto_id);
    if (repuesto_id && !repuestoId) {
      const error = new Error('El repuesto seleccionado no es valido');
      error.statusCode = 400;
      throw error;
    }
    let repuestoEncontrado = null;
    const nombreSolicitado = String(repuesto || '').trim();
    if (!repuestoId && nombreSolicitado) {
      repuestoEncontrado = await tx.repuestos.findFirst({
        where: { nombre: { equals: nombreSolicitado, mode: 'insensitive' }, descontinuada: false },
      });
      if (repuestoEncontrado) repuestoId = repuestoEncontrado.id_repuesto;
      else if (!esSolicitudSinRegistro) {
        const error = new Error('esta pieza no existe');
        error.statusCode = 404;
        error.code = 'PIEZA_NO_EXISTE';
        throw error;
      }
    }
    if (!repuestoId && !nombreSolicitado) {
      const error = new Error('Indique que pieza necesita solicitar');
      error.statusCode = 400;
      throw error;
    }
    if (repuestoId) {
      const repuestoActual = repuestoEncontrado || await tx.repuestos.findFirst({ where: { id_repuesto: repuestoId, descontinuada: false } });
      if (!repuestoActual) {
        const error = new Error('El repuesto seleccionado no existe o esta descontinuado');
        error.statusCode = 400;
        throw error;
      }
      if (await stockDisponible(tx, repuestoId) < cantidadUsada) {
        const error = new Error('Stock insuficiente para solicitar el repuesto');
        error.statusCode = 409;
        throw error;
      }
      if (!nombreSolicitado) repuestoEncontrado = repuestoActual;
    }

    await tx.ordenes.update({
      where: { id_orden: id },
      data: { estado: 'ESPERANDO_PIEZA' },
    });

    return tx.ordenes_Repuestos.create({
      data: {
        orden_id: id,
        repuesto_id: repuestoId,
        pieza_solicitada: nombreSolicitado || repuestoEncontrado?.nombre || String(repuestoId),
        cantidad_usada: cantidadUsada,
        tecnico_solicitante_id: tecnico.id_tecnico,
        estado_aprobacion: 'PENDIENTE',
      },
      include: {
        repuesto: { select: repuestoSafeSelect },
        orden: {
          include: {
            tecnico: true,
            diagnostico: { include: diagnosticoInclude },
          },
        },
      },
    });
  });

  return solicitudTecnica(solicitud, solicitud.orden?.diagnostico?.equipo?.cliente);
};

const validarPruebas = (value, tipo) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Registre las pruebas de salida del equipo');
  const result = {};
  for (const key of ['encendido', 'alimentacion', 'funcion_principal', 'carga', 'pantalla', 'conectividad']) {
    if (value[key] !== undefined) {
      if (!['CORRECTO', 'FALLA', 'NO_APLICA'].includes(value[key])) fail(400, 'Resultado de prueba no válido');
      result[key] = value[key];
    }
  }
  if (pruebasSalidaPorTipo(tipo).some((key) => !result[key])) fail(400, 'Complete todas las pruebas de salida correspondientes al tipo de equipo');
  return result;
};

export const corregirCierreOrden = (value, payload, user) => withAuditUser(user, async (tx) => {
  const id = parsePositiveId(value);
  if (!id) fail(400, 'Orden no válida');
  await lockTrabajo(tx, 'orden', id);
  const orden = await tx.ordenes.findUnique({ where: { id_orden: id }, include: ordenInclude });
  if (!orden) fail(404, 'Orden no encontrada');
  await assertTrabajoPropio(tx, user, orden.tecnico_id);
  const correccion = validarCorreccionCierre(orden, payload, (await getBusinessSettings()).reglas);
  const tipo = String(payload?.tipo || '').toUpperCase();
  if (!['CORREGIR', 'ACLARAR', 'REABRIR'].includes(tipo)) fail(400, 'Seleccione corregir informe, agregar aclaración o reabrir la reparación');
  if (tipo !== 'ACLARAR' && !correccion.puede_editar_informe) fail(409, 'El cierre facturado, entregado o irreparable solo admite aclaraciones');
  const anterior = { observacion_final: orden.observacion_final, enciende_salida: orden.enciende_salida,
    usa_corriente_ac_salida: orden.usa_corriente_ac_salida, pruebas_salida: orden.pruebas_salida };
  let actualizado = orden;
  let aclaracion = null;
  if (tipo === 'CORREGIR') {
    const observacion = String(payload.observacion_final || '').trim();
    if (!observacion || observacion.length > 4000) fail(400, 'Registre el informe final corregido, hasta 4000 caracteres');
    if (typeof payload.enciende_salida !== 'boolean' || typeof payload.usa_corriente_ac_salida !== 'boolean') fail(400, 'Registre ambas comprobaciones de salida');
    const pruebas = validarPruebas(payload.pruebas_salida, orden.diagnostico.equipo.tipo);
    const nuevoInforme = { observacion_final: observacion, enciende_salida: payload.enciende_salida,
      usa_corriente_ac_salida: payload.usa_corriente_ac_salida, pruebas_salida: pruebas };
    if (JSON.stringify(anterior) === JSON.stringify(nuevoInforme)) fail(400, 'Modifique al menos un dato del informe');
    const nuevo = { ...nuevoInforme, calidad_estado: 'PENDIENTE', calidad_observacion: null, calidad_revisada_en: null };
    await auditMotivo(tx, correccion.motivo, correccion.es_excepcion);
    actualizado = await tx.ordenes.update({ where: { id_orden: id }, data: nuevo, include: ordenInclude });
  } else if (tipo === 'REABRIR') {
    await auditMotivo(tx, correccion.motivo, correccion.es_excepcion);
    actualizado = await tx.ordenes.update({ where: { id_orden: id }, data: {
      estado: 'EN_REPARACION', resultado_final: null, observacion_final: null,
      enciende_salida: null, usa_corriente_ac_salida: null, pruebas_salida: Prisma.DbNull,
      fecha_finalizacion: null, fecha_cierre: null,
      calidad_estado: 'NO_REQUERIDO', calidad_observacion: null, calidad_revisada_en: null,
    }, include: ordenInclude });
  } else {
    aclaracion = String(payload.aclaracion || '').trim();
    if (!aclaracion || aclaracion.length > 4000) fail(400, 'Escriba la aclaración técnica, hasta 4000 caracteres');
    await auditMotivo(tx, correccion.motivo, correccion.es_excepcion);
  }
  await tx.intervencionesTecnicas.create({ data: { orden_id: id,
    tipo: tipo === 'CORREGIR' ? 'CORRECCION_CIERRE' : tipo === 'REABRIR' ? 'REAPERTURA_CIERRE' : 'ACLARACION_CIERRE',
    motivo: correccion.motivo, usuario_id: user.id, datos_anteriores: { ...anterior, estado: orden.estado,
      resultado_final: orden.resultado_final, fecha_finalizacion: orden.fecha_finalizacion, fecha_cierre: orden.fecha_cierre },
    datos_nuevos: { observacion_final: actualizado.observacion_final, enciende_salida: actualizado.enciende_salida,
      usa_corriente_ac_salida: actualizado.usa_corriente_ac_salida, pruebas_salida: actualizado.pruebas_salida,
      estado: actualizado.estado, aclaracion, es_excepcion: correccion.es_excepcion } } });
  return ordenTecnica(actualizado);
});

export const corregirDiagnostico = (value, payload, user) => withAuditUser(user, async (tx) => {
  const id = parsePositiveId(value);
  if (!id) fail(400, 'Diagnóstico no válido');
  await lockTrabajo(tx, 'diagnostico', id);
  const actual = await tx.diagnosticos.findUnique({ where: { id_diagnostico: id }, include: diagnosticoInclude });
  if (!actual) fail(404, 'Diagnóstico no encontrado');
  await assertTrabajoPropio(tx, user, actual.tecnico_id);
  const motivo = motivoObligatorio(payload.motivo);
  const tipo = String(payload.tipo || '').toUpperCase();
  if (!['CORREGIR', 'ACLARAR', 'REABRIR'].includes(tipo)) fail(400, 'Seleccione corrección, aclaración o reapertura');
  if (tipo === 'ACLARAR' ? !diagnosticosCerrados.includes(actual.estado_del_diagnostico)
    : actual.estado_del_diagnostico !== 'COMPLETADO')
    fail(409, 'Esta acción no está disponible para el estado actual del diagnóstico');
  const [vinculada, facturada] = await Promise.all([
    tx.ordenes.count({ where: { diagnostico_id: id } }), tx.facturas.count({ where: { diagnostico_id: id } }),
  ]);
  if (tipo !== 'ACLARAR' && (vinculada || facturada)) fail(409, 'El diagnóstico ya tiene una orden o factura. Registre una aclaración para conservar el informe utilizado');
  if (tipo === 'REABRIR' && (actual.fecha_envio_documento || actual.estado_contacto !== 'PENDIENTE_CONTACTAR'))
    fail(409, 'El diagnóstico ya avanzó en la comunicación con el cliente. Registre una aclaración en vez de reabrirlo');
  const anterior = { diagnostico_real: actual.diagnostico_real, solucion_propuesta: actual.solucion_propuesta,
    presupuesto_estimado: actual.presupuesto_estimado?.toString() ?? null, moneda_presupuesto: actual.moneda_presupuesto,
    estado: actual.estado_del_diagnostico, fecha_completado: actual.fecha_completado };
  let nuevo = {};
  if (tipo === 'CORREGIR') {
    const informe = String(payload.diagnostico_real || '').trim();
    const solucion = String(payload.solucion_propuesta || '').trim();
    if (!informe || informe.length > 10000 || solucion.length > 10000) fail(400, 'Registre un informe válido de hasta 10000 caracteres');
    const presupuesto = payload.presupuesto_estimado === '' || payload.presupuesto_estimado == null ? null
      : parseNonNegativeMoney(payload.presupuesto_estimado, 'El presupuesto estimado');
    nuevo = { diagnostico_real: solucion ? `${informe}\n\nSolución: ${solucion}` : informe,
      solucion_propuesta: solucion || null, presupuesto_estimado: presupuesto,
      moneda_presupuesto: monedaPresupuesto(payload.moneda_presupuesto, actual.moneda_presupuesto) };
    if (actual.diagnostico_real === nuevo.diagnostico_real
      && (actual.solucion_propuesta || null) === nuevo.solucion_propuesta
      && (actual.presupuesto_estimado == null ? null : Number(actual.presupuesto_estimado)) === presupuesto
      && actual.moneda_presupuesto === nuevo.moneda_presupuesto) fail(400, 'Cambie al menos un dato del informe');
  } else if (tipo === 'REABRIR') {
    const informe = diagnosticoTecnico(actual).diagnostico_real;
    nuevo = { estado_del_diagnostico: 'EN_REVISION', fecha_completado: null,
      fecha_inicio: actual.fecha_inicio || new Date(), diagnostico_real: null, solucion_propuesta: null,
      presupuesto_estimado: null, fecha_borrador: new Date(),
      borrador_tecnico: { diagnostico: informe, solucion: actual.solucion_propuesta || '',
        presupuesto: actual.presupuesto_estimado == null ? '' : Number(actual.presupuesto_estimado),
        moneda_presupuesto: actual.moneda_presupuesto || 'NIO' } };
  } else {
    nuevo = { aclaracion: String(payload.aclaracion || '').trim() };
    if (!nuevo.aclaracion || nuevo.aclaracion.length > 4000) fail(400, 'Escriba una aclaración de hasta 4000 caracteres');
  }
  await auditMotivo(tx, motivo);
  const updated = tipo === 'ACLARAR' ? actual : await tx.diagnosticos.update({ where: { id_diagnostico: id }, data: nuevo, include: diagnosticoInclude });
  await tx.intervencionesTecnicas.create({ data: { diagnostico_id: id, tipo: tipo === 'CORREGIR' ? 'CORRECCION_DIAGNOSTICO' : tipo === 'REABRIR' ? 'REAPERTURA_DIAGNOSTICO' : 'ACLARACION_DIAGNOSTICO',
    motivo, usuario_id: user.id, datos_anteriores: anterior, datos_nuevos: tipo === 'REABRIR' ? {
      estado: 'EN_REVISION', fecha_completado: null, borrador_tecnico: nuevo.borrador_tecnico,
    } : nuevo } });
  return diagnosticoTecnico(updated);
});

export const corregirAvance = (kind, value, avanceValue, payload, user) => withAuditUser(user, async (tx) => {
  const id = parsePositiveId(value), avanceId = parsePositiveId(avanceValue);
  if (!id || !avanceId) fail(400, 'Avance no válido');
  const diagnostic = kind === 'diagnostico';
  await lockTrabajo(tx, kind, id);
  const r = await tx[diagnostic ? 'diagnosticos' : 'ordenes'].findUnique({
    where: { [diagnostic ? 'id_diagnostico' : 'id_orden']: id }, include: diagnostic ? diagnosticoInclude : ordenInclude });
  if (!r) fail(404, 'Trabajo no encontrado');
  await assertTrabajoPropio(tx, user, r.tecnico_id);
  const avance = await tx.bitacoraTecnica.findUnique({ where: { id_avance: avanceId } });
  if (!avance || avance[diagnostic ? 'diagnostico_id' : 'orden_id'] !== id) fail(404, 'Avance no encontrado');
  if (avance.usuario_id !== user.id) fail(403, 'Solo puede corregir sus propias notas');
  const cliente = diagnostic ? r.equipo?.cliente : r.diagnostico?.equipo?.cliente;
  const observacion = textoTecnico(String(payload.observacion || '').trim(), cliente);
  if (!observacion || observacion.length > 2000) fail(400, 'Escriba un avance de hasta 2000 caracteres');
  if (observacion === avance.observacion) fail(400, 'Cambie la nota antes de guardarla');
  const motivo = motivoObligatorio(payload.motivo);
  await auditMotivo(tx, motivo);
  const updated = await tx.bitacoraTecnica.update({ where: { id_avance: avanceId }, data: { observacion }, include: { usuario: { select: { nombre_usuario: true } } } });
  await tx.intervencionesTecnicas.create({ data: { [diagnostic ? 'diagnostico_id' : 'orden_id']: id,
    tipo: 'CORRECCION_AVANCE', motivo, usuario_id: user.id,
    datos_anteriores: { id_avance: avanceId, observacion: avance.observacion }, datos_nuevos: { id_avance: avanceId, observacion } } });
  return avanceTecnico(updated, cliente);
});

export const corregirSolicitud = (value, payload, user) => withAuditUser(user, async (tx) => {
  const id = parsePositiveId(value);
  if (!id) fail(400, 'Solicitud no válida');
  const previous = await tx.ordenes_Repuestos.findUnique({ where: { id_detalle_repuesto: id } });
  if (!previous) fail(404, 'Solicitud no encontrada');
  await lockTrabajo(tx, 'orden', previous.orden_id);
  await tx.$queryRaw`SELECT id_detalle_repuesto FROM "Ordenes_Repuestos" WHERE id_detalle_repuesto = ${id} FOR UPDATE`;
  const solicitud = await tx.ordenes_Repuestos.findUnique({ where: { id_detalle_repuesto: id }, include: { orden: true } });
  if (!solicitud) fail(404, 'Solicitud no encontrada');
  const tecnico = await assertTrabajoPropio(tx, user, solicitud.orden.tecnico_id);
  if (solicitud.tecnico_solicitante_id !== tecnico?.id_tecnico) fail(403, 'Solo puede corregir sus solicitudes');
  if (solicitud.estado_aprobacion !== 'PENDIENTE' || !['EN_REPARACION', 'ESPERANDO_PIEZA'].includes(solicitud.orden.estado))
    fail(409, 'La solicitud ya fue revisada o la orden está cerrada');
  const motivo = motivoObligatorio(payload.motivo);
  const tipo = String(payload.tipo || '').toUpperCase();
  if (!['CORREGIR', 'RETIRAR'].includes(tipo)) fail(400, 'Seleccione corregir o retirar la solicitud');
  const anterior = { id_detalle_repuesto: id, repuesto_id: solicitud.repuesto_id,
    pieza_solicitada: solicitud.pieza_solicitada, cantidad_usada: solicitud.cantidad_usada };
  let nuevo;
  if (tipo === 'CORREGIR') {
    const pieza = String(payload.pieza_solicitada || '').trim();
    const cantidad = Number(payload.cantidad);
    if (!pieza || pieza.length > 250 || !Number.isInteger(cantidad) || cantidad < 1) fail(400, 'Indique una pieza y cantidad válidas');
    // La selección del catálogo sigue bajo responsabilidad del jefe técnico.
    const catalogo = await tx.repuestos.findFirst({ where: { nombre: { equals: pieza, mode: 'insensitive' }, descontinuada: false } });
    const repuestoId = catalogo?.id_repuesto || (pieza === solicitud.pieza_solicitada ? solicitud.repuesto_id : null);
    if (repuestoId && await stockDisponible(tx, repuestoId) < cantidad) fail(409, 'Stock insuficiente para solicitar el repuesto');
    nuevo = { pieza_solicitada: pieza, cantidad_usada: cantidad, repuesto_id: repuestoId };
    if (pieza === solicitud.pieza_solicitada && cantidad === solicitud.cantidad_usada) fail(400, 'Cambie la pieza o la cantidad');
  } else nuevo = { retirada: true, id_detalle_repuesto: id };
  await auditMotivo(tx, motivo);
  if (tipo === 'RETIRAR') {
    await tx.ordenes_Repuestos.delete({ where: { id_detalle_repuesto: id } });
    const pendientes = await tx.ordenes_Repuestos.count({ where: { orden_id: solicitud.orden_id,
      OR: [{ estado_aprobacion: 'PENDIENTE' }, { estado_aprobacion: 'APROBADO', estado_entrega: 'PENDIENTE' }] } });
    if (!pendientes && solicitud.orden.estado === 'ESPERANDO_PIEZA') await tx.ordenes.update({ where: { id_orden: solicitud.orden_id }, data: { estado: 'EN_REPARACION' } });
  } else await tx.ordenes_Repuestos.update({ where: { id_detalle_repuesto: id }, data: nuevo });
  await tx.intervencionesTecnicas.create({ data: { orden_id: solicitud.orden_id,
    tipo: tipo === 'RETIRAR' ? 'RETIRO_SOLICITUD_TECNICO' : 'CORRECCION_SOLICITUD_TECNICO',
    motivo, usuario_id: user.id, datos_anteriores: anterior, datos_nuevos: nuevo } });
  return { orden_id: solicitud.orden_id, id_detalle_repuesto: id, tipo };
});

export const corregirIrreparable = (value, payload, user) => withAuditUser(user, async (tx) => {
  const id = parsePositiveId(value);
  if (!id) fail(400, 'Orden no válida');
  await lockTrabajo(tx, 'orden', id);
  const orden = await tx.ordenes.findUnique({ where: { id_orden: id }, include: ordenInclude });
  if (!orden) fail(404, 'Orden no encontrada');
  await assertTrabajoPropio(tx, user, orden.tecnico_id);
  if (orden.estado !== 'IRREPARABLE' || orden.irreparable_estado !== 'PENDIENTE') fail(409, 'El jefe ya decidió o no hay informe pendiente');
  const tipo = String(payload.tipo || '').toUpperCase();
  if (!['CORREGIR', 'RETIRAR'].includes(tipo)) fail(400, 'Seleccione corregir o retirar el informe');
  const motivo = motivoObligatorio(payload.motivo);
  const justificacion = String(payload.justificacion || '').trim();
  if (tipo === 'CORREGIR' && (!justificacion || justificacion.length > 4000)) fail(400, 'Escriba una justificación de hasta 4000 caracteres');
  if (tipo === 'CORREGIR' && justificacion === orden.justificacion_irreparable) fail(400, 'Cambie la justificación');
  const anterior = { estado: orden.estado, irreparable_estado: orden.irreparable_estado,
    justificacion_irreparable: orden.justificacion_irreparable, observacion_final: orden.observacion_final };
  const nuevo = tipo === 'CORREGIR' ? { justificacion_irreparable: justificacion, observacion_final: justificacion }
    : { estado: 'EN_REPARACION', irreparable_estado: 'NO_SOLICITADO', justificacion_irreparable: null,
      observacion_final: null, resultado_final: null, enciende_salida: null, usa_corriente_ac_salida: null };
  await auditMotivo(tx, motivo);
  const updated = await tx.ordenes.update({ where: { id_orden: id }, data: nuevo, include: ordenInclude });
  await tx.intervencionesTecnicas.create({ data: { orden_id: id,
    tipo: tipo === 'RETIRAR' ? 'RETIRO_IRREPARABLE' : 'CORRECCION_IRREPARABLE', motivo, usuario_id: user.id,
    datos_anteriores: anterior, datos_nuevos: nuevo } });
  return ordenTecnica(updated);
});

export const guardarBorrador = (value, payload, user) => withAuditUser(user, async (tx) => {
  const id = parsePositiveId(value);
  if (!id) fail(400, 'Diagnóstico no válido');
  await lockTrabajo(tx, 'diagnostico', id);
  const r = await tx.diagnosticos.findUnique({ where: { id_diagnostico: id } });
  if (!r) fail(404, 'Diagnóstico no encontrado');
  await assertTrabajoPropio(tx, user, r.tecnico_id);
  if (r.estado_del_diagnostico !== 'EN_REVISION' || !r.fecha_inicio) fail(409, 'Solo puede guardar avances de un diagnóstico iniciado y abierto');
  const presupuesto = payload.presupuesto === '' || payload.presupuesto == null ? '' : parseNonNegativeMoney(payload.presupuesto, 'El presupuesto');
  const diagnostico = String(payload.diagnostico || '').trim().slice(0, 10000), solucion = String(payload.solucion || '').trim().slice(0, 10000);
  if (!diagnostico && !solucion && presupuesto === '') fail(400, 'Escriba algún avance antes de guardar');
  return diagnosticoTecnico(await tx.diagnosticos.update({ where: { id_diagnostico: id }, data: {
    borrador_tecnico: { diagnostico, solucion, presupuesto, moneda_presupuesto: monedaPresupuesto(payload.moneda_presupuesto, r.borrador_tecnico?.moneda_presupuesto || r.moneda_presupuesto) }, fecha_borrador: new Date(),
  }, include: diagnosticoInclude }));
});

export const detalleTecnico = async (kind, value, user) => {
  const id = parsePositiveId(value);
  if (!id) fail(400, 'Trabajo no válido');
  const diagnostic = kind === 'diagnostico', key = diagnostic ? 'diagnostico_id' : 'orden_id';
  const r = await prisma[diagnostic ? 'diagnosticos' : 'ordenes'].findUnique({
    where: { [diagnostic ? 'id_diagnostico' : 'id_orden']: id }, include: diagnostic ? diagnosticoInclude : ordenInclude,
  });
  if (!r) fail(404, 'Trabajo no encontrado');
  await assertTrabajoPropio(prisma, user, r.tecnico_id);
  const cliente = diagnostic ? r.equipo?.cliente : r.diagnostico?.equipo?.cliente;
  const [historial, avances, asignaciones, correcciones, settings, ordenesVinculadas] = await Promise.all([
    prisma[diagnostic ? 'historialDiagnosticos' : 'historialOrdenes'].findMany({ where: { [key]: id }, orderBy: { fecha_hora: 'desc' }, include: { usuario: { select: { nombre_usuario: true } } } }),
    prisma.bitacoraTecnica.findMany({ where: { [key]: id }, orderBy: { fecha_hora: 'desc' }, include: { usuario: { select: { nombre_usuario: true } } } }),
    prisma.historialAsignaciones.findMany({ where: { [key]: id }, orderBy: { fecha_hora: 'desc' }, select: { id_historial: true, fecha_hora: true, es_excepcion: true, tecnico_anterior_nombre: true, tecnico_nuevo_nombre: true } }),
    prisma.intervencionesTecnicas.findMany({ where: { [key]: id, tipo: { in: diagnostic
      ? ['CORRECCION_DIAGNOSTICO', 'ACLARACION_DIAGNOSTICO', 'REAPERTURA_DIAGNOSTICO', 'CORRECCION_AVANCE']
      : ['CORRECCION_CIERRE', 'ACLARACION_CIERRE', 'CORRECCION_FOTO_CIERRE', 'REAPERTURA_CIERRE',
        'CORRECCION_AVANCE', 'CORRECCION_SOLICITUD_TECNICO', 'RETIRO_SOLICITUD_TECNICO',
        'CORRECCION_IRREPARABLE', 'RETIRO_IRREPARABLE'] } }, orderBy: { fecha_hora: 'desc' }, include: { usuario: { select: { nombre_usuario: true } } } }),
    getBusinessSettings(),
    diagnostic ? Promise.all([prisma.ordenes.count({ where: { diagnostico_id: id } }), prisma.facturas.count({ where: { diagnostico_id: id } })]) : Promise.resolve([0, 0]),
  ]);
  return { registro: diagnostic ? diagnosticoTecnico(r) : ordenTecnica(r, settings.reglas), historial: historialTecnico(historial, cliente), avances: avances.map((a) => avanceTecnico(a, cliente)), asignaciones,
    puede_corregir_informe: diagnostic && r.estado_del_diagnostico === 'COMPLETADO' && ordenesVinculadas.every((n) => n === 0),
    puede_reabrir_diagnostico: diagnostic && r.estado_del_diagnostico === 'COMPLETADO' && ordenesVinculadas.every((n) => n === 0)
      && !r.fecha_envio_documento && r.estado_contacto === 'PENDIENTE_CONTACTAR',
    correcciones: correcciones.map((c) => ({ id_intervencion: c.id_intervencion, tipo: c.tipo, fecha_hora: c.fecha_hora,
      motivo: textoTecnico(c.motivo, cliente), es_excepcion: c.datos_nuevos?.es_excepcion === true,
      aclaracion: textoTecnico(c.datos_nuevos?.aclaracion || '', cliente),
      observacion_anterior: ['CORRECCION_CIERRE', 'REAPERTURA_CIERRE'].includes(c.tipo) ? textoTecnico(c.datos_anteriores?.observacion_final || '', cliente) : null,
      observacion_nueva: ['CORRECCION_CIERRE', 'REAPERTURA_CIERRE'].includes(c.tipo) ? textoTecnico(c.datos_nuevos?.observacion_final || '', cliente) : null,
      id_archivo: c.tipo === 'CORRECCION_FOTO_CIERRE' ? c.datos_nuevos?.id_archivo : null,
      antes: Object.fromEntries(Object.entries(c.datos_anteriores || {}).map(([k, v]) => [k, typeof v === 'string' ? textoTecnico(v, cliente) : v])),
      despues: Object.fromEntries(Object.entries(c.datos_nuevos || {}).map(([k, v]) => [k, typeof v === 'string' ? textoTecnico(v, cliente) : v])),
      usuario: c.usuario?.nombre_usuario || 'Técnico' })) };
};

export const registrarAvance = (kind, value, payload, user) => withAuditUser(user, async (tx) => {
  const id = parsePositiveId(value);
  if (!id) fail(400, 'Trabajo no válido');
  await lockTrabajo(tx, kind, id);
  const diagnostic = kind === 'diagnostico';
  const r = await tx[diagnostic ? 'diagnosticos' : 'ordenes'].findUnique({ where: { [diagnostic ? 'id_diagnostico' : 'id_orden']: id }, include: diagnostic ? diagnosticoInclude : ordenInclude });
  if (!r) fail(404, 'Trabajo no encontrado');
  await assertTrabajoPropio(tx, user, r.tecnico_id);
  if (diagnostic ? r.estado_del_diagnostico !== 'EN_REVISION' || !r.fecha_inicio : !r.fecha_inicio_reparacion || !['EN_REPARACION', 'ESPERANDO_PIEZA'].includes(r.estado)) fail(409, 'Solo puede registrar avances de un trabajo iniciado y abierto');
  const cliente = diagnostic ? r.equipo?.cliente : r.diagnostico?.equipo?.cliente;
  const observacion = textoTecnico(String(payload.observacion || '').trim(), cliente);
  if (!observacion || observacion.length > 2000) fail(400, 'Escriba un avance técnico de hasta 2000 caracteres');
  return avanceTecnico(await tx.bitacoraTecnica.create({ data: { [diagnostic ? 'diagnostico_id' : 'orden_id']: id, usuario_id: user.id, observacion }, include: { usuario: { select: { nombre_usuario: true } } } }), cliente);
});

export const resumenTecnico = async (user, query = {}) => {
  const t = await getTecnicoActivoByUsername(user.username);
  if (!t) fail(403, 'No hay un perfil de técnico activo vinculado a esta cuenta');
  const id = t.id_tecnico;
  const [activeDiag, doneDiag, activeOrders, doneOrders, pendingParts, unstartedDiag, unstartedOrders, waiting, review] = await Promise.all([
    prisma.diagnosticos.count({ where: filtroTrabajo('diagnostico', id, query) }),
    prisma.diagnosticos.count({ where: filtroTrabajo('diagnostico', id, { ...query, grupo: 'completados' }) }),
    prisma.ordenes.count({ where: filtroTrabajo('orden', id, query) }),
    prisma.ordenes.count({ where: filtroTrabajo('orden', id, { ...query, grupo: 'completados' }) }),
    prisma.ordenes_Repuestos.count({ where: { orden: { tecnico_id: id }, AND: [filtroFecha(['fecha_solicitud'], query.periodo)], OR: [{ estado_aprobacion: 'PENDIENTE' }, { estado_aprobacion: 'APROBADO', estado_entrega: { in: ['PENDIENTE', 'SIN_EXISTENCIA'] } }] } }),
    prisma.diagnosticos.count({ where: filtroTrabajo('diagnostico', id, { ...query, grupo: 'por_iniciar' }) }),
    prisma.ordenes.count({ where: filtroTrabajo('orden', id, { ...query, grupo: 'por_iniciar' }) }),
    prisma.ordenes.count({ where: filtroTrabajo('orden', id, { ...query, grupo: 'esperando_piezas' }) }),
    prisma.ordenes.count({ where: filtroTrabajo('orden', id, { ...query, grupo: 'revision_jefe' }) }),
  ]);
  return { diagnosticos_activos: activeDiag, diagnosticos_completados: doneDiag, ordenes_activas: activeOrders, ordenes_completadas: doneOrders,
    piezas_pendientes: pendingParts, por_iniciar: unstartedDiag + unstartedOrders, esperando_piezas: waiting, revision_jefe: review };
};

export const misSolicitudes = async (user, query = {}) => {
  const t = await getTecnicoActivoByUsername(user.username);
  if (!t) fail(403, 'Técnico no encontrado');
  const p = parsePagination(query), search = String(query.search || '').trim().slice(0, 120);
  const where = { AND: [{ orden: { tecnico_id: t.id_tecnico } }, filtroFecha(['fecha_solicitud'], query.periodo),
    ...(query.estado ? query.estado === 'POR_ENTREGAR' ? [{ estado_aprobacion: 'APROBADO', estado_entrega: 'PENDIENTE' }]
      : query.estado === 'SIN_EXISTENCIA' ? [{ estado_entrega: 'SIN_EXISTENCIA' }] : [{ estado_aprobacion: query.estado }] : []),
    ...(search ? [{ OR: [{ pieza_solicitada: { contains: search, mode: 'insensitive' } }, { repuesto: { nombre: { contains: search, mode: 'insensitive' } } }, ...(Number.isInteger(Number(search)) ? [{ orden_id: Number(search) }] : [])] }] : []),
  ] };
  const [rows, total] = await Promise.all([
    prisma.ordenes_Repuestos.findMany({ where, skip: p.offset, take: p.pageSize, orderBy: { fecha_solicitud: 'desc' }, include: { repuesto: { select: repuestoSafeSelect }, usuario_aprobador: { select: { nombre_usuario: true } }, usuario_entregador: { select: { nombre_usuario: true } }, orden: { include: { diagnostico: { include: diagnosticoInclude } } } } }),
    prisma.ordenes_Repuestos.count({ where }),
  ]);
  return { data: rows.map((r) => solicitudTecnica(r, r.orden.diagnostico.equipo.cliente)), meta: buildPaginationMeta({ ...p, total }) };
};

export const buscarCatalogo = async (query = {}) => {
  const p = parsePagination(query), search = String(query.search || '').trim().slice(0, 120);
  const type = String(query.tipo || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const aliases = { celular: ['celular', 'telefono', 'teléfono', 'movil', 'móvil', 'smartphone'], telefono: ['celular', 'telefono', 'teléfono', 'movil', 'móvil', 'smartphone'],
    laptop: ['laptop', 'notebook', 'portatil', 'portátil'], notebook: ['laptop', 'notebook', 'portatil', 'portátil'],
    computadora: ['pc', 'computadora', 'desktop', 'escritorio'], pc: ['pc', 'computadora', 'desktop', 'escritorio'], consola: ['consola', 'playstation', 'xbox', 'nintendo'] };
  const compatible = aliases[type] || [String(query.tipo || '').slice(0, 60)];
  const where = { descontinuada: false, ...(search ? { OR: ['nombre', 'descripcion'].map((key) => ({ [key]: { contains: search, mode: 'insensitive' } })) } : {}),
    ...(query.tipo ? { categoria: { OR: [{ electronico: null }, { electronico: '' }, ...compatible.map((alias) => ({ electronico: { contains: alias, mode: 'insensitive' } }))] } } : {}) };
  const [rows, total] = await Promise.all([prisma.repuestos.findMany({ where, skip: p.offset, take: p.pageSize, orderBy: [{ nombre: 'asc' }, { id_repuesto: 'asc' }], select: { id_repuesto: true, nombre: true, descripcion: true, stock_actual: true, categoria: { select: { nombre_tipo: true, electronico: true } } } }), prisma.repuestos.count({ where })]);
  const cantidad = Math.max(1, Math.floor(Number(query.cantidad) || 1));
  const reserves = rows.length ? await prisma.ordenes_Repuestos.groupBy({ by: ['repuesto_id'], where: { repuesto_id: { in: rows.map((r) => r.id_repuesto) }, estado_aprobacion: 'APROBADO',
    orden: { OR: [{ estado: null }, { estado: { not: 'CANCELADO' } }], facturas: { none: {} } } }, _sum: { cantidad_usada: true } }) : [];
  const reserved = new Map(reserves.map((r) => [r.repuesto_id, r._sum.cantidad_usada || 0]));
  const data = rows.map((r) => ({ id_repuesto: r.id_repuesto, nombre: r.nombre, descripcion: r.descripcion, categoria: r.categoria,
    disponible: r.stock_actual - (reserved.get(r.id_repuesto) || 0) >= cantidad }));
  return { data, meta: buildPaginationMeta({ ...p, total }) };
};
