import { Prisma } from '@prisma/client';
import prisma from '../app/prismaClient.js';
import { getBusinessSettings } from './adminSettingsService.js';
import { getBackupJobs } from './backupService.js';
import { getGananciasData } from '../controllers/admin_pro/analiticaController.js';
import { fail, redactAuditData } from '../utils/adminPolicy.js';
import { dateRange, positiveId } from '../utils/adminFilters.js';
import { ORDEN_ESTADOS } from '../utils/domainValidation.js';

const report = (id, categoria, nombre, filtros = [], descripcion = '') => ({ id, categoria, nombre, filtros, descripcion });
export const REPORT_CATALOG = [
  report('resumen', 'Resumen general', 'Resumen del taller', ['fechas']),
  report('ordenes_estado', 'Operación', 'Órdenes por estado', ['fechas']),
  report('ordenes_detalle', 'Operación', 'Detalle de órdenes', ['fechas', 'tecnico', 'estado_orden']),
  report('ordenes_atrasadas', 'Operación', 'Órdenes atrasadas', ['fechas', 'tecnico'], 'Usa el plazo configurado en Reglas del negocio.'),
  report('diagnosticos_estado', 'Operación', 'Diagnósticos por estado', ['fechas']),
  report('diagnosticos_detalle', 'Operación', 'Detalle de diagnósticos', ['fechas', 'tecnico']),
  report('repuestos_orden', 'Operación', 'Repuestos de una orden', ['orden']),
  report('facturacion', 'Finanzas', 'Facturación por período', ['fechas']),
  report('actividad_financiera', 'Finanzas', 'Actividad financiera del taller', ['fechas'], 'Reúne facturas, compras y entradas o salidas de dinero existentes; distingue el importe documentado del movimiento de caja.'),
  report('movimientos_contables', 'Finanzas', 'Cobros, devoluciones y gastos', ['fechas'], 'Movimientos de dinero realmente registrados.'),
  report('ganancias_resumen', 'Finanzas', 'Resumen de ganancias', ['fechas']),
  report('ganancias_mensuales', 'Finanzas', 'Balance mensual', ['fechas']),
  report('ganancias_semanales', 'Finanzas', 'Balance semanal', ['fechas']),
  report('ganancias_anuales', 'Finanzas', 'Balance anual', ['fechas']),
  report('ganancias_fuentes', 'Finanzas', 'Fuentes de ganancias', ['fechas']),
  report('perdidas_fuentes', 'Finanzas', 'Fuentes de pérdidas', ['fechas']),
  report('margen_orden', 'Finanzas', 'Margen por orden', ['fechas']),
  report('costos_perdidas', 'Finanzas', 'Costos y pérdidas por acción', ['fechas']),
  report('rentabilidad', 'Finanzas', 'Rentabilidad por etapa', ['fechas']),
  report('activos', 'Finanzas', 'Control de activos', [], 'Existencias actuales; no corresponde a un saldo histórico.'),
  report('inventario', 'Inventario y compras', 'Inventario actual', [], 'Distingue stock físico, reservado y disponible.'),
  report('stock_bajo', 'Inventario y compras', 'Repuestos bajo mínimos'),
  report('repuestos_usados', 'Inventario y compras', 'Repuestos utilizados', ['fechas']),
  report('repuestos_por_proveedor', 'Inventario y compras', 'Repuestos por proveedor', ['fechas', 'proveedor']),
  report('compras', 'Inventario y compras', 'Compras por período', ['fechas']),
  report('historial_repuesto', 'Inventario y compras', 'Historial de un repuesto', ['repuesto', 'fechas']),
  report('devoluciones_proveedor', 'Inventario y compras', 'Piezas defectuosas y devoluciones', ['fechas']),
  report('calidad_diagnosticos', 'Control de calidad', 'Revisión de diagnósticos', ['fechas']),
  report('calidad_ordenes', 'Control de calidad', 'Revisión de reparaciones', ['fechas']),
  report('reclamos', 'Reclamos y garantías', 'Reclamos y responsables', ['fechas']),
  report('equipos_cliente', 'Clientes y garantías', 'Clientes y equipos'),
  report('equipos', 'Clientes y garantías', 'Listado de equipos', ['cliente']),
  report('historial_equipo', 'Clientes y garantías', 'Historial de un equipo', ['equipo', 'fechas']),
  report('garantias', 'Clientes y garantías', 'Garantías registradas', ['estado_garantia']),
  report('garantias_vencer', 'Clientes y garantías', 'Garantías próximas a vencer', ['dias']),
  report('tecnicos', 'Técnicos', 'Rendimiento por técnico', ['fechas']),
  report('productividad_mensual', 'Técnicos', 'Productividad mensual', ['year']),
  report('productividad_anual', 'Técnicos', 'Productividad anual', ['year']),
  report('usuarios', 'Control administrativo', 'Usuarios y estado de acceso'),
  report('auditoria', 'Control administrativo', 'Movimientos de auditoría', ['fechas']),
  report('respaldos', 'Control administrativo', 'Historial de respaldos', ['fechas']),
];

