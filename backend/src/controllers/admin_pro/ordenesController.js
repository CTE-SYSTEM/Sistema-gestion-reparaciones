import prisma from '../../app/prismaClient.js';
import { createAdminExcel } from '../../utils/adminExcel.js';
import { ORDEN_ESTADOS, RESULTADOS_ORDEN, assertInList, parsePositiveId } from '../../utils/domainValidation.js';

// 3. Monitoreo de órdenes y facturas
export const getOrdenesAvanzado = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const where = {};
    if (fecha_inicio || fecha_fin) {
      where.fecha_ingreso = {};
      if (fecha_inicio) where.fecha_ingreso.gte = new Date(`${fecha_inicio}T00:00:00`);
      if (fecha_fin) where.fecha_ingreso.lte = new Date(`${fecha_fin}T23:59:59`);
    }

    const ordenes = await prisma.ordenes.findMany({
      where,
      include: {
        diagnostico: {
          include: {
            equipo: { include: { cliente: true } }
          }
        },
        tecnico: true,
        repuestos_usados: true,
        facturas: true
      }
    });
    res.json({ data: ordenes });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener órdenes avanzadas', details: error.message });
  }
};
export const updateOrdenAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, tecnico_id, resultado_final, observacion_final } = req.body;

    const data = {};
    if (estado !== undefined) data.estado = assertInList(String(estado).toUpperCase(), ORDEN_ESTADOS, 'Estado de la orden');
    if (tecnico_id !== undefined) {
      const tecnicoId = tecnico_id === null || tecnico_id === '' ? null : parsePositiveId(tecnico_id);
      if (tecnico_id !== null && tecnico_id !== '' && !tecnicoId) {
        return res.status(400).json({ error: 'ID de técnico inválido' });
      }
      data.tecnico_id = tecnicoId;
    }
    if (resultado_final !== undefined) data.resultado_final = assertInList(String(resultado_final).toUpperCase(), RESULTADOS_ORDEN, 'Resultado final');
    if (observacion_final !== undefined) data.observacion_final = String(observacion_final).trim() || null;
    if (data.estado === 'FINALIZADO') {
      data.fecha_cierre = new Date();
      data.calidad_estado = 'PENDIENTE';
      data.calidad_observacion = null;
      data.calidad_revisada_en = null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }

    const ordenId = parsePositiveId(id);
    if (!ordenId) return res.status(400).json({ error: 'ID de orden inválido' });
    if (Object.prototype.hasOwnProperty.call(data, 'tecnico_id') && data.tecnico_id) {
      const tecnico = await prisma.tecnicos.findFirst({ where: { id_tecnico: data.tecnico_id, activo: true } });
      if (!tecnico) return res.status(400).json({ error: 'El técnico no existe o está inactivo' });
    }
    const orden = await prisma.ordenes.update({
      where: { id_orden: ordenId },
      data,
      include: {
        tecnico: true,
        diagnostico: { include: { equipo: { include: { cliente: true } }, tecnico: true } },
      },
    });

    res.json({ data: orden });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    res.status(500).json({ error: 'Error al actualizar la orden', details: error.message });
  }
};
export const getRepuestosPorOrdenAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const repuestos = await prisma.ordenes_Repuestos.findMany({
      where: { orden_id: Number(id) },
      include: {
        repuesto: { include: { categoria: true } },
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
      orderBy: { id_detalle_repuesto: 'asc' },
    });

    if (!repuestos.length) {
      return res.status(404).json({ error: 'No se encontraron repuestos para esta orden' });
    }

    const data = repuestos.map((item) => ({
      id_detalle_repuesto: item.id_detalle_repuesto,
      orden_id: item.orden_id,
      repuesto_id: item.repuesto_id,
      nombre: item.repuesto?.nombre || '-',
      categoria: item.repuesto?.categoria?.nombre_tipo || '-',
      pieza_solicitada: item.pieza_solicitada || '-',
      cantidad_usada: item.cantidad_usada ?? 0,
      estado_aprobacion: item.estado_aprobacion || '-',
      costo_unitario: item.repuesto?.costo_individual ?? 0,
      cliente: item.orden?.diagnostico?.equipo?.cliente?.nombre || '-',
      equipo: item.orden?.diagnostico?.equipo?.modelo || '-',
    }));

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener repuestos de la orden', details: error.message });
  }
};

export const downloadRepuestosPorOrdenAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const ordenId = parsePositiveId(id);
    if (!ordenId) return res.status(400).json({ error: 'ID de orden inválido' });
    const repuestos = await prisma.ordenes_Repuestos.findMany({
      where: { orden_id: ordenId },
      include: {
        repuesto: { include: { categoria: true } },
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
      orderBy: { id_detalle_repuesto: 'asc' },
    });

    if (!repuestos.length) {
      return res.status(404).json({ error: 'No se encontraron repuestos para esta orden' });
    }

    const headers = [
      'Orden ID',
      'Cliente',
      'Equipo',
      'Detalle ID',
      'Repuesto',
      'Categoría',
      'Pieza solicitada',
      'Cantidad usada',
      'Estado aprobación',
      'Costo unitario',
    ];
    const rows = repuestos.map((item) => [
      item.orden_id,
      item.orden?.diagnostico?.equipo?.cliente?.nombre || '-',
      item.orden?.diagnostico?.equipo?.modelo || '-',
      item.id_detalle_repuesto,
      item.repuesto?.nombre || '-',
      item.repuesto?.categoria?.nombre_tipo || '-',
      item.pieza_solicitada || '-',
      item.cantidad_usada ?? 0,
      item.estado_aprobacion || '-',
      Number(item.repuesto?.costo_individual ?? 0),
    ]);

    const excel = await createAdminExcel({ title: `Repuestos de la orden ${ordenId}`, headers, rows });
    const filename = `repuestos-orden-${ordenId}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excel);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar reporte de repuestos', details: error.message });
  }
};
