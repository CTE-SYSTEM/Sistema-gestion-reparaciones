import { crearInformeDiagnostico } from '../../services/recepcion/diagnosticoPdf.js';
import prisma from '../../app/prismaClient.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { notifyRoles } from '../../services/notifications.js';
import { saldoFactura } from '../contabilidad/movimientosController.js';
import { CONTACTO_ESTADOS, parsePositiveId } from '../../utils/domainValidation.js';

const badId = (res) => res.status(400).json({ error: 'Identificador inválido' });

export const getHistorialDiagnostico = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return badId(res);
  const data = await prisma.historialDiagnosticos.findMany({
    where: { diagnostico_id: id },
    include: { usuario: { select: { id_usuario: true, nombre_usuario: true } } },
    orderBy: [{ fecha_hora: 'asc' }, { id_historial: 'asc' }],
  });
  return res.json({ data });
};

export const getHistorialOrden = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return badId(res);
  const data = await prisma.historialOrdenes.findMany({
    where: { orden_id: id },
    include: { usuario: { select: { id_usuario: true, nombre_usuario: true } } },
    orderBy: [{ fecha_hora: 'asc' }, { id_historial: 'asc' }],
  });
  return res.json({ data });
};

export const registrarContacto = async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) return badId(res);
    const estado = String(req.body.estado_contacto || '');
    if (!CONTACTO_ESTADOS.includes(estado) || estado === 'APROBADO') {
      return res.status(400).json({ error: 'Estado de contacto inválido' });
    }
    const observacion = String(req.body.observacion_respuesta || '').trim() || null;
    const data = await withAuditUser(req.user, async (tx) => {
      const actual = await tx.diagnosticos.findUnique({ where: { id_diagnostico: id }, include: { ordenes: true } });
      if (!actual) return null;
      if (actual.ordenes.length || actual.estado_equipo === 'RETIRADO_SIN_REPARAR') {
        const error = new Error('El equipo ya tiene una orden o fue retirado'); error.statusCode = 409; throw error;
      }
      if (!['COMPLETADO', 'DIAGNOSTICADO', 'RECHAZADO'].includes(actual.estado_del_diagnostico)) {
        const error = new Error('El diagnóstico aún no está finalizado'); error.statusCode = 409; throw error;
      }
      if (estado === 'DOCUMENTO_ENVIADO' && !actual.diagnostico_real) {
        const error = new Error('Falta el informe técnico'); error.statusCode = 409; throw error;
      }
      return tx.diagnosticos.update({ where: { id_diagnostico: id }, data: {
        estado_contacto: estado,
        observacion_respuesta: observacion,
        ...(estado === 'RECHAZADO' ? { estado_equipo: 'ESPERANDO_RETIRO', estado_del_diagnostico: 'RECHAZADO' } : {}),
        ...(estado === 'RECHAZADO' ? { Estado_aprobacion: 'Rechazado' } : {}),
        ...(estado !== 'RECHAZADO' && actual.estado_del_diagnostico === 'RECHAZADO'
          ? { estado_del_diagnostico: 'COMPLETADO', estado_equipo: 'EN_TALLER', Estado_aprobacion: 'Pendiente' } : {}),
      } });
    });
    if (!data) return res.status(404).json({ error: 'Diagnóstico no encontrado' });
    return res.json({ data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo registrar el contacto' });
  }
};

export const registrarRetiroSinReparar = async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) return badId(res);
    const persona = String(req.body.persona_recibe_retiro || '').trim();
    if (!persona) return res.status(400).json({ error: 'Indique quién retiró el equipo' });
    const data = await withAuditUser(req.user, async (tx) => {
      const actual = await tx.diagnosticos.findUnique({ where: { id_diagnostico: id }, include: { ordenes: true } });
      if (!actual) return null;
      if (actual.ordenes.length || actual.estado_contacto !== 'RECHAZADO' || actual.estado_equipo === 'RETIRADO_SIN_REPARAR') {
        const error = new Error('Este diagnóstico no está pendiente de retiro sin reparación'); error.statusCode = 409; throw error;
      }
      const factura = await tx.facturas.findFirst({ where: { diagnostico_id: id }, select: { id_factura: true } });
      if (!factura) { const error = new Error('Facture el diagnóstico antes de registrar el retiro'); error.statusCode = 409; throw error; }
      const fotoSalida = await tx.archivosServicio.count({ where: { diagnostico_id: id, tipo_archivo: 'FOTO_SALIDA_SIN_REPARAR' } });
      if (!fotoSalida) { const error = new Error('Adjunte una foto de salida antes de registrar el retiro'); error.statusCode = 409; throw error; }
      return tx.diagnosticos.update({ where: { id_diagnostico: id }, data: {
        estado_equipo: 'RETIRADO_SIN_REPARAR', persona_recibe_retiro: persona,
        observacion_retiro: String(req.body.observacion_retiro || '').trim() || null,
      } });
    });
    if (!data) return res.status(404).json({ error: 'Diagnóstico no encontrado' });
    return res.json({ data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo registrar el retiro' });
  }
};