const queries = {
  resumen: ({ start, end }) => Prisma.sql`SELECT * FROM admin_pro.resumen_general(CAST(${start} AS DATE), CAST(${end} AS DATE))`,
  repuestos_usados: ({ start, end }) => Prisma.sql`SELECT * FROM admin_pro.repuestos_usados_por_periodo(CAST(${start} AS DATE), CAST(${end} AS DATE))`,
  repuestos_por_proveedor: ({ proveedor, start, end }) => Prisma.sql`SELECT * FROM admin_pro.repuestos_usados_por_proveedor(CAST(${proveedor} AS INT), CAST(${start} AS DATE), CAST(${end} AS DATE))`,
  compras: ({ start, end }) => Prisma.sql`SELECT * FROM admin_pro.compras_por_periodo(CAST(${start} AS DATE), CAST(${end} AS DATE))`,
  facturacion: ({ start, end }) => Prisma.sql`SELECT * FROM admin_pro.facturacion_por_periodo(CAST(${start} AS DATE), CAST(${end} AS DATE))`,
  tecnicos: ({ start, end }) => Prisma.sql`SELECT * FROM admin_pro.rendimiento_tecnicos(CAST(${start} AS DATE), CAST(${end} AS DATE))`,
  ordenes_estado: ({ start, end }) => Prisma.sql`SELECT * FROM admin_pro.ordenes_por_estado(CAST(${start} AS DATE), CAST(${end} AS DATE))`,
  diagnosticos_estado: ({ start, end }) => Prisma.sql`SELECT * FROM admin_pro.diagnosticos_por_estado(CAST(${start} AS DATE), CAST(${end} AS DATE))`,
  equipos_cliente: () => Prisma.sql`SELECT * FROM admin_pro.equipos_por_cliente()`,
  garantias_vencer: ({ dias }) => Prisma.sql`SELECT * FROM admin_pro.garantias_por_vencer(CAST(${dias} AS INT))`,
};
const labels = {
  id_orden: 'Orden', id_diagnostico: 'Diagnóstico', id_equipo: 'Equipo ID', id_usuario: 'Usuario ID',
  id_repuesto: 'Repuesto ID', id_factura: 'Factura', fecha_hora: 'Ingreso',
  presupuesto_estimado: 'Presupuesto estimado', moneda_presupuesto: 'Moneda del presupuesto',
  stock_actual: 'Stock registrado', stock_fisico: 'En bodega', stock_en_taller: 'Entregado sin facturar',
  stock_cuarentena: 'En cuarentena', stock_disponible: 'Stock disponible', stock_reservado: 'Stock reservado',
  ganancia_neta: 'Resultado de reparaciones', estado_del_diagnostico: 'Estado técnico',
};
export const reportColumns = (rows) => Object.keys(rows[0] || {}).map((key) => ({
  accessor: key, header: labels[key] || key.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase()), summarize: false,
}));
const normalize = (rows) => JSON.parse(JSON.stringify(rows, (_, value) => typeof value === 'bigint' ? String(value) : value));
const equipmentName = (e) => [e?.tipo, e?.marca, e?.modelo].filter(Boolean).join(' ') || '-';
const diagnosticRows = (rows) => rows.map((d) => ({
  id_diagnostico: d.id_diagnostico, cliente: d.equipo.cliente.nombre, equipo: equipmentName(d.equipo),
  fecha_hora: d.fecha_hora, tecnico: d.tecnico?.nombre || 'Sin asignar',
  estado_del_diagnostico: d.estado_del_diagnostico, estado_contacto: d.estado_contacto,
  presupuesto_estimado: d.presupuesto_estimado, moneda_presupuesto: d.moneda_presupuesto,
  diagnostico_real: d.diagnostico_real,
}));

