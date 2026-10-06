import prisma from '../../app/prismaClient.js';
import { normalizeOptionalText } from '../../utils/domainValidation.js';
import { getBusinessSettings } from '../../services/adminSettingsService.js';
import { withAuditUser } from '../../utils/auditContext.js';

export const getGarantiasAdmin = async (req, res) => {
  try {
    const garantias = await prisma.garantias.findMany({
      include: {
        factura: {
          include: {
            orden: {
              include: {
                diagnostico: {
                  include: {
                    equipo: {
                      include: { cliente: true }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { fecha_vencimiento: 'asc' }
    });

    res.json({ data: garantias });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener garantías', details: error.message });
  }
};

export const createGarantiaAdmin = async (req, res) => {
  try {
    const defaults = (await getBusinessSettings()).negocio;
    const { factura_id, condiciones = defaults.garantia_condiciones, duracion_meses = defaults.garantia_meses } = req.body;
    if (!factura_id || !duracion_meses) {
      return res.status(400).json({ error: 'factura_id y duracion_meses son obligatorios' });
    }

    const facturaId = Number(factura_id);
    const duracion = Number(duracion_meses);
    if (!Number.isInteger(facturaId) || facturaId <= 0 || !Number.isInteger(duracion) || duracion < 1 || duracion > 36) {
      return res.status(400).json({ error: 'Factura o duración inválida' });
    }
    const factura = await prisma.facturas.findUnique({ where: { id_factura: facturaId } });
    if (!factura) return res.status(400).json({ error: 'La factura especificada no existe' });
    const fecha_inicio = new Date();
    const fecha_vencimiento = new Date(fecha_inicio);
    fecha_vencimiento.setMonth(fecha_vencimiento.getMonth() + duracion);
    const nuevaGarantia = await withAuditUser(req.user, (tx) => tx.garantias.create({
      data: {
        factura_id: facturaId,
        condiciones: normalizeOptionalText(condiciones),
        duracion_meses: duracion,
        fecha_inicio,
        fecha_vencimiento,
      },
      include: { factura: true },
    }));

    res.status(201).json({ message: 'Garantía registrada exitosamente', data: nuevaGarantia });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'La factura ya tiene una garantía.' });
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'La factura especificada no existe' });
    }
    res.status(500).json({ error: 'Error al crear garantía', details: error.message });
  }
};

export const updateGarantiaAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { condiciones, duracion_meses } = req.body;

    const garantiaId = Number(id);
    if (!Number.isInteger(garantiaId) || garantiaId <= 0) {
      return res.status(400).json({ error: 'ID de garantía inválido' });
    }
    const garantiaActual = await prisma.garantias.findUnique({
      where: { id_garantia: garantiaId }
    });

    if (!garantiaActual) {
      return res.status(404).json({ error: 'Garantía no encontrada' });
    }

    const updatedData = {};
    if (condiciones !== undefined) updatedData.condiciones = normalizeOptionalText(condiciones);
    if (duracion_meses !== undefined && duracion_meses !== null) {
      updatedData.duracion_meses = Number(duracion_meses);
      if (!Number.isInteger(updatedData.duracion_meses) || updatedData.duracion_meses < 1 || updatedData.duracion_meses > 36) {
        return res.status(400).json({ error: 'Duración inválida. Debe ser entre 1 y 36 meses.' });
      }
      const fecha_inicio = garantiaActual.fecha_inicio || new Date();
      const fecha_vencimiento = new Date(fecha_inicio);
      fecha_vencimiento.setMonth(fecha_vencimiento.getMonth() + updatedData.duracion_meses);
      updatedData.fecha_inicio = fecha_inicio;
      updatedData.fecha_vencimiento = fecha_vencimiento;
    }
    if (Object.keys(updatedData).length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }

    const garantia = await withAuditUser(req.user, (tx) => tx.garantias.update({
      where: { id_garantia: garantiaId },
      data: updatedData,
      include: { factura: true },
    }));

    res.json({ data: garantia });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'La factura ya tiene una garantía.' });
    if (error.code === 'P2025') return res.status(404).json({ error: 'Garantía no encontrada' });
    res.status(500).json({ error: 'Error al actualizar garantía', details: error.message });
  }
};

export const renewGarantiaAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { duracion_meses, condiciones } = req.body;

    const garantiaId = Number(id);
    if (!Number.isInteger(garantiaId) || garantiaId <= 0) {
      return res.status(400).json({ error: 'ID de garantía inválido' });
    }
    const garantiaActual = await prisma.garantias.findUnique({
      where: { id_garantia: garantiaId }
    });

    if (!garantiaActual) {
      return res.status(404).json({ error: 'Garantía no encontrada' });
    }

    const duracion = duracion_meses !== undefined && duracion_meses !== null
      ? Number(duracion_meses)
      : garantiaActual.duracion_meses ?? 3;

    if (!Number.isInteger(duracion) || duracion < 1 || duracion > 36) {
      return res.status(400).json({ error: 'Duración inválida. Debe ser entre 1 y 36 meses.' });
    }

    const fecha_inicio = new Date();
    const fecha_vencimiento = new Date(fecha_inicio);
    fecha_vencimiento.setMonth(fecha_vencimiento.getMonth() + duracion);
    const garantia = await withAuditUser(req.user, (tx) => tx.garantias.update({
      where: { id_garantia: garantiaId },
      data: {
        condiciones: condiciones === undefined ? garantiaActual.condiciones : normalizeOptionalText(condiciones),
        duracion_meses: duracion,
        fecha_inicio,
        fecha_vencimiento,
      },
      include: { factura: true },
    }));

    const vencidaAnteriormente = garantiaActual.fecha_vencimiento ? new Date(garantiaActual.fecha_vencimiento) < new Date() : true;
    const mensaje = vencidaAnteriormente
      ? 'Garantía vencida. Se ha renovado la vigencia para la misma factura.'
      : 'Garantía revalidada correctamente.';

    res.json({ message: mensaje, data: garantia });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Garantía no encontrada' });
    res.status(500).json({ error: 'Error al renovar garantía', details: error.message });
  }
};

// 5. Gestión de usuarios y roles (solo admin_pro)