export const descargarDocumentoDiagnostico = async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return badId(res);
  const d = await prisma.diagnosticos.findUnique({
    where: { id_diagnostico: id }, include: { equipo: { include: { cliente: true } }, tecnico: true },
  });
  if (!d) return res.status(404).json({ error: 'Diagnóstico no encontrado' });
  if (!['COMPLETADO', 'DIAGNOSTICADO', 'APROBADO', 'RECHAZADO'].includes(d.estado_del_diagnostico) || !d.diagnostico_real) {
    return res.status(409).json({ error: 'El informe técnico aún no está completo' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="diagnostico-${id}.pdf"`);
  const doc = crearInformeDiagnostico(d);
  doc.pipe(res);
  doc.end();
};

export const registrarEntregaOrden = async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) return badId(res);
    const persona = String(req.body.persona_recibe || '').trim();
    if (!persona) return res.status(400).json({ error: 'Indique quién recibió el equipo' });
    const data = await withAuditUser(req.user, async (tx) => {
      const orden = await tx.ordenes.findUnique({ where: { id_orden: id }, include: { facturas: true } });
      if (!orden) return null;
      if (!['FINALIZADO', 'IRREPARABLE'].includes(orden.estado) || !orden.facturas.length) {
        const error = new Error('La orden debe estar finalizada y facturada antes de entregarla'); error.statusCode = 409; throw error;
      }
      if (orden.estado === 'FINALIZADO' && !['APROBADO', 'NO_REQUERIDO'].includes(orden.calidad_estado)) {
        const error = new Error('Control de calidad debe aprobar la orden antes de la entrega'); error.statusCode = 409; throw error;
      }
      const saldo = await saldoFactura(tx, orden.facturas[0]);
      if (saldo.pendiente > 0) { const error = new Error('Registre el pago completo antes de entregar el equipo'); error.statusCode = 409; throw error; }
      const fotoEntrega = await tx.archivosServicio.count({ where: { orden_id: id, tipo_archivo: 'FOTO_ENTREGA' } });
      if (!fotoEntrega) { const error = new Error('Adjunte una foto de entrega antes de confirmar la salida'); error.statusCode = 409; throw error; }
      const entregada = await tx.ordenes.update({ where: { id_orden: id }, data: {
        estado: 'ENTREGADO', entregado_por_id: req.user.id, persona_recibe: persona,
        observacion_entrega: String(req.body.observacion_entrega || '').trim() || null,
      } });
      await tx.$executeRaw`UPDATE "Garantias" g SET fecha_inicio = ${entregada.fecha_entrega},
        fecha_vencimiento = ${entregada.fecha_entrega} + (COALESCE(g.duracion_meses, 3) || ' months')::interval
        FROM "Facturas" f WHERE g.factura_id = f.id_factura AND f.orden_id = ${id}`;
      return entregada;
    });
    if (!data) return res.status(404).json({ error: 'Orden no encontrada' });
    await notifyRoles(['Secretaria', 'Garantias', 'Contabilidad'], {
      type: 'equipo_entregado', title: 'Equipo entregado',
      message: `La orden #${id} fue entregada; revise las fechas de garantía.`,
      entity: { kind: 'orden', id },
    });
    return res.json({ data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo registrar la entrega' });
  }
};

export const cancelarOrden = async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) return badId(res);
    const motivo = String(req.body.motivo_cancelacion || '').trim();
    if (!motivo) return res.status(400).json({ error: 'Indique el motivo de cancelación' });
    const data = await withAuditUser(req.user, async (tx) => {
      const orden = await tx.ordenes.findUnique({ where: { id_orden: id }, include: { facturas: true } });
      if (!orden) return null;
      if (orden.facturas.length || ['ENTREGADO', 'CANCELADO'].includes(orden.estado)) {
        const error = new Error('La orden ya no se puede cancelar'); error.statusCode = 409; throw error;
      }
      return tx.ordenes.update({ where: { id_orden: id }, data: { estado: 'CANCELADO', motivo_cancelacion: motivo } });
    });
    if (!data) return res.status(404).json({ error: 'Orden no encontrada' });
    return res.json({ data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo cancelar la orden' });
  }
};
