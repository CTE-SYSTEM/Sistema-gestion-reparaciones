import prisma from '../../app/prismaClient.js';
import { notifyRoles } from '../../services/notifications.js';
import {
  METODOS_PAGO,
  assertInList,
  parseNonNegativeMoney,
  parsePositiveId,
} from '../../utils/domainValidation.js';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { getBusinessSettings } from '../../services/adminSettingsService.js';
import { precioVentaDetalle, montoRepuestos } from '../../utils/precioRepuestos.js';

const facturaInclude = {
  garantias: true,
  diagnostico: { include: { equipo: { include: { cliente: true } } } },
  orden: {
    include: {
      repuestos_usados: { include: { repuesto: { select: { id_repuesto: true, nombre: true } } } },
      diagnostico: {
        include: {
          equipo: {
            include: { cliente: true },
          },
        },
      },
    },
  },
};

const repuestoSafeSelect = {
  id_repuesto: true,
  tipo_repuesto_id: true,
  proveedor_id: true,
  nombre: true,
  descripcion: true,
  costo_individual: true,
  porcentaje_de_ganacia: true,
  ganancia_cordobas: true,
  activo: true,
  descontinuada: true,
};

const repuestosUsadosInclude = {
  repuestos_usados: {
    include: { repuesto: { select: repuestoSafeSelect }, compra: { select: { id_compra: true, costo_unitario: true, proveedor_id: true } } },
  },
};

const tieneRepuestosSinAprobar = (orden) =>
  (orden.repuestos_usados || []).some((detalle) => !['APROBADO', 'DENEGADO'].includes((detalle.estado_aprobacion || '').toUpperCase()));

const tieneRepuestosSinRegistrar = (orden) =>
  (orden.repuestos_usados || []).some((detalle) => detalle.estado_aprobacion === 'APROBADO' && !detalle.repuesto_id);

const decimalToNumber = (value) => (value === null || value === undefined ? value : Number(value));

const facturaSearchWhere = (search) => (search
  ? {
      OR: [
        ...(/^\d+$/.test(search) && Number(search) <= 2147483647 ? [{ id_factura: Number(search) }, { orden_id: Number(search) }] : []),
        { metodo_pago: { contains: search, mode: 'insensitive' } },
        { orden: { diagnostico: { equipo: { cliente: { nombre: { contains: search, mode: 'insensitive' } } } } } },
        { orden: { diagnostico: { equipo: { marca: { contains: search, mode: 'insensitive' } } } } },
        { orden: { diagnostico: { equipo: { modelo: { contains: search, mode: 'insensitive' } } } } },
        { orden: { diagnostico: { equipo: { numero_serie: { contains: search, mode: 'insensitive' } } } } },
        { diagnostico: { equipo: { cliente: { nombre: { contains: search, mode: 'insensitive' } } } } },
      ],
    }
  : {});

export const getFacturas = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const entregaEstado = String(req.query.entregaEstado || '').trim();
    const where = {
      ...facturaSearchWhere(search),
      ...(entregaEstado === 'pendientes' ? { orden: { is: { estado: { not: 'ENTREGADO' } } } } : {}),
      ...(entregaEstado === 'entregadas' ? { orden: { is: { estado: 'ENTREGADO' } } } : {}),
    };
    const [facturasRows, total] = await Promise.all([
      prisma.facturas.findMany({
        where,
        include: facturaInclude,
        orderBy: { id_factura: 'desc' },
        skip: offset,
        take: pageSize,
      }),
      prisma.facturas.count({ where }),
    ]);
    const facturas = facturasRows.map((factura) => ({
      ...factura,
      monto_repuestos: decimalToNumber(factura.monto_repuestos),
      mano_obra: decimalToNumber(factura.mano_obra),
      monto_diagnostico: decimalToNumber(factura.monto_diagnostico),
      subtotal: decimalToNumber(factura.subtotal),
      impuestos: decimalToNumber(factura.impuestos),
      total: decimalToNumber(factura.total),
    }));

    res.json({ data: facturas, meta: buildPaginationMeta({ page, pageSize, total }) });
  } catch (error) {
    console.error('Error al obtener facturas:', error);
    res.status(500).json({ error: 'Error al obtener facturas', details: error.message });
  }
};

