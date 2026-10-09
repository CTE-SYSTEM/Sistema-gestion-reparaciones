import { notifyJefeTecnico, notifyRoles } from '../../services/notifications.js';
import {
  actualizarEstadoOrden as actualizarEstadoOrdenService,
  corregirCierreOrden,
  completarDiagnostico,
  iniciarDiagnostico,
  createTecnico as createTecnicoService,
  findTecnicos,
  getMisDiagnosticos as getMisDiagnosticosService,
  getMisOrdenes as getMisOrdenesService,
  solicitarRepuesto as solicitarRepuestoService,
  buscarCatalogo, detalleTecnico, guardarBorrador, misSolicitudes, registrarAvance, resumenTecnico,
  corregirDiagnostico, corregirAvance, corregirSolicitud, corregirIrreparable,
} from '../../services/Tecnico/tecnicoService.js';

const sendControllerError = (res, error, fallbackMessage = 'Error interno del servidor') => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  if (error.code === 'P2010') {
    return res.status(409).json({ error: 'El trabajo cambió o incumple una regla. Actualice el expediente antes de continuar.' });
  }
  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'Registro no encontrado' });
  }
  return res.status(500).json({ error: fallbackMessage });
};

export const getTecnicos = async (req, res) => {
  try {
    const tecnicos = await findTecnicos();
    res.json({ data: tecnicos });
  } catch (error) {
    console.error('Error al obtener tecnicos:', error);
    sendControllerError(res, error);
  }
};

export const createTecnico = async (req, res) => {
  try {
    const tecnico = await createTecnicoService(req.body);
    res.status(201).json({ data: tecnico });
  } catch (error) {
    console.error('Error al crear tecnico:', error);
    sendControllerError(res, error);
  }
};

export const getMisDiagnosticos = async (req, res) => {
  try {
    if (req.params.username !== req.user.username) return res.status(403).json({ error: 'Solo puede consultar sus propios trabajos' });
    const result = await getMisDiagnosticosService(req.params.username, req.query);
    res.json(result);
  } catch (error) {
    console.error('Error al obtener diagnosticos del tecnico:', error);
    sendControllerError(res, error);
  }
};

export const getMisOrdenes = async (req, res) => {
  try {
    if (req.params.username !== req.user.username) return res.status(403).json({ error: 'Solo puede consultar sus propias órdenes' });
    const result = await getMisOrdenesService(req.params.username, req.query);
    res.json(result);
  } catch (error) {
    console.error('Error al obtener ordenes del tecnico:', error);
    sendControllerError(res, error);
  }
};

export const actualizarDiagnosticoAsignado = async (req, res) => {
  try {
    const diagnostico = await completarDiagnostico(req.params.id, req.body, req.user);

    await notifyRoles(['Secretaria', 'ServicioCliente'], {
      type: 'diagnostico_completado',
      title: 'Diagnóstico listo para nueva orden',
      message: `El diagnóstico #${req.params.id} ya está listo para crear una orden`,
      severity: 'success',
      entity: { kind: 'diagnostico', id: Number(req.params.id) },
    });

    res.json({ data: diagnostico });
  } catch (error) {
    console.error('Error al actualizar diagnostico asignado:', error);
    sendControllerError(res, error);
  }
};

export const iniciarDiagnosticoAsignado = async (req, res) => {
  try { res.json({ data: await iniciarDiagnostico(req.params.id, req.user) }); }
  catch (error) { sendControllerError(res, error); }
};

export const actualizarEstadoOrden = async (req, res) => {
  try {
    const orden = await actualizarEstadoOrdenService(req.params.id, req.body, req.user);
    const estadoNuevo = String(orden.estado || '').toUpperCase();
    const estadoCierre = estadoNuevo === 'FINALIZADO';
    const estadoIrreparable = estadoNuevo === 'IRREPARABLE';
    if (estadoCierre) await notifyRoles(['Secretaria', 'ServicioCliente', 'Contabilidad', 'Calidad'], {
      type: 'orden_finalizada', title: 'Orden finalizada', message: `La orden #${orden.id_orden} quedó finalizada.`,
      severity: 'success', entity: { kind: 'orden', id: orden.id_orden },
    });

    if (estadoIrreparable) await notifyJefeTecnico({
      type: 'orden_irreparable_pendiente',
      title: 'Irreparable pendiente de revisión',
      message: `La orden #${orden.id_orden} requiere una decisión sobre la irreparabilidad.`,
      severity: 'warning',
      entity: { kind: 'orden', id: orden.id_orden },
    });

    res.json({ data: orden });
  } catch (error) {
    console.error('Error al actualizar estado de orden:', error);
    sendControllerError(res, error);
  }
};