export const loadAdminReport = async (tipo, query = {}) => {
  const definition = REPORT_CATALOG.find((item) => item.id === tipo);
  if (!definition) fail(400, 'Reporte no soportado.');
  const range = dateRange(query), settings = await getBusinessSettings();
  const params = { ...range, proveedor: positiveId(query.proveedor_id, 'Proveedor'),
    tecnico: positiveId(query.tecnico_id, 'Técnico'),
    dias: query.dias == null || query.dias === '' ? settings.reglas.garantia_aviso_dias : positiveId(query.dias, 'Días', false) };
  if (params.dias > 365) fail(400, 'El aviso admite como máximo 365 días.');
  let rows;
  if (queries[tipo]) rows = await prisma.$queryRaw(queries[tipo](params));
  else if (['inventario', 'stock_bajo'].includes(tipo)) {
    rows = await prisma.$queryRaw`SELECT r.id_repuesto, r.nombre AS repuesto, cr.nombre_tipo AS categoria,
      p.nombre AS proveedor, r.stock_actual, r.stock_minimo,
      COALESCE(entradas.cantidad, 0)::INT AS cantidad_comprada,
      COALESCE(salidas.cantidad, 0)::INT AS cantidad_usada,
      COALESCE(taller.cantidad, 0)::INT AS stock_en_taller,
      GREATEST(r.stock_actual - COALESCE(taller.cantidad, 0), 0)::INT AS stock_fisico,
      COALESCE(res.cantidad, 0)::INT AS stock_reservado,
      COALESCE(cuarentena.cantidad, 0)::INT AS stock_cuarentena,
      GREATEST(r.stock_actual - COALESCE(taller.cantidad, 0) - COALESCE(res.cantidad, 0) - COALESCE(cuarentena.cantidad, 0), 0)::INT AS stock_disponible,
      r.costo_individual AS ultimo_costo, r.activo
      FROM "Repuestos" r LEFT JOIN "Categorias_Repuestos" cr ON cr.id_tipo_repuesto = r.tipo_repuesto_id
      LEFT JOIN "Proveedores" p ON p.id_proveedor = r.proveedor_id
      LEFT JOIN (SELECT repuesto_id, SUM(cantidad) AS cantidad FROM "Compras" GROUP BY repuesto_id) entradas ON entradas.repuesto_id = r.id_repuesto
      LEFT JOIN (SELECT repuesto_id, SUM(cantidad_usada) AS cantidad FROM "Ordenes_Repuestos" WHERE estado_aprobacion = 'APROBADO' AND estado_entrega = 'ENTREGADO' GROUP BY repuesto_id) salidas ON salidas.repuesto_id = r.id_repuesto
      LEFT JOIN (SELECT rp.repuesto_id, SUM(rp.cantidad_usada) AS cantidad FROM "Ordenes_Repuestos" rp
        WHERE rp.estado_aprobacion = 'APROBADO' AND rp.estado_entrega = 'ENTREGADO'
          AND NOT EXISTS (SELECT 1 FROM "Facturas" f WHERE f.orden_id = rp.orden_id)
        GROUP BY rp.repuesto_id) taller ON taller.repuesto_id = r.id_repuesto
      LEFT JOIN (SELECT repuesto_id, SUM(cantidad_usada) AS cantidad FROM "Ordenes_Repuestos"
        WHERE estado_aprobacion = 'APROBADO' AND estado_entrega = 'PENDIENTE'
          AND orden_id IN (SELECT id_orden FROM "Ordenes" WHERE estado NOT IN ('CANCELADO', 'ENTREGADO'))
        GROUP BY repuesto_id) res
        ON res.repuesto_id = r.id_repuesto
      LEFT JOIN (SELECT repuesto_id, SUM(cantidad) AS cantidad FROM "DevolucionesProveedor"
        WHERE origen = 'BODEGA' AND estado = 'CUARENTENA' GROUP BY repuesto_id) cuarentena ON cuarentena.repuesto_id = r.id_repuesto
      WHERE r.descontinuada = false ORDER BY r.nombre`;
    if (tipo === 'stock_bajo') rows = rows.filter((r) => r.activo && Number(r.stock_disponible) <= Number(r.stock_minimo));
    // Alias conservado para las pantallas anteriores del inventario.
    rows = rows.map((r) => ({ ...r, stock_estimado: r.stock_actual }));
  } else if (tipo === 'equipos') {
    rows = (await prisma.equipos.findMany({ where: { ...(positiveId(query.cliente_id, 'Cliente') ? { cliente_id: Number(query.cliente_id) } : {}) }, include: { cliente: true }, orderBy: { id_equipo: 'desc' } }))
      .map((e) => ({ id_equipo: e.id_equipo, cliente: e.cliente.nombre, tipo: e.tipo, marca: e.marca, modelo: e.modelo, numero_serie: e.numero_serie }));
  } else if (['diagnosticos_detalle', 'historial_equipo'].includes(tipo)) {
    rows = diagnosticRows(await prisma.diagnosticos.findMany({ where: {
      ...(Object.keys(range.where).length ? { fecha_hora: range.where } : {}),
      ...(params.tecnico ? { tecnico_id: params.tecnico } : {}),
      ...(tipo === 'historial_equipo' ? { equipo_id: positiveId(query.equipo_id, 'Equipo', false) } : {}),
    }, include: { equipo: { include: { cliente: true } }, tecnico: true }, orderBy: { fecha_hora: 'desc' } }));
    if (tipo === 'historial_equipo') {
      const orders = await prisma.ordenes.findMany({ where: { diagnostico: { equipo_id: Number(query.equipo_id) },
        ...(Object.keys(range.where).length ? { fecha_ingreso: range.where } : {}) }, include: { tecnico: true, facturas: true }, orderBy: { fecha_ingreso: 'desc' } });
      rows = [...rows.map((r) => ({ evento: 'Diagnóstico', referencia: r.id_diagnostico, fecha: r.fecha_hora, estado: r.estado_del_diagnostico, tecnico: r.tecnico, detalle: r.diagnostico_real || '' })),
        ...orders.map((o) => ({ evento: 'Orden', referencia: o.id_orden, fecha: o.fecha_ingreso, estado: o.estado, tecnico: o.tecnico?.nombre || '-', detalle: `Facturas: ${o.facturas.length}` }))]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }
  } else if (['ordenes_detalle', 'ordenes_atrasadas'].includes(tipo)) {
    const where = { ...(Object.keys(range.where).length ? { fecha_ingreso: range.where } : {}), ...(params.tecnico ? { tecnico_id: params.tecnico } : {}) };
    if (query.estado) {
      if (!ORDEN_ESTADOS.includes(query.estado)) fail(400, 'Estado de orden inválido.');
      where.estado = query.estado;
    }
    if (tipo === 'ordenes_atrasadas') {
      where.estado = { notIn: ['FINALIZADO', 'IRREPARABLE', 'ENTREGADO', 'CANCELADO'] };
      where.fecha_ingreso = { ...where.fecha_ingreso, lt: new Date(Math.min(where.fecha_ingreso?.lt?.getTime() || Infinity, Date.now() - settings.reglas.orden_atrasada_dias * 86400000)) };
    }
    rows = (await prisma.ordenes.findMany({ where, include: { tecnico: true, diagnostico: { include: { equipo: { include: { cliente: true } } } } }, orderBy: { fecha_ingreso: 'desc' } }))
      .map((o) => ({ id_orden: o.id_orden, cliente: o.diagnostico.equipo.cliente.nombre, equipo: equipmentName(o.diagnostico.equipo), estado: o.estado,
        tecnico: o.tecnico?.nombre || 'Sin asignar', prioridad: o.prioridad, fecha_ingreso: o.fecha_ingreso, monto_autorizado: o.monto_autorizado,
        dias_en_taller: Math.floor((Date.now() - new Date(o.fecha_ingreso).getTime()) / 86400000) }));
  } else if (['repuestos_orden', 'historial_repuesto'].includes(tipo)) {
    const where = tipo === 'repuestos_orden' ? { orden_id: positiveId(query.orden_id, 'Orden', false) }
      : { repuesto_id: positiveId(query.repuesto_id, 'Repuesto', false), estado_aprobacion: 'APROBADO', estado_entrega: 'ENTREGADO', ...(Object.keys(range.where).length ? { fecha_entrega: range.where } : {}) };
    rows = (await prisma.ordenes_Repuestos.findMany({ where, include: { repuesto: true }, orderBy: { id_detalle_repuesto: 'desc' } }))
      .map((r) => ({ id_orden: r.orden_id, repuesto: r.repuesto?.nombre || r.pieza_solicitada, cantidad: r.cantidad_usada,
        estado_aprobacion: r.estado_aprobacion, estado_entrega: r.estado_entrega, fecha_entrega: r.fecha_entrega, precio_facturado: r.precio_unitario_facturado }));
  } else if (tipo === 'garantias') {
    const now = new Date();
    const status = query.estado || '';
    if (!['', 'VIGENTE', 'VENCIDA', 'SIN_INICIO'].includes(status)) fail(400, 'Estado de garantía inválido.');
    const where = status === 'VIGENTE' ? { fecha_vencimiento: { gte: now } } : status === 'VENCIDA' ? { fecha_vencimiento: { lt: now } } : status === 'SIN_INICIO' ? { fecha_inicio: null } : {};
    rows = (await prisma.garantias.findMany({ where, include: { factura: { include: { orden: { include: { diagnostico: { include: { equipo: { include: { cliente: true } } } } } } } } }, orderBy: { id_garantia: 'desc' } }))
      .map((g) => ({ id_garantia: g.id_garantia, id_factura: g.factura_id, cliente: g.factura.orden.diagnostico.equipo.cliente.nombre,
        equipo: equipmentName(g.factura.orden.diagnostico.equipo), duracion_meses: g.duracion_meses, fecha_inicio: g.fecha_inicio, fecha_vencimiento: g.fecha_vencimiento,
        estado: !g.fecha_inicio ? 'SIN_INICIO' : g.fecha_vencimiento < now ? 'VENCIDA' : 'VIGENTE', condiciones: g.condiciones }));
  } else if (tipo.startsWith('productividad_')) {
    const year = positiveId(query.year || new Date().getFullYear(), 'Año', false);
    if (year < 2000 || year > new Date().getFullYear() + 1) fail(400, 'Año fuera de rango.');
    rows = tipo === 'productividad_mensual'
      ? await prisma.$queryRaw`SELECT * FROM admin_pro.productividad_mensual(CAST(${year} AS INT))`
      : await prisma.$queryRaw`SELECT * FROM admin_pro.productividad_anual(CAST(${year} AS INT), 4)`;
  } else if (tipo === 'actividad_financiera') {
    const dateWhere = (field) => Object.keys(range.where).length ? { [field]: range.where } : {};
    const [invoices, purchases, movements] = await Promise.all([
      prisma.facturas.findMany({ where: dateWhere('fecha_emision'), select: {
        id_factura: true, fecha_emision: true, total: true, metodo_pago: true,
        orden: { select: { diagnostico: { select: { equipo: { select: { cliente: { select: { nombre: true } } } } } } } },
        diagnostico: { select: { equipo: { select: { cliente: { select: { nombre: true } } } } } },
        movimientos_contables: { where: { tipo: 'COBRO', motivo: 'Cobro registrado al emitir la factura' }, select: { id_movimiento: true }, take: 1 },
      }, orderBy: { fecha_emision: 'desc' }, take: 10001 }),
      prisma.compras.findMany({ where: dateWhere('fecha_obtencion'), select: {
        id_compra: true, fecha_obtencion: true, cantidad: true, costo_unitario: true, metodo_pago: true,
        repuesto: { select: { nombre: true } }, proveedor: { select: { nombre: true } },
      }, orderBy: { fecha_obtencion: 'desc' }, take: 10001 }),
      prisma.movimientosContables.findMany({ where: dateWhere('fecha_registro'), select: {
        id_movimiento: true, fecha_registro: true, tipo: true, monto: true, metodo: true, factura_id: true, reclamo_id: true, motivo: true,
      }, orderBy: { fecha_registro: 'desc' }, take: 10001 }),
    ]);
    const paidMethods = new Set(['Efectivo', 'Transferencia', 'Tarjeta']);
    const event = (fecha, origen, referencia, detalle, contraparte, metodo, importe, caja, estado) => ({
      fecha, origen, referencia, detalle, contraparte, metodo: metodo || '',
      importe_documentado: Math.round(Number(importe || 0) * 100) / 100,
      efecto_caja: Math.round(Number(caja || 0) * 100) / 100, estado,
    });
    rows = [
      ...invoices.map((f) => {
        const amount = Number(f.total || 0);
        const historicalPayment = paidMethods.has(f.metodo_pago) && !f.movimientos_contables.length;
        return event(f.fecha_emision, 'Factura', `#${f.id_factura}`, 'Servicio o diagnóstico facturado',
          f.orden?.diagnostico?.equipo?.cliente?.nombre || f.diagnostico?.equipo?.cliente?.nombre || '',
          f.metodo_pago, amount, historicalPayment ? amount : 0,
          historicalPayment ? 'Cobro histórico inferido' : f.metodo_pago === 'Pendiente' ? 'Pendiente de cobro' : 'Documento emitido');
      }),
      ...purchases.map((c) => {
        const amount = Number(c.cantidad || 0) * Number(c.costo_unitario || 0);
        const paid = paidMethods.has(c.metodo_pago);
        return event(c.fecha_obtencion, 'Compra', `#${c.id_compra}`, c.repuesto?.nombre || 'Repuesto',
          c.proveedor?.nombre || '', c.metodo_pago, amount, paid ? -amount : 0,
          paid ? 'Pagada según método registrado' : 'Pago no confirmado');
      }),
      ...movements.map((m) => event(m.fecha_registro, m.tipo.replaceAll('_', ' '), `#${m.id_movimiento}`,
        m.motivo, m.factura_id ? `Factura #${m.factura_id}` : m.reclamo_id ? `Reclamo #${m.reclamo_id}` : '',
        m.metodo, 0, ['COBRO', 'OTRO_INGRESO'].includes(m.tipo) ? Number(m.monto) : -Number(m.monto), 'Dinero registrado')),
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  } else if (tipo === 'movimientos_contables') {
    rows = (await prisma.movimientosContables.findMany({ where: Object.keys(range.where).length ? { fecha_registro: range.where } : {},
      include: { factura: { include: { orden: { include: { diagnostico: { include: { equipo: { include: { cliente: true } } } } } } } }, usuario: { select: { nombre_persona: true, nombre_usuario: true } } },
      orderBy: { fecha_registro: 'desc' }, take: 10001 })).map((m) => ({ fecha: m.fecha_registro, tipo: m.tipo,
      monto: m.monto, metodo: m.metodo, factura: m.factura_id, reclamo: m.reclamo_id,
      cliente: m.factura?.orden?.diagnostico?.equipo?.cliente?.nombre || '', referencia: m.referencia,
      motivo: m.motivo, registrado_por: m.usuario.nombre_persona || m.usuario.nombre_usuario }));
  } else if (tipo === 'devoluciones_proveedor') {
    rows = (await prisma.devolucionesProveedor.findMany({ where: Object.keys(range.where).length ? { fecha_registro: range.where } : {},
      include: { repuesto: { select: { nombre: true } }, compra: { include: { proveedor: { select: { nombre: true } } } }, usuario: { select: { nombre_persona: true, nombre_usuario: true } } },
      orderBy: { fecha_registro: 'desc' }, take: 10001 })).map((d) => ({ fecha: d.fecha_registro, pieza: d.repuesto.nombre,
      cantidad: d.cantidad, origen: d.origen, estado: d.estado, compra: d.compra_id, proveedor: d.compra.proveedor?.nombre,
      reclamo: d.reclamo_id, motivo: d.motivo, devuelto_el: d.fecha_devolucion, registrado_por: d.usuario.nombre_persona || d.usuario.nombre_usuario }));
  } else if (tipo === 'calidad_diagnosticos') {
    rows = (await prisma.diagnosticos.findMany({ where: { OR: [{ estado_del_diagnostico: { in: ['COMPLETADO', 'DIAGNOSTICADO'] } }, { calidad_estado: 'RECHAZADO' }],
      ...(Object.keys(range.where).length ? { fecha_hora: range.where } : {}) },
      include: { equipo: { include: { cliente: true } }, tecnico: true }, orderBy: { fecha_hora: 'desc' }, take: 10001 }))
      .map((d) => ({ diagnostico: d.id_diagnostico, ingreso: d.fecha_hora, cliente: d.equipo.cliente.nombre,
        equipo: equipmentName(d.equipo), tecnico: d.tecnico?.nombre, estado_calidad: d.calidad_estado, informe: d.diagnostico_real }));
  } else if (tipo === 'calidad_ordenes') {
    rows = (await prisma.ordenes.findMany({ where: { OR: [{ estado: { in: ['FINALIZADO', 'ENTREGADO'] } }, { calidad_estado: 'RECHAZADO' }],
      ...(Object.keys(range.where).length ? { fecha_ingreso: range.where } : {}) },
      include: { tecnico: true, diagnostico: { include: { equipo: { include: { cliente: true } } } }, revisiones_calidad: { orderBy: { fecha_revision: 'desc' }, take: 1 } },
      orderBy: { fecha_ingreso: 'desc' }, take: 10001 })).map((o) => ({ orden: o.id_orden, ingreso: o.fecha_ingreso,
        cliente: o.diagnostico.equipo.cliente.nombre, equipo: equipmentName(o.diagnostico.equipo),
        tecnico: o.tecnico?.nombre, estado_calidad: o.calidad_estado, ultima_revision: o.revisiones_calidad[0]?.fecha_revision,
        observacion: o.calidad_observacion, garantia: o.es_garantia }));
  } else if (tipo === 'reclamos') {
    rows = (await prisma.reclamos.findMany({ where: Object.keys(range.where).length ? { fecha_apertura: range.where } : {},
      include: { orden_original: { include: { diagnostico: { include: { equipo: { include: { cliente: true } } } } } }, compra: { include: { proveedor: true } } },
      orderBy: { fecha_apertura: 'desc' }, take: 10001 })).map((c) => ({ reclamo: c.id_reclamo, apertura: c.fecha_apertura,
        orden_original: c.orden_original_id, cliente: c.orden_original.diagnostico.equipo.cliente.nombre,
        equipo: equipmentName(c.orden_original.diagnostico.equipo), estado: c.estado, responsable: c.responsable_tipo,
        cobertura: c.cobertura, proveedor: c.compra?.proveedor?.nombre, costo_estimado: c.costo_estimado,
        orden_reingreso: c.orden_reingreso_id, resolucion: c.resolucion }));
  } else if (tipo === 'usuarios') {
    rows = await prisma.usuarios.findMany({ select: { id_usuario: true, nombre_usuario: true, nombre_persona: true, correo_electronico: true, rol: true, activo: true, fecha_creacion: true }, orderBy: { id_usuario: 'asc' } });
  } else if (tipo === 'auditoria') {
    const count = await prisma.auditoria_Movimientos.count({ where: Object.keys(range.where).length ? { fecha_movimiento: range.where } : {} });
    if (count > 10000) fail(400, 'Hay más de 10 000 movimientos. Seleccione un período menor.');
    rows = (await prisma.auditoria_Movimientos.findMany({ where: Object.keys(range.where).length ? { fecha_movimiento: range.where } : {}, orderBy: { fecha_movimiento: 'desc' } }))
      .map((a) => ({ id_auditoria: String(a.id_auditoria), fecha_movimiento: a.fecha_movimiento, tabla: a.tabla, operacion: a.operacion,
        usuario: a.usuario_nombre || 'Sistema', observacion: a.observacion,
        datos_anteriores: JSON.stringify(redactAuditData(a.datos_anteriores)), datos_nuevos: JSON.stringify(redactAuditData(a.datos_nuevos)) }));
  } else if (tipo === 'respaldos') {
    rows = (await getBackupJobs()).filter((j) => (!range.start || new Date(j.inicio) >= range.where.gte) && (!range.end || new Date(j.inicio) < range.where.lt))
      .map((j) => ({ referencia: j.id, inicio: j.inicio, fin: j.fin, estado: j.estado, origen: j.origen, usuario: j.usuario,
        archivos: j.archivos.length, bytes: j.archivos.reduce((sum, f) => sum + f.bytes, 0), integridad: j.integridad?.resultado || 'PENDIENTE', advertencias: j.advertencias.join(' ') }));
  } else {
    const financial = await getGananciasData({ ...query, detalle_limite: 10001, fuentes_limite: 10001 });
    query = { ...query, fecha_inicio: financial.fechaInicio, fecha_fin: financial.fechaFin };
    const bindings = { ganancias_resumen: [financial.totals], ganancias_mensuales: financial.periods.mensual,
      ganancias_semanales: financial.periods.semanal, ganancias_anuales: financial.periods.anual,
      ganancias_fuentes: financial.gananciasFuentes, perdidas_fuentes: financial.perdidasFuentes,
      margen_orden: financial.orderMargins, costos_perdidas: financial.perdidas, rentabilidad: financial.rentabilidad, activos: [financial.activos] };
    rows = bindings[tipo] || [];
    if (rows.length > 10000) fail(400, 'Seleccione un período menor para obtener el detalle completo.');
  }
  rows = normalize(rows);
  if (query.buscar) {
    const text = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const search = text(query.buscar).trim().slice(0, 100);
    rows = rows.filter((row) => Object.values(row).some((v) => text(v).includes(search)));
  }
  if (rows.length > 10000) fail(400, 'Hay más de 10 000 registros. Acote los filtros para generar el reporte completo.');
  const roundMoney = (value) => Math.round(value * 100) / 100;
  const resumenFinanciero = tipo === 'actividad_financiera' ? {
    facturado: roundMoney(rows.filter((row) => row.origen === 'Factura').reduce((sum, row) => sum + Number(row.importe_documentado || 0), 0)),
    compras_registradas: roundMoney(rows.filter((row) => row.origen === 'Compra').reduce((sum, row) => sum + Number(row.importe_documentado || 0), 0)),
    entradas_caja: roundMoney(rows.reduce((sum, row) => sum + Math.max(0, Number(row.efecto_caja || 0)), 0)),
    salidas_caja: roundMoney(rows.reduce((sum, row) => sum + Math.max(0, -Number(row.efecto_caja || 0)), 0)),
  } : undefined;
  if (resumenFinanciero) resumenFinanciero.neto_caja = roundMoney(resumenFinanciero.entradas_caja - resumenFinanciero.salidas_caja);
  return { data: rows, columns: reportColumns(rows), reporte: definition, filtros: query,
    generado_en: new Date().toISOString(), total: rows.length,
    ...(resumenFinanciero ? { resumen_financiero: resumenFinanciero } : {}),
    nota: tipo === 'actividad_financiera' ? 'Importe documentado y efecto de caja son columnas distintas: no deben sumarse entre sí. Las compras con método de pago se consideran pagadas; las antiguas sin método no afectan la caja. Los cobros de facturas actuales aparecen como movimientos y los históricos pagados se infieren de la factura.'
      : tipo === 'movimientos_contables' ? 'Entradas y salidas de dinero registradas; las compras pagadas se consultan en Actividad financiera.'
      : definition.categoria === 'Finanzas' ? 'Importes en córdobas. El resultado de reparaciones usa los costos registrados; no incluye gastos operativos que no estén registrados en el sistema.' : '' };
};
