// backend/src/controllers/Secretaria/diagnosticosController.js
import prisma from '../../app/prismaClient.js';
import diagnosticoService from '../../services/recepcion/diagnosticoService.js';
import { notifyJefeTecnico, notifyTecnico } from '../../services/notifications.js';

export const getDiagnosticos = async (req, res) => {
  try {
    const result = await diagnosticoService.listarDiagnosticos(req.query);
    res.json(result);
  } catch (error) {
    console.error('Error en getDiagnosticos:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Error al obtener historial', details: error.message });
  }
};

export const createDiagnostico = async (req, res) => {
  try {
    const { equipo_id, tecnico_id, falla_reportada, diagnostico_real,
      presupuesto_estimado, moneda_presupuesto, prioridad, estado_del_diagnostico, Estado_aprobacion, deja_cargador, enciende, usa_corriente_ac,
      estado_cargador, estado_accesorios, estado_fisico, estado_encendido, estado_alimentacion, estado_acceso,
      detalle_accesorios, observaciones_recepcion } = req.body;

    if (!falla_reportada?.trim()) {
      return res.status(400).json({ error: 'La falla reportada es obligatoria' });
    }

    const equipoId = diagnosticoService.validarEquipoId(equipo_id);
    if (!equipoId) {
      return res.status(400).json({ error: 'El equipo es obligatorio' });
    }

    const diagnostico = await diagnosticoService.crearDiagnostico({
      equipo_id: equipoId,
      tecnico_id,
      falla_reportada,
      diagnostico_real,
      presupuesto_estimado,
      moneda_presupuesto,
      prioridad,
      estado_del_diagnostico,
      Estado_aprobacion,
      deja_cargador,
      enciende,
      usa_corriente_ac,
      estado_cargador, estado_accesorios, estado_fisico, estado_encendido, estado_alimentacion, estado_acceso,
      detalle_accesorios, observaciones_recepcion,
    }, req.user);

    const diagnosticoId = diagnostico.id_diagnostico;
    const equipoNombre = [diagnostico.equipo?.tipo, diagnostico.equipo?.marca, diagnostico.equipo?.modelo].filter(Boolean).join(' ') || 'Equipo recibido';
    const clienteNombre = diagnostico.cliente?.nombre || 'Cliente del taller';
    if (!diagnostico.tecnico_id && ['PENDIENTE', 'INGRESADO', 'ASIGNADO', 'EN_REVISION'].includes(diagnostico.estado_del_diagnostico)) await notifyJefeTecnico({
      type: 'diagnostico_creado',
      title: 'Nuevo diagnóstico recibido',
      message: `Diagnóstico #${diagnosticoId} · ${equipoNombre} · ${clienteNombre}. Pendiente de asignar técnico. Prioridad: ${diagnostico.prioridad}.`,
      severity: 'warning',
      entity: { kind: 'diagnostico', id: diagnosticoId },
    });

    if (tecnico_id) {
      const tecnico = await prisma.tecnicos.findFirst({
        where: { id_tecnico: Number(tecnico_id), activo: true },
        select: { id_tecnico: true, nombre: true, usuario_id: true },
      });

      if (tecnico?.usuario_id) {
        await notifyTecnico(tecnico, {
          type: 'diagnostico_asignado',
          title: 'Nuevo diagnostico asignado',
          message: `Se te asignó el diagnostico #${diagnostico?.id_diagnostico || equipoId}`,
          severity: 'info',
          entity: { kind: 'diagnostico', id: Number(diagnostico?.id_diagnostico || equipoId) },
        });
      }
    }

    res.status(201).json({ data: diagnostico });
  } catch (error) {
    console.error('Error en createDiagnostico:', error.message);
    console.error('Stack:', error.stack);
    if (error.message?.includes('no es valido') || error.message?.includes('debe ser')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al crear', details: error.message });
  }
};

export const updateDiagnostico = async (req, res) => {
  try {
    const { id } = req.params;
    const { equipo_id, tecnico_id, falla_reportada, diagnostico_real,
      presupuesto_estimado, moneda_presupuesto, prioridad, estado, estado_del_diagnostico,
      Estado_aprobacion, deja_cargador, enciende, usa_corriente_ac,
      estado_cargador, estado_accesorios, estado_fisico, estado_encendido, estado_alimentacion, estado_acceso,
      detalle_accesorios, observaciones_recepcion } = req.body;

    if (falla_reportada !== undefined && !falla_reportada?.trim()) {
      return res.status(400).json({ error: 'La falla reportada es obligatoria' });
    }

    const diagnostico = await diagnosticoService.actualizarDiagnostico(id, {
      equipo_id,
      tecnico_id,
      falla_reportada,
      diagnostico_real,
      presupuesto_estimado,
      moneda_presupuesto,
      prioridad,
      estado,
      estado_del_diagnostico,
      Estado_aprobacion,
      deja_cargador,
      enciende,
      usa_corriente_ac,
      estado_cargador, estado_accesorios, estado_fisico, estado_encendido, estado_alimentacion, estado_acceso,
      detalle_accesorios, observaciones_recepcion,
    }, req.user);

    if (!diagnostico) return res.status(404).json({ error: 'Diagnostico no encontrado' });

    const tecnicoIdNuevo = tecnico_id ? Number(tecnico_id) : null;
    if (tecnicoIdNuevo) {
      const tecnico = await prisma.tecnicos.findFirst({
        where: { id_tecnico: tecnicoIdNuevo, activo: true },
        select: { id_tecnico: true, nombre: true, usuario_id: true },
      });

      if (tecnico?.usuario_id) {
        await notifyTecnico(tecnico, {
          type: 'diagnostico_actualizado',
          title: 'Diagnostico actualizado',
          message: `Se actualizó el diagnostico #${id}`,
          severity: 'info',
          entity: { kind: 'diagnostico', id: Number(id) },
        });
      }
    }

    res.json({ data: diagnostico });
  } catch (error) {
    console.error('Error en updateDiagnostico:', error.message);
    console.error('Stack:', error.stack);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Diagnostico no encontrado' });
    }
    if (error.message?.includes('no es valido') || error.message?.includes('debe ser')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al cambiar estado', details: error.message });
  }
};

export const updateEstadoDiagnostico = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, estado_del_diagnostico } = req.body;
    const estadoNuevo = diagnosticoService.validarEstadoDiagnostico(estado_del_diagnostico || estado);
    const diagnostico = await diagnosticoService.cambiarEstadoDiagnostico(id, estadoNuevo, req.user);

    if (!diagnostico) return res.status(404).json({ error: 'Diagnostico no encontrado' });

    res.json({ data: diagnostico });
  } catch (error) {
    console.error('Error en updateEstadoDiagnostico:', error.message);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Diagnostico no encontrado' });
    }
    if (error.message?.includes('no es valido')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al cambiar estado', details: error.message });
  }
};
