import prisma from '../../app/prismaClient.js';
import ordenService from '../../services/servicioCliente/ordenService.js';
import { notifyJefeTecnico, notifyRoles, notifyTecnico } from '../../services/notifications.js';

export const getOrdenes = async (req, res) => {
  try {
    const ordenes = await ordenService.listarOrdenes(req.query);

    res.json(ordenes);
  } catch (error) {
    console.error('Error al obtener ordenes:', error);
    res.status(500).json({ error: 'Error al obtener ordenes', details: error.message });
  }
};

export const getDiagnosticosListosParaOrden = async (req, res) => {
  try {
    const { diagnosticos, meta } = await ordenService.listarDiagnosticosListosParaOrden(req.query);

    res.json({
      data: diagnosticos,
      meta,
    });
  } catch (error) {
    console.error('Error al obtener diagnosticos listos para orden:', error);
    res.status(500).json({ error: 'Error al obtener diagnosticos listos para orden', details: error.message });
  }
};

export const createOrden = async (req, res) => {
  try {
    const { diagnostico_id, tecnico_id, prioridad, monto_autorizado, monto_acordado } = req.body;
    const diagnosticoId = ordenService.validarOrdenDiagnosticoId(diagnostico_id);

    if (!diagnosticoId) {
      return res.status(400).json({ error: 'El diagnostico es obligatorio' });
    }

    const diagnostico = await ordenService.obtenerDiagnosticoParaOrden(diagnosticoId);

    if (!diagnostico) {
      return res.status(404).json({ error: 'Diagnostico no encontrado' });
    }

    const estadoDiagnostico = (diagnostico.estado_del_diagnostico || '').toUpperCase();
    const estadosListos = ['COMPLETADO', 'DIAGNOSTICADO'];

    if (!estadosListos.includes(estadoDiagnostico)) {
      return res.status(409).json({ error: 'Solo se pueden crear ordenes desde diagnosticos completados' });
    }

    if (!diagnostico.equipo?.cliente?.id_cliente || !diagnostico.equipo?.id_equipo) {
      return res.status(400).json({ error: 'El diagnostico no tiene cliente o equipo valido' });
    }

    if (!diagnostico.diagnostico_real || Number(diagnostico.presupuesto_estimado || 0) <= 0) {
      return res.status(400).json({ error: 'Complete informe tecnico y presupuesto antes de crear la orden' });
    }

    if (diagnostico.orden_existente) {
      return res.status(409).json({ error: 'Ya existe una orden para este diagnostico' });
    }

    const orden = await ordenService.crearOrden({ diagnostico_id: diagnosticoId, tecnico_id, prioridad, monto_autorizado: monto_autorizado ?? monto_acordado }, req.user);

    if (!orden.tecnico_id) await notifyJefeTecnico({
      type: 'orden_creada',
      title: 'Orden pendiente de asignación',
      message: `La orden #${orden.id_orden} necesita un técnico responsable.`,
      severity: 'warning',
      entity: { kind: 'orden', id: orden.id_orden },
    });

    await notifyRoles(['Secretaria', 'ServicioCliente'], {
      type: 'orden_creada_servicio_cliente',
      title: 'Orden generada',
      message: `La orden #${orden?.id_orden || orden?.id || diagnosticoId} fue creada correctamente`,
      severity: 'success',
      entity: { kind: 'orden', id: Number(orden?.id_orden || orden?.id || 0) || diagnosticoId },
    });

    if (tecnico_id) {
      const tecnico = await prisma.tecnicos.findFirst({
        where: { id_tecnico: Number(tecnico_id), activo: true },
        select: { id_tecnico: true, nombre: true, usuario_id: true },
      });

      if (tecnico?.usuario_id) {
        await notifyTecnico(tecnico, {
          type: 'orden_asignada',
          title: 'Nueva orden asignada',
          message: `Se te asignó la orden #${orden?.id_orden || diagnosticoId}`,
          severity: 'info',
          entity: { kind: 'orden', id: Number(orden?.id_orden || diagnosticoId) },
        });
      }
    }

    res.status(201).json({ data: orden });
  } catch (error) {
    console.error('Error al crear orden:', error);
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.message?.includes('no es valido') || error.message?.includes('debe ser') || error.message?.includes('Registre primero')) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: 'Error al crear orden', details: error.message });
  }
};

export const createOrdenDirecta = async (req, res) => {
  try {
    const orden = await ordenService.crearOrdenDirecta(req.body, req.user);
    await notifyJefeTecnico({ type: 'orden_creada', title: 'Orden directa pendiente de asignación', message: `La orden #${orden.id_orden} necesita un técnico.`, severity: 'warning', entity: { kind: 'orden', id: orden.id_orden } });
    await notifyRoles(['Secretaria', 'ServicioCliente'], {
      type: 'orden_creada_servicio_cliente', title: 'Orden directa generada',
      message: `La orden directa #${orden.id_orden} fue creada correctamente.`, severity: 'success',
      entity: { kind: 'orden', id: orden.id_orden },
    });
    res.status(201).json({ data: orden });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo crear la orden directa' });
  }
};

export const updateOrden = async (req, res) => {
  try {
    const { tecnico_id, prioridad, estado } = req.body;

    const orden = await ordenService.actualizarOrden(req.params.id, { tecnico_id, prioridad, estado }, req.user);

    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

    res.json({ data: orden });
  } catch (error) {
    console.error('Error al actualizar orden:', error);
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    if (error.statusCode || error.message?.includes('no es valido')) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al actualizar orden', details: error.message });
  }
};

export const deleteOrden = async (req, res) => {
  try {
    await ordenService.eliminarOrden(req.params.id);

    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar orden:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Error al eliminar orden', details: error.message });
  }
};
