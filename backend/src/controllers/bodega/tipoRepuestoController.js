import prisma from '../../app/prismaClient.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';
import { parsePositiveId } from '../../utils/domainValidation.js';

const normalizeText = (value = '') => String(value).trim().replace(/\s+/g, ' ');

export const getTiposRepuesto = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = normalizeText(req.query.search);
    const searchFilter = search
      ? {
          OR: [
            { nombre_tipo: { contains: search, mode: 'insensitive' } },
            { electronico: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const [tipos, total] = await Promise.all([
      prisma.categorias_Repuestos.findMany({
        where: searchFilter,
        include: { _count: { select: { repuestos: true } } },
        orderBy: { id_tipo_repuesto: 'desc' },
        skip: offset,
        take: pageSize,
      }),
      prisma.categorias_Repuestos.count({ where: searchFilter }),
    ]);

    res.json({
      success: true,
      data: tipos,
      meta: buildPaginationMeta({ page, pageSize, total }),
    });
  } catch (error) {
    console.error('Error en getTiposRepuesto:', error.message);
    res.status(500).json({ success: false, error: 'Error al obtener tipos de repuesto', details: error.message });
  }
};

export const createTipoRepuesto = async (req, res) => {
  try {
    const nombre_tipo = normalizeText(req.body.nombre_tipo);
    const electronico = normalizeText(req.body.electronico);

    if (!nombre_tipo) {
      return res.status(400).json({ success: false, error: 'El nombre del tipo de repuesto es obligatorio' });
    }

    const existente = await prisma.categorias_Repuestos.findFirst({
      where: {
        nombre_tipo: { equals: nombre_tipo, mode: 'insensitive' },
        electronico: electronico ? { equals: electronico, mode: 'insensitive' } : undefined,
      },
    });

    if (existente) {
      return res.status(409).json({ success: false, error: 'Ya existe un tipo de repuesto con esos datos' });
    }

    const tipo = await prisma.categorias_Repuestos.create({
      data: { nombre_tipo, electronico: electronico || null },
      include: { _count: { select: { repuestos: true } } },
    });

    res.status(201).json({ success: true, data: tipo });
  } catch (error) {
    console.error('Error en createTipoRepuesto:', error.message);
    res.status(500).json({ success: false, error: 'Error al crear tipo de repuesto', details: error.message });
  }
};

export const updateTipoRepuesto = async (req, res) => {
  try {
    const { id } = req.params;
    const tipoId = parsePositiveId(id);
    if (!tipoId) return res.status(400).json({ success: false, error: 'ID de tipo de repuesto inválido' });
    const nombre_tipo = normalizeText(req.body.nombre_tipo);
    const electronico = normalizeText(req.body.electronico);

    if (!nombre_tipo) {
      return res.status(400).json({ success: false, error: 'El nombre del tipo de repuesto es obligatorio' });
    }

    const existente = await prisma.categorias_Repuestos.findFirst({
      where: {
        id_tipo_repuesto: { not: tipoId },
        nombre_tipo: { equals: nombre_tipo, mode: 'insensitive' },
        electronico: electronico ? { equals: electronico, mode: 'insensitive' } : undefined,
      },
    });
    if (existente) {
      return res.status(409).json({ success: false, error: 'Ya existe un tipo de repuesto con esos datos' });
    }

    const tipo = await prisma.categorias_Repuestos.update({
      where: { id_tipo_repuesto: tipoId },
      data: { nombre_tipo, electronico: electronico || null },
      include: { _count: { select: { repuestos: true } } },
    });

    res.json({ success: true, data: tipo });
  } catch (error) {
    console.error('Error en updateTipoRepuesto:', error.message);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Tipo de repuesto no encontrado' });
    }
    res.status(500).json({ success: false, error: 'Error al actualizar tipo de repuesto', details: error.message });
  }
};

export const deleteTipoRepuesto = async (req, res) => {
  try {
    const { id } = req.params;
    const tipoId = parsePositiveId(id);
    if (!tipoId) return res.status(400).json({ success: false, error: 'ID de tipo de repuesto inválido' });

    await prisma.$transaction(async (tx) => {
      const usados = await tx.repuestos.count({
        where: { tipo_repuesto_id: tipoId },
      });

      if (usados > 0) {
        const error = new Error('No se puede eliminar: hay repuestos unidos a este tipo');
        error.statusCode = 409;
        throw error;
      }

      await tx.categorias_Repuestos.delete({
        where: { id_tipo_repuesto: tipoId },
      });
    });

    res.json({ success: true, message: 'Tipo de repuesto eliminado' });
  } catch (error) {
    console.error('Error en deleteTipoRepuesto:', error.message);
    if (error.statusCode === 409) {
      return res.status(409).json({ success: false, error: error.message });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Tipo de repuesto no encontrado' });
    }
    res.status(500).json({ success: false, error: 'Error al eliminar tipo de repuesto', details: error.message });
  }
};
