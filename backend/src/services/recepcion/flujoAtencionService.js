import prisma from '../../app/prismaClient.js';
import { Prisma } from '@prisma/client';
import { parsePagination } from '../../utils/pagination.js';

const upper = (value) => String(value || '').toUpperCase();

const FILTROS = new Set(['todos', 'pendientes', 'en-revision', 'listos-orden', 'en-reparacion', 'listos-facturar', 'entregados', 'con-garantia']);

const flujoBase = (search) => Prisma.sql`
  WITH flujo AS (
    SELECT e.id_equipo,
      CASE
        WHEN g.id_garantia IS NOT NULL THEN 'con-garantia'
        WHEN f.id_factura IS NOT NULL THEN 'entregados'
        WHEN o.id_orden IS NOT NULL AND UPPER(o.estado) IN ('FINALIZADO', 'IRREPARABLE') THEN 'listos-facturar'
        WHEN o.id_orden IS NOT NULL THEN 'en-reparacion'
        WHEN UPPER(d.estado_del_diagnostico) IN ('COMPLETADO', 'DIAGNOSTICADO') THEN 'listos-orden'
        WHEN UPPER(d.estado_del_diagnostico) IN ('PENDIENTE', 'INGRESADO', 'EN_REVISION') THEN 'en-revision'
        ELSE 'pendientes'
      END AS filtro
    FROM "Equipos" e
    JOIN "Clientes" c ON c.id_cliente = e.cliente_id
    LEFT JOIN LATERAL (
      SELECT id_diagnostico, estado_del_diagnostico, falla_reportada
      FROM "Diagnosticos" WHERE equipo_id = e.id_equipo
      ORDER BY id_diagnostico DESC LIMIT 1
    ) d ON TRUE
    LEFT JOIN LATERAL (
      SELECT id_orden, estado FROM "Ordenes" WHERE diagnostico_id = d.id_diagnostico
      ORDER BY id_orden DESC LIMIT 1
    ) o ON TRUE
    LEFT JOIN "Facturas" f ON f.orden_id = o.id_orden
    LEFT JOIN "Garantias" g ON g.factura_id = f.id_factura
    WHERE ${search} = ''
      OR POSITION(${search} IN LOWER(COALESCE(c.nombre, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(c.telefono, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(e.marca, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(e.modelo, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(e.tipo, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(e.numero_serie, ''))) > 0
      OR POSITION(${search} IN LOWER(COALESCE(d.falla_reportada, ''))) > 0
      OR POSITION(${search} IN COALESCE(o.id_orden::text, '')) > 0
      OR POSITION(${search} IN COALESCE(f.id_factura::text, '')) > 0
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

export const obtenerFlujoAtencion = async ({ filtro = 'todos', search = '', page, pageSize } = {}) => {
  if (!FILTROS.has(filtro)) throw Object.assign(new Error('Filtro de flujo inválido'), { statusCode: 400 });
  const pagination = parsePagination({ page, pageSize }, 50);
  const base = flujoBase(String(search || '').trim().toLowerCase().slice(0, 200));
  const [pageRows, countRows] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`${base}
      SELECT id_equipo, filtro FROM flujo
      WHERE ${filtro} = 'todos' OR filtro = ${filtro}
      ORDER BY id_equipo DESC LIMIT ${pagination.pageSize + 1} OFFSET ${pagination.offset}`),
    pagination.page === 1
      ? prisma.$queryRaw(Prisma.sql`${base} SELECT filtro, COUNT(*)::int AS total FROM flujo GROUP BY filtro`)
      : Promise.resolve(null),
  ]);
  const hasMore = pageRows.length > pagination.pageSize;
  const visibleRows = pageRows.slice(0, pagination.pageSize);
  const ids = visibleRows.map((row) => row.id_equipo);
  const equipos = ids.length ? await prisma.equipos.findMany({
    where: { id_equipo: { in: ids } },
    select: {
      id_equipo: true, tipo: true, marca: true, modelo: true, numero_serie: true,
      cliente: { select: { id_cliente: true, nombre: true, telefono: true } },
      diagnosticos: {
        orderBy: { id_diagnostico: 'desc' }, take: 1,
        select: {
          id_diagnostico: true, estado_del_diagnostico: true, Estado_aprobacion: true,
          falla_reportada: true, diagnostico_real: true, prioridad: true, fecha_hora: true,
          tecnico: { select: { id_tecnico: true, nombre: true } },
          ordenes: {
            orderBy: { id_orden: 'desc' }, take: 1,
            select: {
              id_orden: true, estado: true, prioridad: true, fecha_ingreso: true,
              tecnico: { select: { id_tecnico: true, nombre: true } },
              repuestos_usados: { select: { estado_aprobacion: true } },
              facturas: { take: 1, select: {
                id_factura: true, fecha_emision: true, total: true, metodo_pago: true,
                garantias: { take: 1, select: { id_garantia: true, fecha_inicio: true, fecha_vencimiento: true, duracion_meses: true } },
              } },
            },
          },
        },
      },
    },
  }) : [];
  const byId = new Map(equipos.map((equipo) => [equipo.id_equipo, equipo]));
  const items = visibleRows.map((row) => {
    const equipo = byId.get(row.id_equipo);
    if (!equipo) return null;
    const diagnostico = equipo.diagnosticos?.[0] || null;
    const ordenData = mapOrden(diagnostico?.ordenes?.[0]);
    return {
      id: `equipo-${equipo.id_equipo}`,
      filtro: row.filtro,
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

export default {
  obtenerFlujoAtencion,
};
