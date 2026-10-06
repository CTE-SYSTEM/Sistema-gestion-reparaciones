import prisma from '../../app/prismaClient.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { buscarCatalogo } from '../../services/Tecnico/tecnicoService.js';
import { getBusinessSettings } from '../../services/adminSettingsService.js';

const normalizeNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('Los valores monetarios deben ser numeros mayores o iguales a cero');
  return Math.round(number * 100) / 100;
};
const normalizeText = (value = '') => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeNullableText = (value = '') => normalizeText(value) || null;
const normalizeRole = (role) => String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]/g, '').toLowerCase();
const canViewStock = (user) => {
  const role = normalizeRole(user?.rol);
  return ['adminpro', 'administrador', 'admin', 'secretaria'].includes(role);
};
const hideStock = (repuesto) => {
  if (!repuesto) return repuesto;
  const { stock_actual, ...safeRepuesto } = repuesto;
  return safeRepuesto;
};

const normalizeRepuestoInput = (body) => ({
  nombre: normalizeText(body.nombre),
  descripcion: normalizeNullableText(body.descripcion),
  categoria_nombre: normalizeText(body.categoria_nombre || body.categoria?.nombre_tipo),
  electronico: normalizeNullableText(body.electronico || body.categoria?.electronico),
  proveedor_id: Object.prototype.hasOwnProperty.call(body, 'proveedor_id')
    ? (body.proveedor_id ? Number(body.proveedor_id) : null)
    : undefined,
  costo_individual: normalizeNumber(body.costo_individual),
  ganancia_cordobas: normalizeNumber(body.ganancia_cordobas),
  stock_minimo: body.stock_minimo === undefined ? undefined : Number(body.stock_minimo),
  ubicacion_fisica: body.ubicacion_fisica === undefined ? undefined : normalizeNullableText(body.ubicacion_fisica),
});

const repuestoInclude = { categoria: true, proveedor: true };
const shapeRepuesto = (repuesto) => ({
  ...repuesto,
  costo_individual: repuesto.costo_individual === null ? null : Number(repuesto.costo_individual),
  porcentaje_de_ganacia: repuesto.porcentaje_de_ganacia === null ? null : Number(repuesto.porcentaje_de_ganacia),
  ganancia_cordobas: repuesto.ganancia_cordobas === null ? null : Number(repuesto.ganancia_cordobas),
});

const upsertCategoria = async (tx, nombre, electronico) => {
  const existente = await tx.categorias_Repuestos.findFirst({
    where: { nombre_tipo: { equals: nombre, mode: 'insensitive' } },
  });
  if (existente) {
    return tx.categorias_Repuestos.update({
      where: { id_tipo_repuesto: existente.id_tipo_repuesto },
      data: { electronico },
    });
  }
  return tx.categorias_Repuestos.create({ data: { nombre_tipo: nombre, electronico } });
};

const validateProveedor = async (tx, proveedorId) => {
  if (proveedorId === undefined || proveedorId === null) return null;
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) throw new Error('El proveedor es inválido');
  const proveedor = await tx.proveedores.findFirst({ where: { id_proveedor: proveedorId, descontinuada: false } });
  if (!proveedor) throw new Error('El proveedor no existe o esta descontinuado');
  return proveedorId;
};

const repuestoWhere = (search, soloDisponibles) => ({
  descontinuada: false,
  ...(soloDisponibles ? { stock_actual: { gt: 0 } } : {}),
  ...(search
    ? {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { descripcion: { contains: search, mode: 'insensitive' } },
          { ubicacion_fisica: { contains: search, mode: 'insensitive' } },
          { categoria: { nombre_tipo: { contains: search, mode: 'insensitive' } } },
          { categoria: { electronico: { contains: search, mode: 'insensitive' } } },
          { proveedor: { nombre: { contains: search, mode: 'insensitive' } } },
        ],
      }
    : {}),
});

export const getRepuestos = async (req, res) => {
  try {
    if (normalizeRole(req.user?.rol) === 'tecnico') {
      res.set('Cache-Control', 'private, no-store');
      return res.json({ success: true, ...await buscarCatalogo(req.query) });
    }
    const { page, pageSize, offset } = parsePagination(req.query);
    const soloDisponibles = ['1', 'true', 'si', 'yes'].includes(String(req.query.disponibles || '').toLowerCase());
    const search = String(req.query.search || '').trim();
    const where = repuestoWhere(search, soloDisponibles);
    const [rows, total] = await Promise.all([
      prisma.repuestos.findMany({ where, include: repuestoInclude, orderBy: { id_repuesto: 'desc' }, skip: offset, take: pageSize }),
      prisma.repuestos.count({ where }),
    ]);
    const repuestos = rows.map(shapeRepuesto);
    res.json({
      success: true,
      data: canViewStock(req.user) ? repuestos : repuestos.map(hideStock),
      meta: buildPaginationMeta({ page, pageSize, total }),
    });
  } catch (error) {
    console.error('Error en getRepuestos:', error.message);
    res.status(500).json({ success: false, message: 'Error al obtener repuestos', details: error.message });
  }
};

