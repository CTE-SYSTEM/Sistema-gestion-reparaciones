import prisma from '../../app/prismaClient.js';
import { getBusinessSettings } from '../../services/adminSettingsService.js';

export const getMonitoreoGeneral = async (req, res) => {
  try {
    const [equipos, repuestos, ordenes, facturas, usuarios] = await Promise.all([
      prisma.equipos.count(),
      prisma.repuestos.count(),
      prisma.ordenes.count(),
      prisma.facturas.count(),
      prisma.usuarios.count(),
    ]);
    res.json({ data: { equipos, repuestos, ordenes, facturas, usuarios } });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener monitoreo general', details: error.message });
  }
};

export const getDashboardResumen = async (req, res) => {
  try {
    const hoy = new Date();
    const limitePorVencer = new Date(hoy);
    const garantiaAvisoDias = (await getBusinessSettings()).reglas.garantia_aviso_dias;
    limitePorVencer.setDate(limitePorVencer.getDate() + garantiaAvisoDias);

    const countsPromise = Promise.all([
      prisma.equipos.count(),
      prisma.repuestos.count(),
      prisma.ordenes.count(),
      prisma.facturas.count(),
      prisma.usuarios.count(),
      prisma.diagnosticos.count({ where: { estado_del_diagnostico: 'PENDIENTE' } }),
      prisma.ordenes.count({ where: { estado: 'EN_REPARACION' } }),
    ]);

    const latestOrdersPromise = prisma.ordenes.findMany({
      take: 5,
      orderBy: { fecha_ingreso: 'desc' },
      include: {
        diagnostico: {
          include: {
            equipo: { include: { cliente: true } },
          },
        },
        tecnico: true,
        facturas: true,
      },
    });

    const upcomingGarantiasPromise = prisma.garantias.findMany({
      where: { fecha_vencimiento: { gte: hoy, lte: limitePorVencer } },
      include: {
        factura: {
          include: {
            orden: {
              include: {
                diagnostico: {
                  include: {
                    equipo: { include: { cliente: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { fecha_vencimiento: 'asc' },
      take: 5,
    });

    const [
      [equipos, repuestos, ordenes, facturas, usuarios, diagnosticosPendientes, ordenesEnReparacion],
      latestOrders,
      upcomingGarantias,
    ] = await Promise.all([countsPromise, latestOrdersPromise, upcomingGarantiasPromise]);

    res.json({
      data: {
        garantiaAvisoDias,
        totals: {
          equipos,
          repuestos,
          ordenes,
          facturas,
          usuarios,
          diagnosticosPendientes,
          ordenesEnReparacion,
        },
        latestOrders: latestOrders.map((orden) => ({
          id_orden: orden.id_orden,
          estado: orden.estado || 'N/A',
          cliente: orden.diagnostico?.equipo?.cliente?.nombre || '-',
          equipo: orden.diagnostico?.equipo?.modelo || '-',
          prioridad: orden.prioridad || '-',
          tecnico: orden.tecnico?.nombre || 'Sin asignar',
          facturas: orden.facturas?.length || 0,
          fecha_ingreso: orden.fecha_ingreso ? new Date(orden.fecha_ingreso).toLocaleDateString() : '-',
        })),
        upcomingGarantias: upcomingGarantias.map((garantia) => ({
          id_garantia: garantia.id_garantia,
          factura_id: garantia.factura_id,
          orden_id: garantia.factura?.orden?.id_orden || '-',
          cliente: garantia.factura?.orden?.diagnostico?.equipo?.cliente?.nombre || '-',
          equipo: garantia.factura?.orden?.diagnostico?.equipo?.modelo || '-',
          fecha_vencimiento: garantia.fecha_vencimiento ? new Date(garantia.fecha_vencimiento).toLocaleDateString() : '-',
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el resumen del dashboard', details: error.message });
  }
};
