import prisma from '../../app/prismaClient.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';
import { METODOS_PAGO, assertInList } from '../../utils/domainValidation.js';
import { withAuditUser } from '../../utils/auditContext.js';

const normalizeText = (value = '') => String(value).trim().replace(/\s+/g, ' ');
const parsePurchaseDate = (value) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};

export const getCompras = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const desde = req.query.fecha_desde ? parsePurchaseDate(req.query.fecha_desde) : null;
    const hasta = req.query.fecha_hasta ? parsePurchaseDate(req.query.fecha_hasta) : null;
    if ((req.query.fecha_desde && !desde) || (req.query.fecha_hasta && !hasta) || (desde && hasta && desde > hasta)) {
      return res.status(400).json({ error: 'Indique un rango de fechas válido' });
    }
    const where = {
      ...(search ? { OR: [
            { documento: { contains: search, mode: 'insensitive' } },
            { proveedor: { nombre: { contains: search, mode: 'insensitive' } } },
            { repuesto: { nombre: { contains: search, mode: 'insensitive' } } },
            { metodo_pago: { contains: search, mode: 'insensitive' } },
          ] } : {}),
      ...((desde || hasta) ? { fecha_obtencion: {
        ...(desde ? { gte: desde } : {}),
        ...(hasta ? { lt: new Date(hasta.getTime() + 24 * 60 * 60 * 1000) } : {}),
      } } : {}),
    };
    const [compras, countRows] = await Promise.all([
      prisma.compras.findMany({
        where,
        include: { proveedor: true, repuesto: true, _count: { select: { archivos: true } } },
        orderBy: [{ fecha_obtencion: 'desc' }, { id_compra: 'desc' }],
        skip: offset,
        take: pageSize,
      }),
      prisma.compras.count({ where }),
    ]);

    res.json({ data: compras, meta: buildPaginationMeta({ page, pageSize, total: countRows }) });
  } catch (error) {
    console.error('Error al obtener compras:', error);
    res.status(500).json({ error: 'Error al obtener compras', details: error.message });
  }
};