export const createRepuesto = async (req, res) => {
  try {
    const data = normalizeRepuestoInput(req.body);
    const settings = await getBusinessSettings();
    if (data.stock_minimo === undefined) data.stock_minimo = settings.reglas.stock_minimo_predeterminado;
    if (req.body.ganancia_cordobas == null || req.body.ganancia_cordobas === '') {
      const margin = settings.negocio.margen_repuesto_porcentaje;
      data.ganancia_cordobas = Math.round(data.costo_individual * margin) / 100;
    }
    if (data.stock_minimo !== undefined && (!Number.isInteger(data.stock_minimo) || data.stock_minimo < 0)) return res.status(400).json({ error: 'El stock mínimo debe ser un entero mayor o igual a cero' });
    if (!data.nombre) return res.status(400).json({ success: false, error: 'El nombre del repuesto es obligatorio' });
    if (!data.categoria_nombre) return res.status(400).json({ success: false, error: 'La categoria del repuesto es obligatoria' });

    const repuesto = await withAuditUser(req.user, async (tx) => {
      const categoria = await upsertCategoria(tx, data.categoria_nombre, data.electronico);
      const proveedorId = await validateProveedor(tx, data.proveedor_id);
      return tx.repuestos.create({
        data: {
          nombre: data.nombre,
          descripcion: data.descripcion,
          tipo_repuesto_id: categoria.id_tipo_repuesto,
          proveedor_id: proveedorId,
          costo_individual: data.costo_individual,
          ganancia_cordobas: data.ganancia_cordobas,
          stock_actual: 0,
          stock_minimo: data.stock_minimo ?? 0,
          ubicacion_fisica: data.ubicacion_fisica,
          activo: true,
          descontinuada: false,
        },
        include: repuestoInclude,
      });
    });
    const shaped = shapeRepuesto(repuesto);
    res.status(201).json({ success: true, data: canViewStock(req.user) ? shaped : hideStock(shaped) });
  } catch (error) {
    console.error('Error en createRepuesto:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
};

export const updateRepuesto = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = normalizeRepuestoInput(req.body);
    if (data.stock_minimo !== undefined && (!Number.isInteger(data.stock_minimo) || data.stock_minimo < 0)) return res.status(400).json({ error: 'El stock mínimo debe ser un entero mayor o igual a cero' });
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, error: 'ID de repuesto inválido' });
    if (!data.nombre) return res.status(400).json({ success: false, error: 'El nombre del repuesto es obligatorio' });
    if (!data.categoria_nombre) return res.status(400).json({ success: false, error: 'La categoria del repuesto es obligatoria' });

    const repuesto = await withAuditUser(req.user, async (tx) => {
      const actual = await tx.repuestos.findFirst({ where: { id_repuesto: id, descontinuada: false } });
      if (!actual) return null;
      const categoria = await upsertCategoria(tx, data.categoria_nombre, data.electronico);
      const proveedorId = await validateProveedor(tx, data.proveedor_id === undefined ? actual.proveedor_id : data.proveedor_id);
      return tx.repuestos.update({
        where: { id_repuesto: id },
        data: {
          nombre: data.nombre,
          descripcion: data.descripcion,
          tipo_repuesto_id: categoria.id_tipo_repuesto,
          proveedor_id: proveedorId,
          costo_individual: data.costo_individual,
          ganancia_cordobas: data.ganancia_cordobas,
          stock_minimo: data.stock_minimo,
          ubicacion_fisica: data.ubicacion_fisica,
        },
        include: repuestoInclude,
      });
    });
    if (!repuesto) return res.status(404).json({ success: false, error: 'Repuesto no encontrado' });
    const shaped = shapeRepuesto(repuesto);
    res.json({ success: true, data: canViewStock(req.user) ? shaped : hideStock(shaped) });
  } catch (error) {
    console.error('Error en updateRepuesto:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteRepuesto = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, error: 'ID de repuesto inválido' });
    const result = await withAuditUser(req.user, (tx) => tx.repuestos.updateMany({
      where: { id_repuesto: id, descontinuada: false },
      data: { descontinuada: true, activo: false },
    }));
    if (!result.count) return res.status(404).json({ success: false, error: 'Repuesto no encontrado' });
    res.json({ success: true, message: 'Repuesto marcado como descontinuado' });
  } catch (error) {
    console.error('Error en deleteRepuesto:', error.message);
    res.status(500).json({ success: false, error: 'Error al procesar la solicitud', details: error.message });
  }
};
