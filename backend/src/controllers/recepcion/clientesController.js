// backend/src/controllers/Secretaria/clientesController.js
import prisma from '../../app/prismaClient.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';

const normalizeText = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const clienteSearchWhere = (search, searchMode = '') => {
  if (!search) return {};

  if (searchMode === 'prefix') {
    if (/^\d+$/.test(search)) {
      const id = Number(search);
      return {
        OR: [
          ...(Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? [{ id_cliente: id }] : []),
          { telefono: { contains: search } },
          { contacto_secundario: { contains: search } },
        ],
      };
    }

    return { nombre: { startsWith: search, mode: 'insensitive' } };
  }

  return {
    OR: [
      { nombre: { contains: search, mode: 'insensitive' } },
      { telefono: { contains: search, mode: 'insensitive' } },
      { correo: { contains: search, mode: 'insensitive' } },
      { contacto_secundario: { contains: search, mode: 'insensitive' } },
    ],
  };
};

/** Obtener todos los clientes activos */
export const getClientes = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const searchMode = req.query.searchMode === 'prefix' ? 'prefix' : '';
    const where = { activo: true, ...clienteSearchWhere(search, searchMode) };
    const [clientes, countRows] = await Promise.all([
      prisma.clientes.findMany({
        where,
        orderBy: searchMode === 'prefix' && search ? { nombre: 'asc' } : { id_cliente: 'desc' },
        skip: offset,
        take: pageSize,
      }),
      prisma.clientes.count({ where }),
    ]);

    res.json({ data: clientes, meta: buildPaginationMeta({ page, pageSize, total: countRows }) });
  } catch (error) {
    console.error('❌ Error en getClientes:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Error al obtener clientes', details: error.message });
  }
};

/** Crear un nuevo cliente */
export const createCliente = async (req, res) => {
  try {
    const nombreNormalizado = normalizeText(req.body.nombre);
    const telefonoNormalizado = normalizeText(req.body.telefono);
    if (!nombreNormalizado) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!telefonoNormalizado) return res.status(400).json({ error: 'El teléfono es obligatorio' });

    const resultado = await prisma.clientes.create({
      data: {
        nombre: nombreNormalizado,
        telefono: telefonoNormalizado,
        direccion: normalizeText(req.body.direccion),
        correo: normalizeText(req.body.correo),
        contacto_secundario: normalizeText(req.body.contacto_secundario),
      },
    });
    res.status(201).json({ data: resultado });
  } catch (error) {
    console.error('❌ Error en createCliente:', error.message);
    console.error('Stack:', error.stack);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'El teléfono ya está registrado para otro cliente' });
    }
    res.status(500).json({ error: 'Error al registrar el cliente', details: error.message });
  }
};

/** Actualizar un cliente existente */
export const updateCliente = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID de cliente inválido' });

    const nombreNormalizado = normalizeText(req.body.nombre);
    const telefonoNormalizado = normalizeText(req.body.telefono);
    if (!nombreNormalizado) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!telefonoNormalizado) return res.status(400).json({ error: 'El teléfono es obligatorio' });

    const existente = await prisma.clientes.findFirst({ where: { id_cliente: id, activo: true } });
    if (!existente) return res.status(404).json({ error: 'Cliente no encontrado' });

    const resultado = await prisma.clientes.update({
      where: { id_cliente: id },
      data: {
        nombre: nombreNormalizado,
        telefono: telefonoNormalizado,
        direccion: normalizeText(req.body.direccion),
        correo: normalizeText(req.body.correo),
        contacto_secundario: normalizeText(req.body.contacto_secundario),
      },
    });

    res.json({ data: resultado });
  } catch (error) {
    console.error('❌ Error en updateCliente:', error.message);
    console.error('Stack:', error.stack);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'El teléfono ya está registrado para otro cliente' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.status(500).json({ error: 'Error al actualizar el cliente', details: error.message });
  }
};

/** Borrado lógico (Desactivar) */
export const deleteCliente = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID de cliente inválido' });

    const resultado = await prisma.clientes.updateMany({
      where: { id_cliente: id, activo: true },
      data: { activo: false },
    });
    if (resultado.count === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    
    res.status(204).send();
  } catch (error) {
    console.error('❌ Error en deleteCliente:', error.message);
    console.error('Stack:', error.stack);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.status(500).json({ error: 'Error al desactivar el cliente', details: error.message });
  }
};
