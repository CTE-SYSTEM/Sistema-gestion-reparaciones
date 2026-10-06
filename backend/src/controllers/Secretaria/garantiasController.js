// backend/src/controllers/Secretaria/garantiasController.js
import prisma from '../../app/prismaClient.js';
import { normalizeOptionalText, parsePositiveId } from '../../utils/domainValidation.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';

export const getGarantias = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const where = search
      ? {
          OR: [
            ...(Number.isInteger(Number(search)) ? [{ id_garantia: Number(search) }] : []),
            { condiciones: { contains: search, mode: 'insensitive' } },
            { factura: { metodo_pago: { contains: search, mode: 'insensitive' } } },
            { factura: { orden: { diagnostico: { equipo: { cliente: { nombre: { contains: search, mode: 'insensitive' } } } } } } },
          ],
        }
      : {};
    const [garantiasRows, total] = await Promise.all([
      prisma.garantias.findMany({
        where,
        include: {
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
    const { factura_id, condiciones, duracion_meses } = req.body;
    const facturaId = parsePositiveId(factura_id);
    const duracionMeses = Number(duracion_meses);

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
        condiciones: normalizeOptionalText(condiciones),
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