export const createCompra = async (req, res) => {
  try {
    const {
      repuesto_id,
      proveedor_id,
      documento,
      fecha_obtencion,
      cantidad,
      costo_unitario,
      metodo_pago,
    } = req.body;

    if (!repuesto_id || !proveedor_id) {
      return res.status(400).json({ error: 'Proveedor y repuesto son obligatorios' });
    }

    const repuestoId = Number(repuesto_id);
    const proveedorId = Number(proveedor_id);
    const cantidadNumber = Number(cantidad);
    const costoNumber = Number(costo_unitario);
    const fecha = fecha_obtencion ? new Date(fecha_obtencion) : undefined;
    const metodoPago = normalizeText(metodo_pago);

    if (!Number.isInteger(cantidadNumber) || cantidadNumber <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser un numero entero mayor que cero' });
    }

    if (!costoNumber || costoNumber <= 0) {
      return res.status(400).json({ error: 'El costo unitario debe ser mayor que cero' });
    }

    if (fecha && Number.isNaN(fecha.getTime())) {
      return res.status(400).json({ error: 'La fecha de obtencion no es valida' });
    }

    if (!metodoPago) {
      return res.status(400).json({ error: 'El metodo de pago es obligatorio' });
    }

    const metodoPagoValidado = assertInList(metodoPago, METODOS_PAGO, 'Metodo de pago');
    const compra = await withAuditUser(req.user, async (tx) => {
      const base = await tx.repuestos.findFirst({
        where: { id_repuesto: repuestoId, descontinuada: false },
      });
      if (!base) throw new Error('El repuesto seleccionado no existe o esta descontinuado');

      const proveedor = await tx.proveedores.findFirst({
        where: { id_proveedor: proveedorId, descontinuada: false },
      });
      if (!proveedor) throw new Error('El proveedor seleccionado no existe o esta descontinuado');

      const sinVariante = base.proveedor_id === null && Number(base.costo_individual || 0) === 0;
      const mismaVariante = base.proveedor_id === proveedorId && Number(base.costo_individual || 0) === costoNumber;
      let targetRepuestoId = repuestoId;

      if (!sinVariante && !mismaVariante) {
        let variante = await tx.repuestos.findFirst({
          where: {
            descontinuada: false,
            tipo_repuesto_id: base.tipo_repuesto_id,
            nombre: { equals: base.nombre, mode: 'insensitive' },
            descripcion: base.descripcion,
            proveedor_id: proveedorId,
            costo_individual: costoNumber,
            ganancia_cordobas: base.ganancia_cordobas,
          },
        });
        if (!variante) {
          variante = await tx.repuestos.create({
            data: {
              tipo_repuesto_id: base.tipo_repuesto_id,
              proveedor_id: proveedorId,
              nombre: base.nombre,
              descripcion: base.descripcion,
              costo_individual: costoNumber,
              porcentaje_de_ganacia: base.porcentaje_de_ganacia,
              ganancia_cordobas: base.ganancia_cordobas,
              stock_minimo: base.stock_minimo,
              ubicacion_fisica: base.ubicacion_fisica,
              activo: true,
              descontinuada: false,
            },
          });
        }
        targetRepuestoId = variante.id_repuesto;
      }

      const compraCreada = await tx.compras.create({
        data: {
          repuesto_id: targetRepuestoId,
          proveedor_id: proveedorId,
          documento: normalizeText(documento) || null,
          fecha_obtencion: fecha || new Date(),
          cantidad: cantidadNumber,
          costo_unitario: costoNumber,
          metodo_pago: metodoPagoValidado,
        },
        include: { proveedor: true, repuesto: true },
      });

      await tx.repuestos.update({
        where: { id_repuesto: targetRepuestoId },
        data: { proveedor_id: proveedorId, costo_individual: costoNumber },
      });
      return compraCreada;
    });

    res.status(201).json({ data: compra });
  } catch (error) {
    console.error('Error al crear compra:', error);
    if (error.message?.includes('no es valido')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al crear compra', details: error.message });
  }
};

export const updateCompra = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      repuesto_id,
      proveedor_id,
      documento,
      fecha_obtencion,
      cantidad,
      costo_unitario,
      metodo_pago,
    } = req.body;

    if (!repuesto_id || !proveedor_id) {
      return res.status(400).json({ error: 'Proveedor y repuesto son obligatorios' });
    }

    const compraId = Number(id);
    const repuestoId = Number(repuesto_id);
    const proveedorId = Number(proveedor_id);
    const cantidadNumber = Number(cantidad);
    const costoNumber = Number(costo_unitario);
    const fecha = fecha_obtencion ? new Date(fecha_obtencion) : null;
    const metodoPagoNormalizado = normalizeText(metodo_pago);

    if (!Number.isInteger(compraId) || compraId <= 0) {
      return res.status(400).json({ error: 'Compra invalida' });
    }

    if (!Number.isInteger(cantidadNumber) || cantidadNumber <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser un numero entero mayor que cero' });
    }

    if (!costoNumber || costoNumber <= 0) {
      return res.status(400).json({ error: 'El costo unitario debe ser mayor que cero' });
    }

    if (fecha && Number.isNaN(fecha.getTime())) {
      return res.status(400).json({ error: 'La fecha de obtencion no es valida' });
    }

    if (!metodoPagoNormalizado) {
      return res.status(400).json({ error: 'El metodo de pago es obligatorio' });
    }

    const metodoPago = assertInList(metodoPagoNormalizado, METODOS_PAGO, 'Metodo de pago');

    const compra = await withAuditUser(req.user, async (tx) => {
      const actual = await tx.compras.findUnique({ where: { id_compra: compraId } });
      if (!actual) {
        const error = new Error('Compra no encontrada');
        error.status = 404;
        throw error;
      }

      const repuesto = await tx.repuestos.findFirst({
        where: { id_repuesto: repuestoId, descontinuada: false },
      });
      if (!repuesto) {
        const error = new Error('El repuesto seleccionado no existe o esta descontinuado');
        error.status = 400;
        throw error;
      }

      const proveedor = await tx.proveedores.findFirst({
        where: { id_proveedor: proveedorId, descontinuada: false },
      });
      if (!proveedor) {
        const error = new Error('El proveedor seleccionado no existe o esta descontinuado');
        error.status = 400;
        throw error;
      }

      await tx.repuestos.update({
        where: { id_repuesto: repuestoId },
        data: {
          proveedor_id: proveedorId,
          costo_individual: costoNumber,
        },
      });

      return tx.compras.update({
        where: { id_compra: compraId },
        data: {
          repuesto_id: repuestoId,
          proveedor_id: proveedorId,
          documento: normalizeText(documento) || null,
          fecha_obtencion: fecha,
          cantidad: cantidadNumber,
          costo_unitario: costoNumber,
          metodo_pago: metodoPago,
        },
        include: {
          proveedor: true,
          repuesto: { include: { proveedor: true, categoria: true } },
        },
      });
    });

    res.json({ data: compra });
  } catch (error) {
    console.error('Error al actualizar compra:', error);
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.message?.includes('no es valido')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al actualizar compra', details: error.message });
  }
};
