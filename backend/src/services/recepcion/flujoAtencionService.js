import prisma from '../../app/prismaClient.js';
import { Prisma } from '@prisma/client';
import { parsePagination } from '../../utils/pagination.js';

const upper = (value) => String(value || '').toUpperCase();

const FILTROS = new Set(['todos', 'pendientes', 'en-revision', 'listos-orden', 'en-reparacion', 'listos-facturar', 'listos-entrega', 'entregados', 'con-garantia']);

const flujoBase = (search, customerOnly) => Prisma.sql`
  WITH flujo AS (
    SELECT e.id_equipo, d.id_diagnostico, o.id_orden,
      COALESCE(o.fecha_ingreso, d.fecha_hora) AS fecha_atencion,
      CASE
        WHEN g.id_garantia IS NOT NULL THEN 'con-garantia'
        WHEN UPPER(COALESCE(o.estado, '')) = 'ENTREGADO' OR o.fecha_entrega IS NOT NULL THEN 'entregados'
        WHEN f.id_factura IS NOT NULL THEN 'listos-entrega'
        WHEN o.id_orden IS NOT NULL AND UPPER(o.estado) IN ('FINALIZADO', 'IRREPARABLE') THEN 'listos-facturar'
        WHEN o.id_orden IS NOT NULL THEN 'en-reparacion'
        WHEN UPPER(d.estado_del_diagnostico) IN ('COMPLETADO', 'DIAGNOSTICADO') THEN 'listos-orden'
        WHEN UPPER(d.estado_del_diagnostico) IN ('PENDIENTE', 'INGRESADO', 'EN_REVISION') THEN 'en-revision'
        ELSE 'pendientes'
      END AS filtro
    FROM "Equipos" e
    JOIN "Clientes" c ON c.id_cliente = e.cliente_id
    LEFT JOIN "Diagnosticos" d ON d.equipo_id = e.id_equipo
    LEFT JOIN "Ordenes" o ON o.diagnostico_id = d.id_diagnostico
    LEFT JOIN LATERAL (
      SELECT id_factura FROM "Facturas" WHERE orden_id = o.id_orden
      ORDER BY id_factura DESC LIMIT 1
    ) f ON TRUE
    LEFT JOIN LATERAL (
      SELECT id_garantia FROM "Garantias" WHERE factura_id = f.id_factura
      ORDER BY id_garantia DESC LIMIT 1
    ) g ON TRUE
    WHERE (${search} = ''
      OR POSITION(${search} IN LOWER(COALESCE(c.nombre, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(c.telefono, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(e.marca, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(e.modelo, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(e.tipo, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(e.numero_serie, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(d.falla_reportada, ''))) > 0
      OR POSITION(${search} IN COALESCE(d.id_diagnostico::text, '')) > 0
      OR POSITION(${search} IN COALESCE(o.id_orden::text, '')) > 0
      OR POSITION(${search} IN COALESCE(f.id_factura::text, '')) > 0)
      AND (${customerOnly} = false OR d.calidad_estado = 'APROBADO' OR (d.origen_directo = true AND o.id_orden IS NOT NULL))
  )
`;

const mapOrden = (orden) => {
  if (!orden) return null;

  const repuestos = orden.repuestos_usados || [];
  const repuestosPendientes = repuestos.filter(
    (detalle) => upper(detalle.estado_aprobacion) === 'PENDIENTE'
  ).length;
  const repuestosAprobados = repuestos.filter(
    (detalle) => upper(detalle.estado_aprobacion) === 'APROBADO'
  ).length;
  const factura = orden.facturas?.[0] || null;
  const garantia = factura?.garantias?.[0] || null;

  return {
    orden: {
      id_orden: orden.id_orden,
      estado: orden.estado || 'PENDIENTE',
      prioridad: orden.prioridad,
      fecha_ingreso: orden.fecha_ingreso,
      tecnico: orden.tecnico,
    },
    repuestos: {
      total: repuestos.length,
      pendientes: repuestosPendientes,
      aprobados: repuestosAprobados,
    },
    factura: factura
      ? {
          id_factura: factura.id_factura,
          fecha_emision: factura.fecha_emision,
          total: factura.total,
          metodo_pago: factura.metodo_pago,
        }
      : null,
    garantia: garantia
      ? {
          id_garantia: garantia.id_garantia,
          fecha_inicio: garantia.fecha_inicio,
          fecha_vencimiento: garantia.fecha_vencimiento,
          duracion_meses: garantia.duracion_meses,
        }
      : null,
  };
};