export const createFactura = async (req, res) => {
  try {
    const {
      orden_id,
      mano_obra,
      monto_diagnostico,
      impuestos,
      metodo_pago,
    } = req.body;
    const ordenId = parsePositiveId(orden_id);

    if (!ordenId) {
      return res.status(400).json({ error: 'La orden es obligatoria' });
    }

    const manoObra = parseNonNegativeMoney(mano_obra, 'Mano de obra');
    const montoDiagnostico = parseNonNegativeMoney(monto_diagnostico, 'Diagnóstico');
    const impuestoCalculado = parseNonNegativeMoney(impuestos, 'Impuestos');
    if (!String(metodo_pago || '').trim()) {
      return res.status(400).json({ error: 'El metodo de pago es obligatorio' });
    }
    const metodoPago = assertInList(metodo_pago, METODOS_PAGO, 'Metodo de pago');

    const orden = await prisma.ordenes.findUnique({
      where: { id_orden: ordenId },
      include: {
        facturas: true,
        diagnostico: { select: { id_diagnostico: true, origen_directo: true, factura_diagnostico: { select: { id_factura: true } } } },
        ...repuestosUsadosInclude,
      },
    });

    if (!orden) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const estadoOrden = (orden.estado || '').toUpperCase();

    if (!['FINALIZADO', 'IRREPARABLE'].includes(estadoOrden)) {
      return res.status(409).json({ error: 'Solo se pueden facturar ordenes finalizadas o irreparables' });
    }
    if (orden.es_garantia) return res.status(409).json({ error: 'El reingreso cubierto se factura automáticamente sin cobro al aprobar calidad' });
    if (estadoOrden === 'FINALIZADO' && orden.calidad_estado !== 'APROBADO') {
      return res.status(409).json({ error: 'Falta la aprobación de control de calidad' });
    }

    if (orden.facturas.length > 0) {
      return res.status(409).json({ error: 'Esta orden ya tiene una factura registrada' });
    }
    if (orden.diagnostico.factura_diagnostico) return res.status(409).json({ error: 'El diagnóstico ya figura en otra factura' });
    if (orden.diagnostico.origen_directo && montoDiagnostico !== 0) {
      return res.status(400).json({ error: 'La orden directa no lleva cargo de diagnóstico' });
    }

    if (estadoOrden === 'FINALIZADO' && tieneRepuestosSinAprobar(orden)) {
      return res.status(409).json({ error: 'La orden tiene repuestos pendientes de aprobacion. Apruebelos o rechacelos antes de facturar.' });
    }

    if (estadoOrden === 'FINALIZADO' && tieneRepuestosSinRegistrar(orden)) {
      return res.status(409).json({ error: 'La orden tiene piezas pendientes de registro. Registrelas antes de facturar.' });
    }

    const importeRepuestos = estadoOrden === 'IRREPARABLE' ? 0 : montoRepuestos(orden.repuestos_usados);
    const subtotalCalculado = Math.round((importeRepuestos + manoObra + montoDiagnostico) * 100) / 100;
    const totalCalculado = Math.round((subtotalCalculado + impuestoCalculado) * 100) / 100;

    const factura = await withAuditUser(req.user, async (tx) => {
      if (estadoOrden !== 'IRREPARABLE') {
        for (const detalle of orden.repuestos_usados.filter((r) => r.estado_aprobacion === 'APROBADO')) {
          const precio = precioVentaDetalle(detalle);
          await tx.ordenes_Repuestos.update({ where: { id_detalle_repuesto: detalle.id_detalle_repuesto }, data: {
            precio_unitario_facturado: precio,
            total_facturado: Math.round(Number(detalle.cantidad_usada || 0) * precio * 100) / 100,
            fecha_facturacion: new Date(),
          } });
        }
      }
      const facturaCreada = await tx.facturas.create({
        data: {
          orden_id: ordenId,
          diagnostico_id: orden.diagnostico_id,
          monto_repuestos: importeRepuestos,
          mano_obra: manoObra,
          monto_diagnostico: montoDiagnostico,
          subtotal: subtotalCalculado,
          impuestos: impuestoCalculado,
          total: totalCalculado,
          metodo_pago: metodoPago,
        },
      });
      if (metodoPago !== 'Pendiente' && totalCalculado > 0) {
        await tx.movimientosContables.create({ data: {
          factura_id: facturaCreada.id_factura, usuario_id: req.user.id, tipo: 'COBRO',
          monto: totalCalculado, metodo: metodoPago, motivo: 'Cobro registrado al emitir la factura',
        } });
      }

      return tx.facturas.findUnique({
        where: { id_factura: facturaCreada.id_factura },
        include: facturaInclude,
      });
    });

    await notifyRoles(['ServicioCliente', 'Garantias'], {
      type: 'factura_creada', title: 'Factura de reparación registrada',
      message: `La factura #${factura.id_factura} de la orden #${ordenId} fue registrada.`,
      entity: { kind: 'factura', id: factura.id_factura, orden_id: ordenId },
    });

    res.status(201).json({ data: factura });
  } catch (error) {
    console.error('Error al crear factura:', error);
    if (String(error.message || '').includes('Stock insuficiente')) {
      return res.status(409).json({ error: 'Stock insuficiente para facturar los repuestos de la orden' });
    }
    if (error.message?.includes('debe ser') || error.message?.includes('no es valido')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Esta orden o diagnóstico ya tiene una factura registrada' });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'La orden especificada no existe' });
    }
    res.status(500).json({ error: 'Error al crear factura', details: error.message });
  }
};

