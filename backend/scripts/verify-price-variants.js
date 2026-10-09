// Prueba aislada: usa la base real y revierte todos los registros al finalizar.
import assert from 'node:assert/strict';
import prisma from '../src/app/prismaClient.js';
import { montoRepuestos, precioVentaDetalle } from '../src/utils/precioRepuestos.js';

const rollback = Symbol('rollback');
let result;
try {
  await prisma.$transaction(async (tx) => {
    const category = await tx.categorias_Repuestos.create({ data: { nombre_tipo: 'Prueba de precios' } });
    const providerA = await tx.proveedores.create({ data: { nombre: 'Proveedor A (prueba)', descontinuada: false } });
    const providerB = await tx.proveedores.create({ data: { nombre: 'Proveedor B (prueba)', descontinuada: false } });
    const partA = await tx.repuestos.create({ data: {
      tipo_repuesto_id: category.id_tipo_repuesto, proveedor_id: providerA.id_proveedor,
      nombre: 'Batería modelo X', costo_individual: 100, ganancia_cordobas: 25,
    } });
    const partB = await tx.repuestos.create({ data: {
      tipo_repuesto_id: category.id_tipo_repuesto, proveedor_id: providerB.id_proveedor,
      nombre: 'Batería modelo X', costo_individual: 180, ganancia_cordobas: 25,
    } });
    const purchaseA = await tx.compras.create({ data: {
      repuesto_id: partA.id_repuesto, proveedor_id: providerA.id_proveedor,
      cantidad: 1, costo_unitario: 100, metodo_pago: 'Efectivo',
    } });
    const purchaseB = await tx.compras.create({ data: {
      repuesto_id: partB.id_repuesto, proveedor_id: providerB.id_proveedor,
      cantidad: 1, costo_unitario: 180, metodo_pago: 'Efectivo',
    } });
    const client = await tx.clientes.create({ data: { nombre: 'Cliente de prueba de precios' } });
    const equipment = await tx.equipos.create({ data: { cliente_id: client.id_cliente, tipo: 'Laptop', marca: 'Prueba', modelo: 'X' } });
    const diagnosis = await tx.diagnosticos.create({ data: { equipo_id: equipment.id_equipo, estado_del_diagnostico: 'COMPLETADO' } });
    const order = await tx.ordenes.create({ data: { diagnostico_id: diagnosis.id_diagnostico, estado: 'FINALIZADO', calidad_estado: 'APROBADO' } });
    for (const [part, purchase] of [[partA, purchaseA], [partB, purchaseB]]) {
      await tx.ordenes_Repuestos.create({ data: {
        orden_id: order.id_orden, repuesto_id: part.id_repuesto, compra_id: purchase.id_compra,
        cantidad_usada: 1, estado_aprobacion: 'APROBADO', estado_entrega: 'ENTREGADO',
      } });
    }
    const details = await tx.ordenes_Repuestos.findMany({ where: { orden_id: order.id_orden },
      include: { repuesto: true, compra: true }, orderBy: { id_detalle_repuesto: 'asc' } });
    assert.equal(details.length, 2);
    assert.notEqual(details[0].repuesto_id, details[1].repuesto_id);
    assert.deepEqual(details.map(precioVentaDetalle), [125, 205]);
    assert.equal(montoRepuestos(details), 330);
    result = { mismo_modelo: true, variantes: 2, costos: [100, 180], precios_facturados: [125, 205], total_repuestos: 330 };
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await prisma.$disconnect();
}
console.log(JSON.stringify({ ...result, cambios_revertidos: true }));