export const obtenerFlujoAtencion = async ({ filtro = 'todos', search = '', page, pageSize, customerOnly = false } = {}) => {
  if (!FILTROS.has(filtro)) throw Object.assign(new Error('Filtro de flujo inválido'), { statusCode: 400 });
  const pagination = parsePagination({ page, pageSize }, 20);
  const base = flujoBase(String(search || '').trim().toLowerCase().slice(0, 200), customerOnly);
  const [pageRows, countRows] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`${base}
      SELECT id_equipo, id_diagnostico, id_orden, fecha_atencion, filtro FROM flujo
      WHERE ${filtro} = 'todos' OR filtro = ${filtro}
      ORDER BY fecha_atencion DESC NULLS LAST, id_orden DESC NULLS LAST,
        id_diagnostico DESC NULLS LAST, id_equipo DESC
      LIMIT ${pagination.pageSize + 1} OFFSET ${pagination.offset}`),
    pagination.page === 1
      ? prisma.$queryRaw(Prisma.sql`${base} SELECT filtro, COUNT(*)::int AS total FROM flujo GROUP BY filtro`)
      : Promise.resolve(null),
  ]);
  const hasMore = pageRows.length > pagination.pageSize;
  const visibleRows = pageRows.slice(0, pagination.pageSize);
  const equipoIds = [...new Set(visibleRows.map((row) => row.id_equipo))];
  const diagnosticoIds = [...new Set(visibleRows.map((row) => row.id_diagnostico).filter(Boolean))];
  const ordenIds = [...new Set(visibleRows.map((row) => row.id_orden).filter(Boolean))];
  const [equipos, diagnosticos, ordenes] = await Promise.all([
    prisma.equipos.findMany({ where: { id_equipo: { in: equipoIds } }, select: {
      id_equipo: true, tipo: true, marca: true, modelo: true, numero_serie: true,
      cliente: { select: { id_cliente: true, nombre: true, telefono: true } },
    } }),
    prisma.diagnosticos.findMany({ where: { id_diagnostico: { in: diagnosticoIds } }, select: {
      id_diagnostico: true, estado_del_diagnostico: true, Estado_aprobacion: true,
      falla_reportada: true, diagnostico_real: true, prioridad: true, fecha_hora: true,
      tecnico: { select: { id_tecnico: true, nombre: true } },
    } }),
    prisma.ordenes.findMany({ where: { id_orden: { in: ordenIds } }, select: {
      id_orden: true, estado: true, prioridad: true, fecha_ingreso: true,
      tecnico: { select: { id_tecnico: true, nombre: true } },
      repuestos_usados: { select: { estado_aprobacion: true } },
      facturas: { orderBy: { id_factura: 'desc' }, take: 1, select: {
        id_factura: true, fecha_emision: true, total: true, metodo_pago: true,
        garantias: { orderBy: { id_garantia: 'desc' }, take: 1, select: { id_garantia: true, fecha_inicio: true, fecha_vencimiento: true, duracion_meses: true } },
      } },
    } }),
  ]);
  const equiposById = new Map(equipos.map((equipo) => [equipo.id_equipo, equipo]));
  const diagnosticosById = new Map(diagnosticos.map((diagnostico) => [diagnostico.id_diagnostico, diagnostico]));
  const ordenesById = new Map(ordenes.map((orden) => [orden.id_orden, orden]));
  const items = visibleRows.map((row) => {
    const equipo = equiposById.get(row.id_equipo);
    if (!equipo) return null;
    const diagnostico = diagnosticosById.get(row.id_diagnostico) || null;
    const ordenData = mapOrden(ordenesById.get(row.id_orden));
    return {
      id: row.id_orden ? `orden-${row.id_orden}` : row.id_diagnostico ? `diagnostico-${row.id_diagnostico}` : `equipo-${equipo.id_equipo}`,
      filtro: row.filtro,
      fecha_atencion: row.fecha_atencion,
      cliente: equipo.cliente || null,
      equipo,
      diagnostico: diagnostico ? {
        id_diagnostico: diagnostico.id_diagnostico,
        estado: diagnostico.estado_del_diagnostico,
        aprobacion: diagnostico.Estado_aprobacion,
        falla_reportada: diagnostico.falla_reportada,
        diagnostico_real: diagnostico.diagnostico_real,
        prioridad: diagnostico.prioridad,
        fecha_hora: diagnostico.fecha_hora,
        tecnico: diagnostico.tecnico,
      } : null,
      orden: ordenData?.orden || null,
      repuestos: ordenData?.repuestos || { total: 0, pendientes: 0, aprobados: 0 },
      factura: ordenData?.factura || null,
      garantia: ordenData?.garantia || null,
    };
  }).filter(Boolean);
  const resumen = countRows?.reduce((acc, row) => {
    acc[row.filtro] = Number(row.total);
    acc.todos += Number(row.total);
    return acc;
  }, { todos: 0 }) || null;
  return { data: items, meta: { page: pagination.page, pageSize: pagination.pageSize, hasMore, total: resumen?.[filtro === 'todos' ? 'todos' : filtro] ?? null, resumen } };
};

const startOfManaguaDay = (year, month, day) => new Date(Date.UTC(year, month - 1, day, 6));

export const obtenerResumenRecepcion = async () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Managua', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const { year, month, day } = parts;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const weekStart = startOfManaguaDay(year, month, day - ((weekday + 6) % 7));
  const monthStart = startOfManaguaDay(year, month, 1);
  const yearStart = startOfManaguaDay(year, 1, 1);
  const [semana, mes, ano, total] = await Promise.all([
    prisma.diagnosticos.count({ where: { fecha_hora: { gte: weekStart } } }),
    prisma.diagnosticos.count({ where: { fecha_hora: { gte: monthStart } } }),
    prisma.diagnosticos.count({ where: { fecha_hora: { gte: yearStart } } }),
    prisma.diagnosticos.count(),
  ]);
  return { semana, mes, ano, total };
};

export default {
  obtenerFlujoAtencion,
  obtenerResumenRecepcion,
};