export const getOrdenesParaFacturar = async (req, res) => {
  try {
    const ordenes = await prisma.ordenes.findMany({
      where: {
        facturas: { none: {} },
        es_garantia: false,
        diagnostico: { factura_diagnostico: { is: null } },
        OR: [
          { estado: 'IRREPARABLE' },
          {
            estado: 'FINALIZADO',
            calidad_estado: 'APROBADO',
            repuestos_usados: {
              none: {
                OR: [
                  { estado_aprobacion: { notIn: ['APROBADO', 'DENEGADO'] } },
                  { estado_aprobacion: 'APROBADO', repuesto_id: null },
                ],
              },
            },
          },
        ],
      },
      include: {
        diagnostico: { include: { equipo: { include: { cliente: true } } } },
        tecnico: true,
        ...repuestosUsadosInclude,
      },
      orderBy: { id_orden: 'desc' },
    });

    const ordenesDisponibles = ordenes.map((orden) => {
      const repuestosFacturacion = (orden.repuestos_usados || []).map((detalle) => {
        const precioUnitario = detalle.precio_unitario_facturado == null
          ? precioVentaDetalle(detalle)
          : Number(detalle.precio_unitario_facturado);
        return {
          ...detalle,
          precio_unitario: precioUnitario,
          total: Math.round(Number(detalle.cantidad_usada || 0) * precioUnitario * 100) / 100,
        };
      });
      return {
        ...orden,
        facturas: [],
        monto_repuestos_calculado: orden.estado === 'IRREPARABLE' ? 0 : montoRepuestos(orden.repuestos_usados),
        repuestos_facturacion: repuestosFacturacion,
      };
    });

    res.json({
      data: ordenesDisponibles,
    });
  } catch (error) {
    console.error('Error al obtener ordenes para facturar:', error);
    res.status(500).json({ error: 'Error al obtener ordenes', details: error.message });
  }
};

export const getDiagnosticosParaFacturar = async (req, res) => {
  try {
    const diagnosticos = await prisma.diagnosticos.findMany({ where: {
      origen_directo: false, estado_del_diagnostico: { in: ['COMPLETADO', 'DIAGNOSTICADO', 'RECHAZADO'] },
      calidad_estado: 'APROBADO',
      ordenes: { none: {} }, factura_diagnostico: { is: null },
    }, include: { equipo: { include: { cliente: true } } }, orderBy: { id_diagnostico: 'desc' } });
    res.json({ data: diagnosticos });
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron cargar los diagnósticos pendientes de cobro' });
  }
};

