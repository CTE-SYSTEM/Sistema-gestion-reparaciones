import prisma from '../../app/prismaClient.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';
import { parsePositiveId } from '../../utils/domainValidation.js';
import { withAuditUser } from '../../utils/auditContext.js';

const toPascalCase = (value) => {
  if (!value || typeof value !== 'string') return value;

  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const listarEquipos = async (query = {}) => {
  const { page, pageSize, offset } = parsePagination(query);
  const search = String(query.search || '').trim();
  const clienteId = query.cliente_id ? parsePositiveId(query.cliente_id) : null;
  if (query.cliente_id && !clienteId) throw Object.assign(new Error('Cliente inválido'), { statusCode: 400 });
  const where = {
    ...(clienteId ? { cliente_id: clienteId } : {}),
    ...(search ? { OR: [
      { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
      { tipo: { contains: search, mode: 'insensitive' } },
      { marca: { contains: search, mode: 'insensitive' } },
      { modelo: { contains: search, mode: 'insensitive' } },
      { numero_serie: { contains: search, mode: 'insensitive' } },
    ] } : {}),
  };
  const [rows, countRows] = await Promise.all([
    prisma.equipos.findMany({
      where,
      include: { cliente: true },
      orderBy: { id_equipo: 'desc' },
      skip: offset,
      take: pageSize,
    }),
    prisma.equipos.count({ where }),
  ]);

  return {
    data: rows,
    meta: buildPaginationMeta({ page, pageSize, total: countRows }),
  };
};

export const crearEquipo = async ({ cliente_id, tipo, marca, modelo, numero_serie, observaciones_generales }, user) => {
  const clienteId = parsePositiveId(cliente_id);
  if (!clienteId) throw new Error('El ID del cliente es inválido');
  await prisma.clientes.findUniqueOrThrow({ where: { id_cliente: clienteId } });

  return withAuditUser(user, (tx) => tx.equipos.create({
    data: {
      cliente_id: clienteId,
      tipo: toPascalCase(tipo) || null,
      marca: marca?.trim() || null,
      modelo: modelo?.trim() || null,
      numero_serie: numero_serie?.trim() || null,
      observaciones_generales: observaciones_generales?.trim() || null,
    },
    include: { cliente: true },
  }));
};

export const actualizarEquipo = async (id, { cliente_id, tipo, marca, modelo, numero_serie, observaciones_generales }, user) => {
  const equipoId = parsePositiveId(id);
  if (!equipoId) throw new Error('El ID del equipo es inválido');
  const data = {};
  if (cliente_id !== undefined && cliente_id !== null && cliente_id !== '') {
    const clienteId = parsePositiveId(cliente_id);
    if (!clienteId) throw new Error('El ID del cliente es inválido');
    await prisma.clientes.findUniqueOrThrow({ where: { id_cliente: clienteId } });
    data.cliente_id = clienteId;
  }
  if (tipo !== undefined) data.tipo = toPascalCase(tipo) || null;
  if (marca !== undefined) data.marca = marca?.trim() || null;
  if (modelo !== undefined) data.modelo = modelo?.trim() || null;
  if (numero_serie !== undefined) data.numero_serie = numero_serie?.trim() || null;
  if (observaciones_generales !== undefined) data.observaciones_generales = observaciones_generales?.trim() || null;

  return withAuditUser(user, (tx) => tx.equipos.update({
    where: { id_equipo: equipoId },
    data,
    include: { cliente: true },
  }));
};

export const eliminarEquipo = (id, user) => {
  const equipoId = parsePositiveId(id);
  if (!equipoId) throw new Error('El ID del equipo es inválido');
  return withAuditUser(user, (tx) => tx.equipos.delete({ where: { id_equipo: equipoId } }));
};

export default {
  listarEquipos,
  crearEquipo,
  actualizarEquipo,
  eliminarEquipo,
};