export const corregirCierre = async (req, res) => {
  try {
    const orden = await corregirCierreOrden(req.params.id, req.body, req.user);
    await notifyRoles(['Secretaria', 'ServicioCliente', 'Contabilidad', 'Calidad'], { type: 'orden_cierre_corregido', title: 'Corrección del cierre técnico',
      message: `El técnico ${req.body.tipo === 'REABRIR' ? 'reabrió la reparación' : req.body.tipo === 'ACLARAR' ? 'registró una aclaración' : 'corrigió el informe'} de la orden #${orden.id_orden}.`,
      entity: { kind: 'orden', id: orden.id_orden } });
    res.json({ data: orden });
  } catch (error) { sendControllerError(res, error); }
};

export const solicitarRepuesto = async (req, res) => {
  try {
    const solicitud = await solicitarRepuestoService(req.params.id, req.body, req.user?.username, req.user);

    await notifyJefeTecnico({
      type: 'repuesto_solicitado',
      title: 'Solicitud de repuesto',
      message: `Nueva solicitud de pieza para orden #${req.params.id}`,
      severity: 'warning',
      entity: { kind: 'repuesto', id: solicitud.id_detalle_repuesto, orden_id: Number(req.params.id) },
    });

    res.status(201).json({ data: solicitud, message: 'Solicitud de pieza enviada al jefe tecnico' });
  } catch (error) {
    console.error('Error al solicitar repuesto:', error);
    sendControllerError(res, error);
  }
};

const responder = (operation, wrapped = true) => async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    const result = await operation(req);
    return res.json(wrapped ? { data: result } : result);
  } catch (error) { return sendControllerError(res, error); }
};
export const getResumenTecnico = responder((req) => resumenTecnico(req.user, req.query));
export const getSolicitudesTecnico = responder((req) => misSolicitudes(req.user, req.query), false);
export const getCatalogoTecnico = responder((req) => buscarCatalogo(req.query), false);
export const getDetalleTecnico = (kind) => responder((req) => detalleTecnico(kind, req.params.id, req.user));
export const postAvanceTecnico = (kind) => responder((req) => registrarAvance(kind, req.params.id, req.body, req.user));
export const putBorradorTecnico = responder((req) => guardarBorrador(req.params.id, req.body, req.user));
export const patchDiagnosticoTecnico = async (req, res) => {
  try {
    const diagnostico = await corregirDiagnostico(req.params.id, req.body, req.user);
    if (req.body.tipo === 'REABRIR') await notifyRoles(['Secretaria', 'ServicioCliente'], { type: 'diagnostico_reabierto',
      title: 'Diagnóstico devuelto a revisión', message: `El técnico reabrió el diagnóstico #${diagnostico.id_diagnostico}.`,
      entity: { kind: 'diagnostico', id: diagnostico.id_diagnostico } });
    res.json({ data: diagnostico });
  } catch (error) { sendControllerError(res, error); }
};
export const patchAvanceTecnico = (kind) => responder((req) => corregirAvance(kind, req.params.id, req.params.avanceId, req.body, req.user));
export const patchIrreparableTecnico = async (req, res) => {
  try {
    const orden = await corregirIrreparable(req.params.id, req.body, req.user);
    await notifyJefeTecnico({ type: 'irreparable_rectificado', title: 'Informe de irreparabilidad actualizado',
      message: `El técnico ${req.body.tipo === 'RETIRAR' ? 'retiró' : 'corrigió'} el informe de la orden #${orden.id_orden}.`,
      entity: { kind: 'orden', id: orden.id_orden } });
    res.json({ data: orden });
  } catch (error) { sendControllerError(res, error); }
};
export const patchSolicitudTecnico = async (req, res) => {
  try {
    const result = await corregirSolicitud(req.params.id, req.body, req.user);
    await notifyJefeTecnico({ type: 'solicitud_rectificada', title: 'Solicitud de pieza actualizada',
      message: `El técnico ${result.tipo === 'RETIRAR' ? 'retiró' : 'corrigió'} la solicitud #${result.id_detalle_repuesto} de la orden #${result.orden_id}.`,
      entity: { kind: 'orden', id: result.orden_id } });
    res.json({ data: result });
  } catch (error) { sendControllerError(res, error); }
};
