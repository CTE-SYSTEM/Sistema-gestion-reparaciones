// backend/src/controllers/Secretaria/garantiasController.js
import prisma from '../../app/prismaClient.js';
import { parsePositiveId } from '../../utils/domainValidation.js';
import { getBusinessSettings, recordAdminAction } from '../../services/adminSettingsService.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';

export const getGarantias = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const estado = String(req.query.estado || 'TODAS').toUpperCase();
    const now = new Date();
    const where = {
      ...(estado === 'VIGENTES' ? { fecha_inicio: { lte: now }, fecha_vencimiento: { gte: now } } : {}),
      ...(estado === 'VENCIDAS' ? { fecha_vencimiento: { lt: now } } : {}),
      ...(estado === 'PENDIENTES' ? { fecha_inicio: null } : {}),
      ...(search ? {
          OR: [
            ...(/^\d+$/.test(search) && Number(search) <= 2147483647 ? [{ id_garantia: Number(search) }, { factura_id: Number(search) }] : []),
            { condiciones: { contains: search, mode: 'insensitive' } },
            { factura: { metodo_pago: { contains: search, mode: 'insensitive' } } },
            { factura: { orden: { diagnostico: { equipo: { cliente: { nombre: { contains: search, mode: 'insensitive' } } } } } } },
            { factura: { orden: { diagnostico: { equipo: { marca: { contains: search, mode: 'insensitive' } } } } } },
            { factura: { orden: { diagnostico: { equipo: { modelo: { contains: search, mode: 'insensitive' } } } } } },
          ],
        } : {}),
    };
    const [garantiasRows, total] = await Promise.all([
      prisma.garantias.findMany({
        where,
        include: {
          reclamos: { select: { id_reclamo: true, cobertura: true, estado: true, fecha_apertura: true }, orderBy: { id_reclamo: 'desc' } },
          factura: {
            include: {
              orden: {
                include: {
                  diagnostico: { include: { equipo: { include: { cliente: true } } } },
                },
              },
            },
          },
        },
        orderBy: [{ fecha_vencimiento: 'asc' }, { id_garantia: 'desc' }],
        skip: offset,
        take: pageSize,
      }),
      prisma.garantias.count({ where }),
    ]);
    const garantias = garantiasRows.map((garantia) => ({
      ...garantia,
      factura: garantia.factura
        ? {
            ...garantia.factura,
            monto_repuestos: garantia.factura.monto_repuestos === null ? null : Number(garantia.factura.monto_repuestos),
            mano_obra: garantia.factura.mano_obra === null ? null : Number(garantia.factura.mano_obra),
            subtotal: garantia.factura.subtotal === null ? null : Number(garantia.factura.subtotal),
            impuestos: garantia.factura.impuestos === null ? null : Number(garantia.factura.impuestos),
            total: garantia.factura.total === null ? null : Number(garantia.factura.total),
          }
        : null,
    }));

    res.json({ data: garantias, meta: buildPaginationMeta({ page, pageSize, total }) });
  } catch (error) {
    console.error('Error al obtener garantias:', error);
    res.status(500).json({ error: 'Error al obtener el historial de garantias' });
  }
};

export const createGarantia = async (req, res) => {
  try {
    const { factura_id } = req.body;
    const facturaId = parsePositiveId(factura_id);
    const { negocio } = await getBusinessSettings();
    const duracionMeses = negocio.garantia_meses;

    if (!facturaId) {
      return res.status(400).json({ error: 'La factura es obligatoria' });
    }

    if (!Number.isInteger(duracionMeses) || duracionMeses < 1 || duracionMeses > 36) {
      return res.status(400).json({ error: 'La duracion debe estar entre 1 y 36 meses' });
    }

    const factura = await prisma.facturas.findUnique({
      where: { id_factura: facturaId },
      include: { garantias: true, orden: { select: { estado: true, resultado_final: true, irreparable_estado: true } } },
    });

    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (factura.garantias.length > 0) {
      return res.status(409).json({ error: 'Esta factura ya tiene una garantia registrada' });
    }
    if (!['FINALIZADO', 'ENTREGADO'].includes(factura.orden?.estado) || factura.orden?.resultado_final === 'IRREPARABLE' || factura.orden?.irreparable_estado === 'APROBADO') {
      return res.status(409).json({ error: 'Solo una reparación realizada puede tener garantía' });
    }

    const fecha_inicio = new Date();
    const fecha_vencimiento = new Date();
    fecha_vencimiento.setMonth(fecha_vencimiento.getMonth() + duracionMeses);

    const nuevaGarantia = await prisma.garantias.create({
      data: {
        factura_id: facturaId,
        condiciones: negocio.garantia_condiciones,
        duracion_meses: duracionMeses,
        fecha_inicio,
        fecha_vencimiento,
      },
      include: {
        factura: true,
      },
    });

    res.status(201).json({
      message: 'Garantia generada exitosamente',
      data: nuevaGarantia,
    });
  } catch (error) {
    console.error('Error al crear garantia:', error);
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'La factura especificada no existe' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Esta factura ya tiene una garantia registrada' });
    }
    res.status(500).json({ error: 'No se pudo registrar la garantia' });
  }
};

export const revalidarGarantia = async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    const meses = Number(req.body?.meses);
    const motivo = String(req.body?.motivo || '').trim();
    if (!id || !Number.isInteger(meses) || meses < 1 || meses > 36 || motivo.length < 10 || motivo.length > 1000) return res.status(400).json({ error: 'Indique meses (1 a 36) y motivo de 10 a 1000 caracteres' });
    const result = await withAuditUser(req.user, async (tx) => {
      await tx.$queryRaw`SELECT id_garantia FROM "Garantias" WHERE id_garantia = ${id} FOR UPDATE`;
      const existing = await tx.garantias.findUnique({ where: { id_garantia: id } });
      if (!existing) throw Object.assign(new Error('Garantía no encontrada'), { statusCode: 404 });
      if (!existing.fecha_inicio || !existing.fecha_vencimiento) throw Object.assign(new Error('La garantía comienza al entregar el equipo; todavía no puede revalidarse'), { statusCode: 409 });
      const base = new Date(Math.max(Date.now(), new Date(existing.fecha_vencimiento).getTime()));
      const vencimiento = new Date(base); vencimiento.setUTCMonth(vencimiento.getUTCMonth() + meses);
      const updated = await tx.garantias.update({ where: { id_garantia: id }, data: { fecha_vencimiento: vencimiento, duracion_meses: Number(existing.duracion_meses || 0) + meses } });
      await recordAdminAction(req.user, 'Garantias', 'REVALIDACION', { id_garantia: id, fecha_vencimiento: existing.fecha_vencimiento }, { fecha_vencimiento: vencimiento, meses }, motivo, tx);
      return updated;
    });
    res.json({ data: result });
  } catch (error) { res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo revalidar la garantía' }); }
};

export const getGarantiaByFactura = async (req, res) => {
  try {
    const { facturaId } = req.params;
    const garantia = await prisma.garantias.findFirst({
      where: { factura_id: parseInt(facturaId) },
    });

    if (!garantia) {
      return res.status(404).json({ error: 'No hay garantia registrada para esta factura' });
    }

    res.json({ data: garantia });
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar la garantia' });
  }
};
