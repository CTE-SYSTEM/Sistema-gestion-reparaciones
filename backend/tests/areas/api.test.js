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
  const api = async (route, { actor = actors.servicioCliente, method = 'GET', body, status = 200 } = {}) => {
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
    await account('contabilidad', 'Contabilidad'); await account('servicioCliente', 'ServicioCliente'); await account('bodega', 'Bodega');
    await account('tecnico', 'Tecnico'); await account('jefe', 'TecnicoJefe'); await account('secretaria', 'Secretaria');
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  after(async () => {
    server?.closeAllConnections();
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });

  test('Reclamo: Servicio al Cliente abre, Reclamos analiza y Garantías crea un reingreso vinculado', async () => {
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

  test('Reclamos busca clientes desde una letra y muestra equipos y órdenes aunque aún no se puedan reclamar', async () => {
    const item = await order('EN_REPARACION');
    const matches = await api('/reclamos/clientes?search=C', { actor: actors.reclamos });
    assert.ok(matches.some((row) => row.id_cliente === item.cliente.id_cliente));
    const equipments = await api(`/reclamos/clientes/${item.cliente.id_cliente}/equipos`, { actor: actors.reclamos });
    assert.ok(equipments.some((row) => row.id_equipo === item.equipo.id_equipo));
    const orders = await api(`/reclamos/equipos/${item.equipo.id_equipo}/ordenes`, { actor: actors.reclamos });
    assert.equal(orders[0].estado, 'EN_REPARACION');
    await api('/reclamos', { actor: actors.reclamos, method: 'POST', status: 409,
      body: { orden_original_id: item.orden.id_orden, descripcion: 'La reparación sigue en proceso' } });
  });

  test('Calidad bloquea facturación pendiente, Servicio al Cliente factura y Contabilidad registra movimientos', async () => {
    const item = await order('FINALIZADO', { calidad_estado: 'PENDIENTE', resultado_final: 'REPARADO',
      enciende_salida: true, usa_corriente_ac_salida: true, fecha_finalizacion: new Date() });
    const bill = { orden_id: item.orden.id_orden, mano_obra: 100, monto_diagnostico: 0, impuestos: 0, metodo_pago: 'Pendiente' };
    await api('/facturas', { actor: actors.contabilidad, method: 'POST', body: bill, status: 403 });
    await api('/facturas', { actor: actors.servicioCliente, method: 'POST', body: bill, status: 409 });
    await api(`/calidad/ordenes/${item.orden.id_orden}/revision`, { actor: actors.recepcion, method: 'POST',
      body: { decision: 'APROBADO', observacion: 'El equipo funciona correctamente', pruebas: { encendido: 'CORRECTO', funcion_general: 'CORRECTO' } }, status: 403 });
    const review = await api(`/calidad/ordenes/${item.orden.id_orden}/revision`, { actor: actors.calidad, method: 'POST',
      body: { decision: 'APROBADO', observacion: 'El equipo funciona correctamente', pruebas: { encendido: 'CORRECTO', funcion_general: 'CORRECTO' } } });
    assert.equal(review.calidad_estado, 'APROBADO');
    const factura = await api('/facturas', { actor: actors.servicioCliente, method: 'POST', body: bill, status: 201 });
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

  test('Calidad permite revisar una orden finalizada anterior sin factura y exige aprobación antes del cobro', async () => {
    const item = await order('FINALIZADO', { calidad_estado: 'NO_REQUERIDO', resultado_final: 'REPARADO' });
    const pending = await api('/calidad/ordenes?vista=pendientes', { actor: actors.calidad });
    assert.ok(pending.some((row) => row.id_orden === item.orden.id_orden));
    const bill = { orden_id: item.orden.id_orden, mano_obra: 100, monto_diagnostico: 0, impuestos: 0, metodo_pago: 'Pendiente' };
    await api('/facturas', { actor: actors.servicioCliente, method: 'POST', body: bill, status: 409 });
    const reviewed = await api(`/calidad/ordenes/${item.orden.id_orden}/revision`, { actor: actors.calidad, method: 'POST',
      body: { decision: 'APROBADO', observacion: 'Se verificó la reparación y el funcionamiento general',
        pruebas: { encendido: 'CORRECTO', funcion_general: 'CORRECTO' } } });
    assert.equal(reviewed.calidad_estado, 'APROBADO');
    assert.ok(!(await api('/calidad/ordenes?vista=pendientes', { actor: actors.calidad }))
      .some((row) => row.id_orden === item.orden.id_orden));
  });

  test('Bodega registra piezas faltantes, avisa y las devuelve al flujo tras una compra', async () => {
    const item = await order('EN_REPARACION');
    const tecnico = await prisma.tecnicos.create({ data: { usuario_id: actors.tecnico.id_usuario, nombre: 'Técnico de bodega' } });
    await prisma.ordenes.update({ where: { id_orden: item.orden.id_orden }, data: { tecnico_id: tecnico.id_tecnico } });
    const solicitud = await prisma.ordenes_Repuestos.create({ data: { orden_id: item.orden.id_orden,
      pieza_solicitada: 'Batería de prueba sin registro', cantidad_usada: 1,
      tecnico_solicitante_id: tecnico.id_tecnico } });
    const route = `/bodega/trazabilidad/solicitudes/${solicitud.id_detalle_repuesto}`;
    const active = await api('/bodega/trazabilidad/solicitudes?estado=ACTIVAS', { actor: actors.bodega });
    assert.ok(active.some((row) => row.id_detalle_repuesto === solicitud.id_detalle_repuesto && row.repuesto_id === null));
    await api(`${route}/sin-existencia`, { actor: actors.bodega, method: 'PATCH',
      body: { motivo: 'La batería aún no se encuentra en bodega' } });
    assert.equal((await prisma.ordenes_Repuestos.findUnique({ where: { id_detalle_repuesto: solicitud.id_detalle_repuesto } })).estado_entrega, 'SIN_EXISTENCIA');
    assert.ok((await api('/bodega/trazabilidad/solicitudes?estado=SIN_EXISTENCIA', { actor: actors.bodega }))
      .some((row) => row.id_detalle_repuesto === solicitud.id_detalle_repuesto));
    assert.ok((await api('/notificaciones', { actor: actors.tecnico })).some((notice) => notice.type === 'repuesto_sin_existencia'));
    assert.ok((await api('/notificaciones', { actor: actors.jefe })).some((notice) => notice.type === 'repuesto_sin_existencia'));

    const categoria = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: 'Baterías de prueba' } });
    const proveedor = await prisma.proveedores.create({ data: { nombre: 'Proveedor de baterías', descontinuada: false } });
    const repuesto = await prisma.repuestos.create({ data: { tipo_repuesto_id: categoria.id_tipo_repuesto,
      nombre: solicitud.pieza_solicitada, costo_individual: 0 } });
    const compra = await api('/compras', { actor: actors.bodega, method: 'POST', status: 201,
      body: { repuesto_id: repuesto.id_repuesto, proveedor_id: proveedor.id_proveedor,
        cantidad: 2, costo_unitario: 25, metodo_pago: 'Efectivo' } });
    assert.ok((await api('/notificaciones', { actor: actors.bodega })).some((notice) => notice.type === 'repuesto_revisar_abastecimiento'));
    const approved = await api(`/jefe-tecnico/repuestos/${solicitud.id_detalle_repuesto}/aprobar`, { actor: actors.jefe,
      method: 'PATCH', body: { repuesto_id: repuesto.id_repuesto } });
    assert.equal(approved.estado_entrega, 'PENDIENTE');
    const delivered = await api(`${route}/entregar`, { actor: actors.bodega, method: 'PATCH', body: { compra_id: compra.id_compra } });
    assert.equal(delivered.estado_entrega, 'ENTREGADO');
    assert.equal(delivered.compra_id, compra.id_compra);
  });

  test('Bodega entrega desde stock existente cuando no hay compra de origen', async () => {
    const item = await order('EN_REPARACION');
    const categoria = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: 'Stock histórico' } });
    const repuesto = await prisma.repuestos.create({ data: { tipo_repuesto_id: categoria.id_tipo_repuesto,
      nombre: 'Pieza de stock histórico', stock_actual: 1 } });
    const solicitud = await prisma.ordenes_Repuestos.create({ data: { orden_id: item.orden.id_orden,
      repuesto_id: repuesto.id_repuesto, cantidad_usada: 1, estado_aprobacion: 'APROBADO' } });
    const delivered = await api(`/bodega/trazabilidad/solicitudes/${solicitud.id_detalle_repuesto}/entregar`,
      { actor: actors.bodega, method: 'PATCH', body: {} });
    assert.equal(delivered.estado_entrega, 'ENTREGADO');
    assert.equal(delivered.compra_id, null);
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
      method: 'PATCH', body: {}, status: 409 });
    await api(`/bodega/trazabilidad/solicitudes/${solicitud.id_detalle_repuesto}/entregar`, { actor: actors.bodega,
      method: 'PATCH', body: { compra_id: compra.id_compra } });
    const delivered = await prisma.ordenes_Repuestos.findUnique({ where: { id_detalle_repuesto: solicitud.id_detalle_repuesto } });
    assert.equal(delivered.estado_entrega, 'ENTREGADO'); assert.equal(delivered.compra_id, compra.id_compra);
    const inventory = await api(`/bodega/inventario?search=Pantalla`, { actor: actors.secretaria });
    const stock = inventory.find((row) => row.id_repuesto === repuesto.id_repuesto);
    assert.equal(stock.en_taller_sin_facturar, 1);
    assert.equal(stock.fisico_bodega, 1);
    assert.equal(stock.disponible, 1);
    const updated = await api(`/bodega/trazabilidad/lotes?repuesto_id=${repuesto.id_repuesto}`, { actor: actors.bodega });
    assert.equal(updated.find((lot) => lot.id_compra === compra.id_compra).disponibles_identificadas, 1);
    await prisma.ordenes.update({ where: { id_orden: item.orden.id_orden }, data: { estado: 'ENTREGADO', fecha_entrega: new Date() } });
    await prisma.facturas.create({ data: { orden_id: item.orden.id_orden,
      diagnostico_id: item.diagnostico.id_diagnostico, mano_obra: 100, monto_repuestos: 20,
      subtotal: 120, impuestos: 0, total: 120, metodo_pago: 'Efectivo' } });
    const claim = await api('/reclamos', { method: 'POST', status: 201,
      body: { orden_original_id: item.orden.id_orden, descripcion: 'La pantalla instalada dejó de funcionar' } });
    const clients = await api('/reclamos/clientes?search=Cliente%20%C3%A1reas', { actor: actors.secretaria });
    assert.ok(clients.some((row) => row.id_cliente === item.cliente.id_cliente));
    const equipments = await api(`/reclamos/clientes/${item.cliente.id_cliente}/equipos`, { actor: actors.secretaria });
    assert.ok(equipments.some((row) => row.id_equipo === item.equipo.id_equipo));
    const laterDiagnosis = await prisma.diagnosticos.create({ data: { equipo_id: item.equipo.id_equipo,
      fecha_hora: new Date(Date.now() + 86400000), falla_reportada: 'Segunda visita de prueba', estado_del_diagnostico: 'COMPLETADO' } });
    const laterOrder = await prisma.ordenes.create({ data: { diagnostico_id: laterDiagnosis.id_diagnostico, estado: 'ENTREGADO',
      fecha_ingreso: new Date(Date.now() + 86400000), fecha_entrega: new Date(Date.now() + 86400000) } });
    await prisma.facturas.create({ data: { orden_id: laterOrder.id_orden, diagnostico_id: laterDiagnosis.id_diagnostico,
      mano_obra: 1, subtotal: 1, impuestos: 0, total: 1, metodo_pago: 'Efectivo' } });
    const orders = await api(`/reclamos/equipos/${item.equipo.id_equipo}/ordenes`, { actor: actors.secretaria });
    assert.ok(orders.some((row) => row.id_orden === item.orden.id_orden && row.reclamos_originales.some((entry) => entry.id_reclamo === claim.id_reclamo)));
    assert.equal(orders[0].id_orden, item.orden.id_orden);
    const analyzed = await api(`/reclamos/${claim.id_reclamo}/analisis`, { actor: actors.reclamos, method: 'PATCH',
      body: { responsable_tipo: 'PROVEEDOR', compra_id: compra.id_compra,
        analisis: 'La pieza instalada falló durante el periodo de revisión' } });
    assert.equal(analyzed.compra_id, compra.id_compra);
    assert.equal(analyzed.compra.proveedor.nombre, proveedor.nombre);
    assert.ok((await api('/notificaciones', { actor: actors.bodega })).some((notice) =>
      notice.type === 'reclamo_proveedor' && notice.entity?.id === compra.id_compra));
    const defect = await api('/bodega/inventario/devoluciones', { actor: actors.bodega, method: 'POST', status: 201,
      body: { compra_id: compra.id_compra, reclamo_id: claim.id_reclamo, origen: 'RECLAMO', cantidad: 1,
        motivo: 'La pantalla falló después de entregarse al cliente' } });
    assert.equal(defect.origen, 'RECLAMO');
    await api('/bodega/inventario/devoluciones', { actor: actors.bodega, method: 'POST', status: 409,
      body: { compra_id: compra.id_compra, reclamo_id: claim.id_reclamo, origen: 'RECLAMO', cantidad: 1,
        motivo: 'No se puede devolver dos veces la misma pantalla' } });
    const returned = await api(`/bodega/inventario/devoluciones/${defect.id_devolucion}/devolver`, { actor: actors.bodega, method: 'PATCH' });
    assert.equal(returned.estado, 'DEVUELTO');
    const quarantined = await api('/bodega/inventario/devoluciones', { actor: actors.bodega, method: 'POST', status: 201,
      body: { compra_id: compra.id_compra, origen: 'BODEGA', cantidad: 1, motivo: 'Pieza dañada antes de entregarse al taller' } });
    const afterQuarantine = await api('/bodega/inventario?search=Pantalla', { actor: actors.bodega });
    assert.equal(afterQuarantine.find((row) => row.id_repuesto === repuesto.id_repuesto).disponible, 0);
    await api(`/bodega/inventario/devoluciones/${quarantined.id_devolucion}/devolver`, { actor: actors.bodega, method: 'PATCH' });
    const afterReturn = await api('/bodega/inventario?search=Pantalla', { actor: actors.bodega });
    assert.equal(afterReturn.find((row) => row.id_repuesto === repuesto.id_repuesto).stock_registrado, 0);
  });

  test('Calidad devuelve al taller una reparación que falla sus pruebas', async () => {
    const item = await order('FINALIZADO', { calidad_estado: 'PENDIENTE', fecha_finalizacion: new Date() });
    const rejected = await api(`/calidad/ordenes/${item.orden.id_orden}/revision`, { actor: actors.calidad, method: 'POST',
      body: { decision: 'RECHAZADO', observacion: 'El equipo volvió a apagarse durante la prueba',
        pruebas: { encendido: 'FALLA', funcion_general: 'FALLA', parte: 'Fuente de alimentación' } } });
    assert.equal(rejected.estado, 'EN_REPARACION'); assert.equal(rejected.calidad_estado, 'RECHAZADO');
    assert.equal(await prisma.revisionesCalidad.count({ where: { orden_id: item.orden.id_orden } }), 1);
  });

  test('Calidad pagina diagnósticos, conserva el error y notifica al técnico responsable', async () => {
    const item = await order('ASIGNADO');
    const tecnico = await prisma.tecnicos.create({ data: { usuario_id: actors.tecnico.id_usuario, nombre: 'Técnico de calidad' } });
    await prisma.diagnosticos.update({ where: { id_diagnostico: item.diagnostico.id_diagnostico }, data: { tecnico_id: tecnico.id_tecnico } });
    const revision = await api(`/calidad/diagnosticos/${item.diagnostico.id_diagnostico}/revision`, { actor: actors.calidad, method: 'POST', status: 201,
      body: { decision: 'CON_ERRORES', parte: 'Placa principal', observacion: 'La prueba de voltaje documentada no corresponde al equipo' } });
    assert.equal(revision.datos_nuevos.tecnico_id, tecnico.id_tecnico);
    assert.equal(revision.datos_nuevos.parte, 'Placa principal');
    assert.ok((await api('/notificaciones', { actor: actors.tecnico })).some((notice) => notice.type === 'calidad_diagnostico_error'));
    const reviewed = await api('/calidad/diagnosticos?vista=historial', { actor: actors.calidad });
    assert.ok(reviewed.some((row) => row.id_diagnostico === item.diagnostico.id_diagnostico && row.calidad_estado === 'RECHAZADO'));
    await prisma.diagnosticos.createMany({ data: Array.from({ length: 25 }, () => ({ equipo_id: item.equipo.id_equipo, estado_del_diagnostico: 'COMPLETADO', falla_reportada: 'Prueba de paginación' })) });
    const first = await api('/calidad/diagnosticos?vista=pendientes&page=1', { actor: actors.calidad });
    const second = await api('/calidad/diagnosticos?vista=pendientes&page=2', { actor: actors.calidad });
    assert.equal(first.length, 20); assert.ok(second.length > 0);
    assert.ok(!first.some((row) => second.some((next) => next.id_diagnostico === row.id_diagnostico)));
    assert.ok(!first.concat(second).some((row) => row.id_diagnostico === item.diagnostico.id_diagnostico));
  });

  test('Servicio al Cliente recibe el diagnóstico solo después de la aprobación de Calidad', async () => {
    const cliente = await prisma.clientes.create({ data: { nombre: 'Cliente filtro de calidad' } });
    const equipo = await prisma.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: 'Monitor', marca: 'Prueba' } });
    const diagnostico = await prisma.diagnosticos.create({ data: { equipo_id: equipo.id_equipo,
      estado_del_diagnostico: 'COMPLETADO', falla_reportada: 'No enciende', diagnostico_real: 'Se detectó falla de alimentación',
      presupuesto_estimado: 100 } });
    const route = `/flujo-atencion?search=${encodeURIComponent(cliente.nombre)}`;
    assert.equal((await api(route, { actor: actors.servicioCliente })).length, 0);
    assert.ok((await api(route, { actor: actors.recepcion })).some((row) => row.diagnostico?.id_diagnostico === diagnostico.id_diagnostico));
    assert.ok(!(await api('/ordenes/diagnosticos-listos', { actor: actors.servicioCliente })).some((row) => row.id_diagnostico === diagnostico.id_diagnostico));
    await api(`/servicio-cliente/diagnostico/${diagnostico.id_diagnostico}/contacto`, { method: 'PATCH', status: 409,
      body: { estado_contacto: 'DOCUMENTO_ENVIADO' } });
    await api(`/calidad/diagnosticos/${diagnostico.id_diagnostico}/revision`, { actor: actors.calidad, method: 'POST', status: 201,
      body: { decision: 'SIN_ERRORES', observacion: 'Informe revisado y consistente con las pruebas registradas' } });
    assert.ok((await api(route, { actor: actors.servicioCliente })).some((row) => row.diagnostico?.id_diagnostico === diagnostico.id_diagnostico));
    assert.ok((await api('/ordenes/diagnosticos-listos', { actor: actors.servicioCliente })).some((row) => row.id_diagnostico === diagnostico.id_diagnostico));
    await api(`/servicio-cliente/diagnostico/${diagnostico.id_diagnostico}/contacto`, { method: 'PATCH',
      body: { estado_contacto: 'DOCUMENTO_ENVIADO' } });
  });

  test('Contabilidad conserva el cobro histórico después de una devolución y otro cobro', async () => {
    const item = await order('ENTREGADO', { fecha_entrega: new Date('2002-04-01T12:00:00Z') });
    const factura = await prisma.facturas.create({ data: { orden_id: item.orden.id_orden, diagnostico_id: item.diagnostico.id_diagnostico,
      mano_obra: 100, monto_repuestos: 0, monto_diagnostico: 0, subtotal: 100, impuestos: 0, total: 100, metodo_pago: 'Efectivo', fecha_emision: new Date('2002-04-01T12:00:00Z') } });
    for (const tipo of ['DEVOLUCION', 'COBRO']) {
      const movement = await api('/contabilidad/movimientos', { actor: actors.contabilidad, method: 'POST', status: 201,
        body: { tipo, factura_id: factura.id_factura, monto: 30, metodo: 'Efectivo', motivo: 'Corrección histórica de prueba' } });
      await prisma.movimientosContables.update({ where: { id_movimiento: movement.id_movimiento }, data: { fecha_registro: new Date('2002-04-02T12:00:00Z') } });
    }
    const category = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: 'Finanzas prueba' } });
    const supplier = await prisma.proveedores.create({ data: { nombre: 'Proveedor finanzas prueba' } });
    const part = await prisma.repuestos.create({ data: { tipo_repuesto_id: category.id_tipo_repuesto, nombre: 'Pieza finanzas prueba', costo_individual: 20 } });
    const paidPurchase = await prisma.compras.create({ data: { repuesto_id: part.id_repuesto, proveedor_id: supplier.id_proveedor,
      cantidad: 2, costo_unitario: 20, metodo_pago: 'Efectivo', fecha_obtencion: new Date('2002-04-03T12:00:00Z') } });
    await prisma.compras.create({ data: { repuesto_id: part.id_repuesto, proveedor_id: supplier.id_proveedor,
      cantidad: 1, costo_unitario: 10, fecha_obtencion: new Date('2002-04-04T12:00:00Z') } });
    const summary = await api('/contabilidad/resumen?anio=2002', { actor: actors.contabilidad });
    assert.equal(summary.months[3].cobros, 130); assert.equal(summary.months[3].devoluciones, 30);
    assert.equal(summary.totals.compras_registradas, 50); assert.equal(summary.totals.compras_pagadas, 40);
    assert.equal(summary.totals.neto, 60);
    const ledger = await api('/contabilidad/resumen/reportes/movimientos_contables?fecha_inicio=2002-04-01&fecha_fin=2002-04-30', { actor: actors.contabilidad });
    assert.ok(ledger.some((row) => row.factura === factura.id_factura && row.tipo === 'DEVOLUCION'));
    const activity = await api('/secretaria/reportes/actividad_financiera?fecha_inicio=2002-04-01&fecha_fin=2002-04-30', { actor: actors.secretaria });
    assert.ok(activity.some((row) => row.origen === 'Factura' && row.referencia === `#${factura.id_factura}` && row.efecto_caja === 100));
    assert.ok(activity.some((row) => row.origen === 'Compra' && row.referencia === `#${paidPurchase.id_compra}` && row.efecto_caja === -40));
    assert.equal(activity.reduce((total, row) => total + row.efecto_caja, 0), 60);
    await api('/contabilidad/movimientos', { actor: actors.secretaria, status: 403 });
  });

  test('Administración obtiene reportes de calidad, reclamos y piezas defectuosas', async () => {
    const { loadAdminReport } = await import('../../src/services/adminReportsService.js');
    for (const type of ['calidad_diagnosticos', 'calidad_ordenes', 'reclamos', 'devoluciones_proveedor']) {
      const report = await loadAdminReport(type);
      assert.ok(report.total > 0, `El reporte ${type} debe mostrar los registros creados`);
      assert.ok(report.columns.length > 0);
    }
  });

  test('El perfil integral consulta reportes del taller sin acceso a auditoría administrativa', async () => {
    const catalog = await api('/secretaria/reportes/catalogo', { actor: actors.secretaria });
    assert.ok(catalog.some((row) => row.id === 'reclamos'));
    assert.ok(!catalog.some((row) => row.id === 'auditoria'));
    const claims = await api('/secretaria/reportes/reclamos', { actor: actors.secretaria });
    assert.ok(claims.length > 0);
    await api('/secretaria/reportes/catalogo', { actor: actors.servicioCliente, status: 403 });
    await api('/secretaria/reportes/auditoria', { actor: actors.secretaria, status: 404 });
  });
}
