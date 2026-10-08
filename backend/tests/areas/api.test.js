import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';

const databaseName = process.env.CTE_AREAS_TEST_DATABASE;
if (!databaseName) {
  test('Áreas: integración requiere una base temporal', { skip: 'Use test:areas:integracion' }, () => {});
} else {
  assert.match(databaseName, /^cte_areas_test_[0-9a-f]{32}$/);
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.pathname, `/${databaseName}`);
  assert.ok(['db', 'localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const { default: app } = await import('../../src/app/app.js');
  const { default: prisma } = await import('../../src/app/prismaClient.js');
  let server, base;
  const actors = {};
  const account = async (key, rol) => {
    const user = await prisma.usuarios.create({ data: { nombre_usuario: `areas_${key}`, rol, contrasena_hash: 'solo-pruebas' } });
    actors[key] = { ...user, token: jwt.sign({ id: user.id_usuario }, process.env.JWT_SECRET, { expiresIn: '10m' }) };
  };
  const api = async (route, { actor = actors.recepcion, method = 'GET', body, status = 200 } = {}) => {
    const response = await fetch(`${base}${route}`, { method, signal: AbortSignal.timeout(10000),
      headers: { ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data)}`);
    return data.data;
  };
  let sequence = 0;
  const order = async (estado, extras = {}) => {
    const suffix = ++sequence;
    const cliente = await prisma.clientes.create({ data: { nombre: `Cliente áreas ${suffix}` } });
    const equipo = await prisma.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: 'Laptop', marca: 'Prueba', modelo: `${suffix}` } });
    const diagnostico = await prisma.diagnosticos.create({ data: { equipo_id: equipo.id_equipo, origen_directo: true,
      falla_reportada: 'Falla de encendido', diagnostico_real: 'Se revisó el equipo', estado_del_diagnostico: 'COMPLETADO',
      estado_contacto: 'APROBADO', Estado_aprobacion: 'Aprobado', presupuesto_estimado: 100 } });
    const orden = await prisma.ordenes.create({ data: { diagnostico_id: diagnostico.id_diagnostico, estado,
      monto_autorizado: 100, ...extras } });
    return { cliente, equipo, diagnostico, orden };
  };
  before(async () => {
    await account('recepcion', 'Recepcion'); await account('reclamos', 'Reclamos');
    await account('garantias', 'Garantias'); await account('calidad', 'Calidad');
    await account('contabilidad', 'Contabilidad'); await account('bodega', 'Bodega');
    await account('tecnico', 'Tecnico');
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  after(async () => {
    server?.closeAllConnections();
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });

  test('Reclamo: recepción abre, reclamos analiza y garantías crea un reingreso vinculado', async () => {
    const original = await order('ENTREGADO', { fecha_entrega: new Date() });
    const factura = await prisma.facturas.create({ data: { orden_id: original.orden.id_orden,
      diagnostico_id: original.diagnostico.id_diagnostico, mano_obra: 100, monto_repuestos: 0,
      monto_diagnostico: 0, subtotal: 100, impuestos: 0, total: 100, metodo_pago: 'Efectivo' } });
    await prisma.garantias.create({ data: { factura_id: factura.id_factura, duracion_meses: 3,
      fecha_inicio: new Date(Date.now() - 86400000), fecha_vencimiento: new Date(Date.now() + 86400000 * 30) } });
    const opened = await api('/reclamos', { method: 'POST', body: { orden_original_id: original.orden.id_orden,
      descripcion: 'El equipo volvió a presentar la misma falla' }, status: 201 });
    assert.equal(opened.estado, 'ABIERTO');
    await api('/reclamos', { actor: actors.tecnico, status: 403 });
    await api('/reclamos', { method: 'POST', body: { orden_original_id: original.orden.id_orden,
      descripcion: 'Segundo reclamo abierto sin resolver el primero' }, status: 409 });
    const analyzed = await api(`/reclamos/${opened.id_reclamo}/analisis`, { actor: actors.reclamos, method: 'PATCH',
      body: { responsable_tipo: 'TECNICO', analisis: 'La intervención anterior no resolvió la falla original' } });
    assert.equal(analyzed.responsable_tipo, 'TECNICO');
    await api(`/reclamos/${opened.id_reclamo}/decision`, { actor: actors.reclamos, method: 'PATCH',
      body: { decision: 'APROBADA', motivo: 'La garantía está vigente y cubre el problema' }, status: 403 });
    const decided = await api(`/reclamos/${opened.id_reclamo}/decision`, { actor: actors.garantias, method: 'PATCH',
      body: { decision: 'APROBADA', motivo: 'La garantía está vigente y cubre el problema' } });
    assert.equal(decided.cobertura, 'APROBADA');
    assert.ok(decided.orden_reingreso_id);
    const reentry = await prisma.ordenes.findUnique({ where: { id_orden: decided.orden_reingreso_id } });
    assert.equal(reentry.es_garantia, true); assert.equal(reentry.estado, 'PENDIENTE');
    assert.equal((await prisma.ordenes.findUnique({ where: { id_orden: original.orden.id_orden } })).estado, 'ENTREGADO');
    await prisma.ordenes.update({ where: { id_orden: reentry.id_orden }, data: {
      estado: 'FINALIZADO', resultado_final: 'REPARADO', calidad_estado: 'PENDIENTE', fecha_finalizacion: new Date(),
    } });
    await api(`/calidad/ordenes/${reentry.id_orden}/revision`, { actor: actors.calidad, method: 'POST',
      body: { decision: 'APROBADO', observacion: 'El reingreso pasó las pruebas de funcionamiento',
        pruebas: { encendido: 'CORRECTO', funcion_general: 'CORRECTO' } } });
    const coveredInvoice = await prisma.facturas.findUnique({ where: { orden_id: reentry.id_orden } });
    assert.equal(Number(coveredInvoice.total), 0); assert.equal(coveredInvoice.metodo_pago, 'GARANTIA');
    await api(`/reclamos/${opened.id_reclamo}/cerrar`, { actor: actors.reclamos, method: 'PATCH',
      body: { resolucion: 'Se abrió una nueva orden cubierta por garantía' }, status: 409 });
    assert.ok((await api('/notificaciones', { actor: actors.garantias })).some((notice) => notice.entity?.id === opened.id_reclamo));
  });

  test('Calidad bloquea facturación pendiente y contabilidad registra cobros y devoluciones', async () => {
    const item = await order('FINALIZADO', { calidad_estado: 'PENDIENTE', resultado_final: 'REPARADO',
      enciende_salida: true, usa_corriente_ac_salida: true, fecha_finalizacion: new Date() });
    const bill = { orden_id: item.orden.id_orden, mano_obra: 100, monto_diagnostico: 0, impuestos: 0, metodo_pago: 'Pendiente' };
    await api('/facturas', { actor: actors.contabilidad, method: 'POST', body: bill, status: 409 });
    await api(`/calidad/ordenes/${item.orden.id_orden}/revision`, { actor: actors.recepcion, method: 'POST',
      body: { decision: 'APROBADO', observacion: 'El equipo funciona correctamente', pruebas: { encendido: 'CORRECTO', funcion_general: 'CORRECTO' } }, status: 403 });
    const review = await api(`/calidad/ordenes/${item.orden.id_orden}/revision`, { actor: actors.calidad, method: 'POST',
      body: { decision: 'APROBADO', observacion: 'El equipo funciona correctamente', pruebas: { encendido: 'CORRECTO', funcion_general: 'CORRECTO' } } });
    assert.equal(review.calidad_estado, 'APROBADO');
    const factura = await api('/facturas', { actor: actors.contabilidad, method: 'POST', body: bill, status: 201 });
    let saldo = await api(`/facturas/${factura.id_factura}/saldo`);
    assert.equal(saldo.pendiente, 100);
    await api('/contabilidad/movimientos', { actor: actors.contabilidad, method: 'POST', status: 201,
      body: { tipo: 'COBRO', factura_id: factura.id_factura, monto: 100, metodo: 'Efectivo', motivo: 'Pago completo del cliente' } });
    saldo = await api(`/facturas/${factura.id_factura}/saldo`); assert.equal(saldo.pendiente, 0);
    await api('/contabilidad/movimientos', { actor: actors.contabilidad, method: 'POST', status: 201,
      body: { tipo: 'DEVOLUCION', factura_id: factura.id_factura, monto: 20, metodo: 'Efectivo', motivo: 'Ajuste parcial autorizado' } });
    saldo = await api(`/facturas/${factura.id_factura}/saldo`);
    assert.equal(saldo.devuelto, 20); assert.equal(saldo.pendiente, 20);
    await api('/contabilidad/movimientos', { actor: actors.contabilidad, method: 'POST', status: 409,
      body: { tipo: 'DEVOLUCION', factura_id: factura.id_factura, monto: 100, metodo: 'Efectivo', motivo: 'Devolución excesiva' } });
    const legacy = await order('ENTREGADO');
    const oldBill = await prisma.facturas.create({ data: { orden_id: legacy.orden.id_orden,
      diagnostico_id: legacy.diagnostico.id_diagnostico, mano_obra: 100, subtotal: 100,
      impuestos: 0, total: 100, metodo_pago: 'Efectivo' } });
    await api('/contabilidad/movimientos', { actor: actors.contabilidad, method: 'POST', status: 201,
      body: { tipo: 'DEVOLUCION', factura_id: oldBill.id_factura, monto: 30, metodo: 'Efectivo', motivo: 'Reintegro a factura histórica' } });
    await api('/contabilidad/movimientos', { actor: actors.contabilidad, method: 'POST', status: 201,
      body: { tipo: 'COBRO', factura_id: oldBill.id_factura, monto: 30, metodo: 'Efectivo', motivo: 'Nuevo cobro tras reintegro' } });
    const historicalBalance = await api(`/facturas/${oldBill.id_factura}/saldo`);
    assert.equal(historicalBalance.cobro_historico, true); assert.equal(historicalBalance.pendiente, 0);
  });

  test('Bodega vincula la pieza entregada con su compra y proveedor', async () => {
    const item = await order('EN_REPARACION');
    const categoria = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: 'Pantallas' } });
    const proveedor = await prisma.proveedores.create({ data: { nombre: 'Proveedor de prueba' } });
    const repuesto = await prisma.repuestos.create({ data: { tipo_repuesto_id: categoria.id_tipo_repuesto,
      nombre: 'Pantalla', costo_individual: 20, stock_actual: 0 } });
    const compra = await prisma.compras.create({ data: { repuesto_id: repuesto.id_repuesto,
      proveedor_id: proveedor.id_proveedor, cantidad: 2, costo_unitario: 20, documento: 'TEST-LOTE' } });
    const solicitud = await prisma.ordenes_Repuestos.create({ data: { orden_id: item.orden.id_orden,
      repuesto_id: repuesto.id_repuesto, cantidad_usada: 1, estado_aprobacion: 'APROBADO' } });
    const lotes = await api(`/bodega/trazabilidad/lotes?repuesto_id=${repuesto.id_repuesto}`, { actor: actors.bodega });
    assert.ok(lotes.some((lot) => lot.id_compra === compra.id_compra && lot.disponibles_identificadas === 2));
    await api(`/bodega/trazabilidad/solicitudes/${solicitud.id_detalle_repuesto}/entregar`, { actor: actors.bodega,
      method: 'PATCH', body: {}, status: 400 });
    await api(`/bodega/trazabilidad/solicitudes/${solicitud.id_detalle_repuesto}/entregar`, { actor: actors.bodega,
      method: 'PATCH', body: { compra_id: compra.id_compra } });
    const delivered = await prisma.ordenes_Repuestos.findUnique({ where: { id_detalle_repuesto: solicitud.id_detalle_repuesto } });
    assert.equal(delivered.estado_entrega, 'ENTREGADO'); assert.equal(delivered.compra_id, compra.id_compra);
    const updated = await api(`/bodega/trazabilidad/lotes?repuesto_id=${repuesto.id_repuesto}`, { actor: actors.bodega });
    assert.equal(updated.find((lot) => lot.id_compra === compra.id_compra).disponibles_identificadas, 1);
    await prisma.ordenes.update({ where: { id_orden: item.orden.id_orden }, data: { estado: 'ENTREGADO', fecha_entrega: new Date() } });
    await prisma.facturas.create({ data: { orden_id: item.orden.id_orden,
      diagnostico_id: item.diagnostico.id_diagnostico, mano_obra: 100, monto_repuestos: 20,
      subtotal: 120, impuestos: 0, total: 120, metodo_pago: 'Efectivo' } });
    const claim = await api('/reclamos', { method: 'POST', status: 201,
      body: { orden_original_id: item.orden.id_orden, descripcion: 'La pantalla instalada dejó de funcionar' } });
    const analyzed = await api(`/reclamos/${claim.id_reclamo}/analisis`, { actor: actors.reclamos, method: 'PATCH',
      body: { responsable_tipo: 'PROVEEDOR', compra_id: compra.id_compra,
        analisis: 'La pieza instalada falló durante el periodo de revisión' } });
    assert.equal(analyzed.compra_id, compra.id_compra);
    assert.equal(analyzed.compra.proveedor.nombre, proveedor.nombre);
    assert.ok((await api('/notificaciones', { actor: actors.bodega })).some((notice) =>
      notice.type === 'reclamo_proveedor' && notice.entity?.id === compra.id_compra));
  });

  test('Calidad devuelve al taller una reparación que falla sus pruebas', async () => {
    const item = await order('FINALIZADO', { calidad_estado: 'PENDIENTE', fecha_finalizacion: new Date() });
    const rejected = await api(`/calidad/ordenes/${item.orden.id_orden}/revision`, { actor: actors.calidad, method: 'POST',
      body: { decision: 'RECHAZADO', observacion: 'El equipo volvió a apagarse durante la prueba',
        pruebas: { encendido: 'FALLA', funcion_general: 'FALLA' } } });
    assert.equal(rejected.estado, 'EN_REPARACION'); assert.equal(rejected.calidad_estado, 'RECHAZADO');
    assert.equal(await prisma.revisionesCalidad.count({ where: { orden_id: item.orden.id_orden } }), 1);
  });
}
