import prisma from '../../app/prismaClient.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';
import { withAuditUser } from '../../utils/auditContext.js';

const normalizeText = (value = '') => (value == null ? '' : String(value)).trim().replace(/\s+/g, ' ');
const normalizeNullableText = (value = '') => normalizeText(value) || null;
const normalizeUrl = (value = '') => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
};
const validateEmail = (correo) => !correo || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

const providerSearchWhere = (search) => (search
  ? {
      OR: [
        { nombre: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search, mode: 'insensitive' } },
        { correo: { contains: search, mode: 'insensitive' } },
        { web: { contains: search, mode: 'insensitive' } },
        { direccion: { contains: search, mode: 'insensitive' } },
        { notas: { contains: search, mode: 'insensitive' } },
        { nombre_contacto: { contains: search, mode: 'insensitive' } },
        { horario_atencion: { contains: search, mode: 'insensitive' } },
      ],
    }
  : {});

const providerData = (body) => ({
  nombre: normalizeText(body.nombre),
  telefono: normalizeNullableText(body.telefono),
  direccion: normalizeNullableText(body.direccion),
  correo: normalizeNullableText(body.correo),
  web: normalizeUrl(body.web),
  notas: normalizeNullableText(body.notas),
  nombre_contacto: normalizeNullableText(body.nombre_contacto),
  horario_atencion: normalizeNullableText(body.horario_atencion),
});

const findDuplicate = (nombre, id = null) => prisma.proveedores.findFirst({
  where: {
    descontinuada: false,
    nombre: { equals: nombre, mode: 'insensitive' },
    ...(id ? { NOT: { id_proveedor: id } } : {}),
  },
  select: { id_proveedor: true },
});

export const getProveedores = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const where = { descontinuada: false, ...providerSearchWhere(search) };
    const [proveedores, total] = await Promise.all([
      prisma.proveedores.findMany({ where, orderBy: { id_proveedor: 'desc' }, skip: offset, take: pageSize }),
      prisma.proveedores.count({ where }),
    ]);
    res.json({ data: proveedores, meta: buildPaginationMeta({ page, pageSize, total }) });
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ error: 'Error al obtener proveedores', details: error.message });
  }
};

export const getProveedorById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID de proveedor inválido' });
    const proveedor = await prisma.proveedores.findUnique({
      where: { id_proveedor: id },
      include: { compras: true },
    });
    if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ data: proveedor });
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ error: 'Error al obtener proveedor', details: error.message });
  }
};

export const createProveedor = async (req, res) => {
  try {
    const data = providerData(req.body);
    if (!data.nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!validateEmail(data.correo)) return res.status(400).json({ error: 'El correo del proveedor no tiene un formato valido' });
    if (await findDuplicate(data.nombre)) return res.status(409).json({ error: 'Ya existe un proveedor activo con ese nombre' });

    const proveedor = await withAuditUser(req.user, (tx) => tx.proveedores.create({ data: { ...data, descontinuada: false } }));
    res.status(201).json({ data: proveedor });
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(500).json({ error: 'Error al crear proveedor', details: error.message });
  }
};

export const updateProveedor = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID de proveedor inválido' });
    const data = providerData(req.body);
    if (!data.nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!validateEmail(data.correo)) return res.status(400).json({ error: 'El correo del proveedor no tiene un formato valido' });
    const actual = await prisma.proveedores.findFirst({ where: { id_proveedor: id, descontinuada: false } });
    if (!actual) return res.status(404).json({ error: 'Proveedor no encontrado' });
    if (await findDuplicate(data.nombre, id)) return res.status(409).json({ error: 'Ya existe otro proveedor activo con ese nombre' });

    const proveedor = await withAuditUser(req.user, (tx) => tx.proveedores.update({ where: { id_proveedor: id }, data }));
    res.json({ data: proveedor });
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.status(500).json({ error: 'Error al actualizar proveedor', details: error.message });
  }
};

export const deleteProveedor = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID de proveedor inválido' });
    const result = await withAuditUser(req.user, (tx) => tx.proveedores.updateMany({
      where: { id_proveedor: id, descontinuada: false },
      data: { descontinuada: true },
    }));
    if (!result.count) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.status(204).send();
  } catch (error) {
    console.error('Error al desactivar proveedor:', error);
    res.status(500).json({ error: 'Error al desactivar proveedor' });
  }
};