export const getTarifasFacturacion = async (req, res) => {
  try {
    const { reglas } = await getBusinessSettings();
    res.json({ data: { diagnostico: reglas.tarifas_diagnostico, mano_obra: reglas.tarifas_mano_obra } });
  } catch { res.status(500).json({ error: 'No se pudieron cargar las tarifas' }); }
};

export const createFacturaDiagnostico = async (req, res) => {
  try {
    const id = parsePositiveId(req.body.diagnostico_id);
    if (!id) return res.status(400).json({ error: 'Seleccione un diagnóstico' });
    const monto = parseNonNegativeMoney(req.body.monto_diagnostico, 'Diagnóstico');
    const impuestos = parseNonNegativeMoney(req.body.impuestos, 'Impuestos');
    if (monto <= 0) return res.status(400).json({ error: 'Indique un cargo de diagnóstico mayor que cero' });
    const metodo = assertInList(req.body.metodo_pago, METODOS_PAGO, 'Método de pago');
    if (!metodo) return res.status(400).json({ error: 'Seleccione el método de pago' });
    const factura = await withAuditUser(req.user, async (tx) => {
      const diagnostico = await tx.diagnosticos.findUnique({ where: { id_diagnostico: id }, include: {
        ordenes: { select: { id_orden: true } }, factura_diagnostico: { select: { id_factura: true } },
      } });
      if (!diagnostico) throw Object.assign(new Error('Diagnóstico no encontrado'), { statusCode: 404 });
      if (diagnostico.origen_directo || !['COMPLETADO', 'DIAGNOSTICADO', 'RECHAZADO'].includes(diagnostico.estado_del_diagnostico) || diagnostico.ordenes.length) {
        throw Object.assign(new Error('Solo puede facturar un diagnóstico completado que no tenga orden de trabajo'), { statusCode: 409 });
      }
      if (diagnostico.calidad_estado !== 'APROBADO') throw Object.assign(new Error('Calidad debe aprobar el diagnóstico antes de facturarlo'), { statusCode: 409 });
      if (diagnostico.factura_diagnostico) throw Object.assign(new Error('Este diagnóstico ya fue facturado'), { statusCode: 409 });
      const creada = await tx.facturas.create({ data: {
        diagnostico_id: id, monto_diagnostico: monto, monto_repuestos: 0, mano_obra: 0,
        subtotal: monto, impuestos, total: Math.round((monto + impuestos) * 100) / 100,
        metodo_pago: metodo,
      }, include: facturaInclude });
      if (metodo !== 'Pendiente') await tx.movimientosContables.create({ data: {
        factura_id: creada.id_factura, usuario_id: req.user.id, tipo: 'COBRO',
        monto: Math.round((monto + impuestos) * 100) / 100, metodo, motivo: 'Cobro registrado al emitir la factura',
      } });
      return creada;
    });
    await notifyRoles(['Secretaria', 'ServicioCliente', 'Garantias'], {
      type: 'factura_creada', title: 'Factura de diagnóstico registrada',
      message: `La factura #${factura.id_factura} del diagnóstico #${id} fue registrada.`,
      entity: { kind: 'factura', id: factura.id_factura, diagnostico_id: id },
    });
    res.status(201).json({ data: factura });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Este diagnóstico ya fue facturado' });
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo crear la factura de diagnóstico' });
  }
};

export const getDetalleFacturacion = async (req, res) => {
  try {
    const orden = await prisma.ordenes.findUnique({
      where: { id_orden: Number(req.params.id_orden) },
      include: {
        diagnostico: {
          include: {
            equipo: {
              include: { cliente: true },
            },
          },
        },
        ...repuestosUsadosInclude,
      },
    });

    if (!orden) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    res.json({ data: orden });
  } catch (error) {
    console.error('Error al obtener detalle de facturacion:', error);
    res.status(500).json({ error: 'Error al obtener detalle', details: error.message });
  }
};

export const crearFactura = createFactura;
export const getHistorialFacturas = getFacturas;
