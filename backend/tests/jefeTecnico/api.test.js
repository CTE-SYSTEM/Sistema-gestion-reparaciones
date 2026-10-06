import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';

const databaseName = process.env.CTE_JEFE_TEST_DATABASE;
if (!databaseName) {
  test('Jefe técnico: integración requiere una base temporal', { skip: 'Use npm run test:jefe:integracion' }, () => {});
} else {
  assert.match(databaseName, /^cte_jefetecnico_test_[0-9a-f]{32}$/);
  const connection = new URL(process.env.DATABASE_URL);
  assert.equal(connection.pathname, `/${databaseName}`);
  assert.ok(['db', 'localhost', '127.0.0.1', '[::1]'].includes(connection.hostname));
  const { default: app } = await import('../../src/app/app.js');
  const { default: prisma } = await import('../../src/app/prismaClient.js');
  let server, baseUrl, jefe, tecnicoA, tecnicoB, secretaria, perfilJefe, perfilInactivo;
  let sequence = 0;
  const account = async (username, rol, active = true) => {
    const usuario = await prisma.usuarios.create({ data: { nombre_usuario: username, rol, activo: active, contrasena_hash: 'sin-login-pruebas' } });
    return { ...usuario, token: jwt.sign({ id: usuario.id_usuario }, process.env.JWT_SECRET, { expiresIn: '10m' }) };
  };
  before(async () => {
    jefe = await account('jefe_test', 'TecnicoJefe');
    secretaria = await account('secretaria_test', 'Secretaria');
    const a = await account('tecnico_a', 'Tecnico'), b = await account('tecnico_b', 'Tecnico');
    tecnicoA = { ...a, perfil: await prisma.tecnicos.create({ data: { nombre: 'Técnico A', usuario_id: a.id_usuario } }) };
    tecnicoB = { ...b, perfil: await prisma.tecnicos.create({ data: { nombre: 'Técnico B', usuario_id: b.id_usuario } }) };
    perfilJefe = await prisma.tecnicos.create({ data: { nombre: 'Perfil heredado del jefe', usuario_id: jefe.id_usuario } });
    const inactive = await account('tecnico_inactivo', 'Tecnico', false);
    perfilInactivo = await prisma.tecnicos.create({ data: { nombre: 'Cuenta inactiva', usuario_id: inactive.id_usuario } });
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });
  after(async () => {
    server?.closeAllConnections();
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });
  const request = async (route, method = 'GET', body, actor = jefe, expected = 200) => {
    const response = await fetch(`${baseUrl}${route}`, {
      method, signal: AbortSignal.timeout(10000),
      headers: { ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json();
    if (expected !== null) assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(json)}`);
    return { status: response.status, ...json };
  };
  const api = async (...args) => (await request(...args)).data;
  const diag = async (data = {}) => {
    const cliente = await prisma.clientes.create({ data: { nombre: `Cliente ${++sequence}` } });
    const equipo = await prisma.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: 'Laptop', marca: 'Pruebas', modelo: `Modelo ${sequence}` } });
    return prisma.diagnosticos.create({ data: { equipo_id: equipo.id_equipo, falla_reportada: 'No enciende', ...data } });
  };
  const order = async (data = {}) => {
    const d = await diag({ estado_del_diagnostico: 'COMPLETADO', diagnostico_real: 'Fuente dañada', presupuesto_estimado: 500 });
    return prisma.ordenes.create({ data: { diagnostico_id: d.id_diagnostico, monto_autorizado: 500, ...data } });
  };
  const assign = (tipo, id, tech = tecnicoA) => api(`/jefe-tecnico/${tipo}/${id}/asignacion`, 'POST', { tecnico_id: tech.perfil.id_tecnico });
  const startedOrder = async () => {
    const o = await order();
    await assign('ordenes', o.id_orden);
    return api(`/tecnicos/ordenes/${o.id_orden}/estado`, 'PATCH', { estado: 'EN_REPARACION' }, tecnicoA);
  };
  const part = async (stock = 10) => {
    const proveedor = await prisma.proveedores.create({ data: { nombre: `Proveedor ${++sequence}`, descontinuada: false } });
    const categoria = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: `Categoría ${sequence}` } });
    const r = await prisma.repuestos.create({ data: { nombre: `Repuesto ${sequence}`, proveedor_id: proveedor.id_proveedor, tipo_repuesto_id: categoria.id_tipo_repuesto, descontinuada: false, costo_individual: 100 } });
    await prisma.compras.create({ data: { repuesto_id: r.id_repuesto, proveedor_id: proveedor.id_proveedor, cantidad: stock, costo_unitario: 100 } });
    return r;
  };
  const ask = (o, r, cantidad = 1) => api(`/tecnicos/ordenes/${o.id_orden}/repuestos`, 'POST', { repuesto_id: r.id_repuesto, cantidad }, tecnicoA, 201);
  const exception = (o, body, expected = 200) => api(`/jefe-tecnico/ordenes/${o.id_orden}/intervencion`, 'POST', body, jefe, expected);
  const closure = { tipo: 'FINALIZACION', motivo: 'Técnico ausente, resultado verificado por supervisión', observacion_final: 'Se comprobó el funcionamiento', enciende_salida: true, usa_corriente_ac_salida: true };

  test('Permisos: el jefe supervisa y el técnico trabaja únicamente en su cuenta', async (t) => {
    await t.test('el resumen requiere sesión y rol autorizado', async () => {
      await request('/jefe-tecnico/resumen', 'GET', undefined, null, 401);
      await request('/jefe-tecnico/resumen', 'GET', undefined, tecnicoA, 403);
      await request('/jefe-tecnico/resumen', 'GET', undefined, secretaria, 403);
      const summary = await api('/jefe-tecnico/resumen');
      assert.deepEqual(summary.tecnicos.map((r) => r.id_tecnico).sort(), [tecnicoA.perfil.id_tecnico, tecnicoB.perfil.id_tecnico].sort());
      assert.ok(!JSON.stringify(summary).includes('contrasena_hash'));
    });
    await t.test('el jefe no completa diagnósticos, inicia reparaciones ni solicita piezas', async () => {
      const d = await diag(), o = await order();
      await request(`/tecnicos/diagnosticos/${d.id_diagnostico}`, 'PUT', { diagnostico_real: 'Informe' }, jefe, 403);
      await request(`/tecnicos/diagnosticos/${d.id_diagnostico}/iniciar`, 'PATCH', {}, jefe, 403);
      await request(`/tecnicos/ordenes/${o.id_orden}/estado`, 'PATCH', { estado: 'EN_REPARACION' }, jefe, 403);
      await request(`/tecnicos/ordenes/${o.id_orden}/repuestos`, 'POST', { repuesto: 'Pieza', cantidad: 1 }, jefe, 403);
      await request(`/secretaria/diagnostico/${d.id_diagnostico}`, 'PUT', { diagnostico_real: 'Atajo' }, jefe, 403);
      await request(`/ordenes/${o.id_orden}`, 'PUT', { estado: 'FINALIZADO' }, jefe, 403);
      await request(`/archivos-servicio/diagnosticos/${d.id_diagnostico}`, 'GET');
      await request(`/archivos-servicio/diagnosticos/${d.id_diagnostico}`, 'POST', {}, jefe, 403);
    });
    await t.test('no consulta ni modifica trabajos de otro técnico', async () => {
      const d = await diag(), o = await startedOrder();
      await assign('diagnosticos', d.id_diagnostico);
      await request('/tecnicos/mis-diagnosticos/tecnico_a', 'GET', undefined, tecnicoB, 403);
      await request('/tecnicos/mis-ordenes/tecnico_a', 'GET', undefined, tecnicoB, 403);
      await request(`/tecnicos/diagnosticos/${d.id_diagnostico}/iniciar`, 'PATCH', {}, tecnicoB, 403);
      await request(`/tecnicos/diagnosticos/${d.id_diagnostico}`, 'PUT', { diagnostico_real: 'Informe ajeno' }, tecnicoB, 403);
      await request(`/tecnicos/ordenes/${o.id_orden}/estado`, 'PATCH', { estado: 'EN_REPARACION' }, tecnicoB, 403);
      await request(`/tecnicos/ordenes/${o.id_orden}/repuestos`, 'POST', { repuesto: 'Pieza', cantidad: 1 }, tecnicoB, 403);
    });
  });
  test('Asignación y fechas: el inicio real pertenece al técnico', async (t) => {
    await t.test('asigna el diagnóstico y conserva inicio vacío hasta que el técnico comience', async () => {
      const d = await diag(), id = d.id_diagnostico;
      const assigned = await assign('diagnosticos', id);
      assert.equal(assigned.estado_del_diagnostico, 'ASIGNADO');
      assert.equal(assigned.fecha_inicio, null);
      assert.ok(assigned.fecha_asignacion);
      await request(`/tecnicos/diagnosticos/${id}`, 'PUT', { diagnostico_real: 'Informe prematuro' }, tecnicoA, 409);
      const started = await api(`/tecnicos/diagnosticos/${id}/iniciar`, 'PATCH', {}, tecnicoA);
      assert.equal(started.estado_del_diagnostico, 'EN_REVISION');
      assert.ok(started.fecha_inicio);
      const completed = await api(`/tecnicos/diagnosticos/${id}`, 'PUT', { diagnostico_real: 'Fuente revisada', presupuesto_estimado: 200 }, tecnicoA);
      assert.equal(completed.estado_del_diagnostico, 'COMPLETADO');
      assert.equal(completed.fecha_inicio, started.fecha_inicio);
      assert.ok(completed.fecha_completado);
      await request(`/tecnicos/diagnosticos/${id}`, 'PUT', { diagnostico_real: 'Reabrir' }, tecnicoA, 409);
      const detail = await api(`/jefe-tecnico/diagnosticos/${id}`);
      assert.equal(detail.asignaciones.length, 1);
      assert.equal(detail.asignaciones[0].usuario.id_usuario, jefe.id_usuario);
      assert.ok(detail.historial_estados.some((h) => h.estado_nuevo === 'COMPLETADO' && h.usuario?.id_usuario === tecnicoA.id_usuario));
    });
    await t.test('asigna la orden sin comenzar y no permite piezas ni cierre anticipados', async () => {
      const o = await order(), r = await part(), id = o.id_orden;
      const assigned = await assign('ordenes', id);
      assert.equal(assigned.estado, 'ASIGNADO');
      assert.equal(assigned.fecha_inicio_reparacion, null);
      assert.equal(assigned.irreparable_estado, 'NO_SOLICITADO');
      await request(`/tecnicos/ordenes/${id}/repuestos`, 'POST', { repuesto_id: r.id_repuesto }, tecnicoA, 409);
      await exception(o, closure, 409);
      const started = await api(`/tecnicos/ordenes/${id}/estado`, 'PATCH', { estado: 'EN_REPARACION' }, tecnicoA);
      assert.ok(started.fecha_inicio_reparacion);
    });
    await t.test('excluye cuentas de jefe, inactivas y técnicos ausentes', async () => {
      const d = await diag(), url = `/jefe-tecnico/diagnosticos/${d.id_diagnostico}/asignacion`;
      await request(url, 'POST', { tecnico_id: perfilJefe.id_tecnico }, jefe, 400);
      await request(url, 'POST', { tecnico_id: perfilInactivo.id_tecnico }, jefe, 400);
      await request(`/jefe-tecnico/tecnicos/${tecnicoB.perfil.id_tecnico}/disponibilidad`, 'PATCH', { disponibilidad: 'AUSENTE' }, jefe, 400);
      await api(`/jefe-tecnico/tecnicos/${tecnicoB.perfil.id_tecnico}/disponibilidad`, 'PATCH', { disponibilidad: 'AUSENTE', observacion_disponibilidad: 'Vacaciones' });
      try { await request(url, 'POST', { tecnico_id: tecnicoB.perfil.id_tecnico }, jefe, 409); }
      finally { await api(`/jefe-tecnico/tecnicos/${tecnicoB.perfil.id_tecnico}/disponibilidad`, 'PATCH', { disponibilidad: 'DISPONIBLE' }); }
    });
    await t.test('la asignación normal y las rutas antiguas impiden reasignar', async () => {
      const d = await diag();
      await assign('diagnosticos', d.id_diagnostico);
      await request(`/jefe-tecnico/diagnosticos/${d.id_diagnostico}/asignacion`, 'POST', { tecnico_id: tecnicoB.perfil.id_tecnico }, jefe, 409);
      await request(`/diagnosticos/${d.id_diagnostico}/asignar`, 'PATCH', { tecnico_id: tecnicoB.perfil.id_tecnico }, jefe, 409);
      await request(`/diagnosticos/correcciones/diagnosticos/${d.id_diagnostico}`, 'PATCH', { tecnico_id: tecnicoB.perfil.id_tecnico, motivo: 'Atajo' }, jefe, 409);
    });
  });
  test('Excepciones: motivo obligatorio, responsabilidad conservada e historial atómico', async (t) => {
    await t.test('reasignar conserva fechas y registra quién cambió la responsabilidad', async () => {
      const o = await startedOrder();
      await exception(o, { tipo: 'REASIGNACION', tecnico_id: tecnicoB.perfil.id_tecnico }, 400);
      assert.equal(await prisma.intervencionesTecnicas.count({ where: { orden_id: o.id_orden } }), 0);
      const changed = await exception(o, { tipo: 'REASIGNACION', tecnico_id: tecnicoB.perfil.id_tecnico, motivo: 'Ausencia del responsable' });
      assert.equal(changed.estado, o.estado);
      assert.equal(changed.fecha_inicio_reparacion, o.fecha_inicio_reparacion);
      assert.equal(changed.tecnico_id, tecnicoB.perfil.id_tecnico);
      const detail = await api(`/jefe-tecnico/ordenes/${o.id_orden}`);
      assert.equal(detail.intervenciones.length, 1);
      assert.equal(detail.intervenciones[0].datos_anteriores.tecnico_id, tecnicoA.perfil.id_tecnico);
      assert.equal(detail.intervenciones[0].datos_nuevos.tecnico_id, tecnicoB.perfil.id_tecnico);
      assert.equal(detail.asignaciones[0].es_excepcion, true);
      assert.equal(detail.asignaciones[0].tecnico_anterior_id, tecnicoA.perfil.id_tecnico);
      await request(`/tecnicos/ordenes/${o.id_orden}/estado`, 'PATCH', { estado: 'EN_REPARACION' }, tecnicoA, 403);
    });
    await t.test('finaliza una orden iniciada con resultado y no admite una segunda intervención', async () => {
      const o = await startedOrder();
      await exception(o, { ...closure, motivo: '' }, 400);
      await exception(o, { ...closure, observacion_final: '' }, 400);
      const closed = await exception(o, closure);
      assert.equal(closed.estado, 'FINALIZADO');
      assert.equal(closed.tecnico_id, tecnicoA.perfil.id_tecnico);
      assert.ok(closed.fecha_finalizacion);
      const detail = await api(`/jefe-tecnico/ordenes/${o.id_orden}`);
      assert.ok(detail.historial_estados.some((h) => h.estado_nuevo === 'FINALIZADO' && h.observacion === closure.motivo));
      await exception(o, { tipo: 'REASIGNACION', tecnico_id: tecnicoB.perfil.id_tecnico, motivo: 'Tras el cierre' }, 409);
    });
    await t.test('no completa un diagnóstico por excepción y no modifica órdenes facturadas', async () => {
      const d = await diag(); await assign('diagnosticos', d.id_diagnostico);
      await request(`/jefe-tecnico/diagnosticos/${d.id_diagnostico}/intervencion`, 'POST', closure, jefe, 403);
      const o = await order({ estado: 'FINALIZADO', tecnico_id: tecnicoA.perfil.id_tecnico });
      await prisma.facturas.create({ data: { orden_id: o.id_orden, mano_obra: 100, monto_repuestos: 0, subtotal: 100, total: 100, impuestos: 0 } });
      await prisma.ordenes.update({ where: { id_orden: o.id_orden }, data: { estado: 'EN_REPARACION' } });
      await exception(o, { tipo: 'REASIGNACION', tecnico_id: tecnicoB.perfil.id_tecnico, motivo: 'Facturada' }, 409);
    });
    await t.test('la prioridad necesita motivo y queda auditada', async () => {
      const o = await startedOrder(), url = `/jefe-tecnico/ordenes/${o.id_orden}/prioridad`;
      await request(url, 'PATCH', { prioridad: 'Urgente' }, jefe, 400);
      const changed = await api(url, 'PATCH', { prioridad: 'Urgente', motivo: 'Cliente requiere atención prioritaria' });
      assert.equal(changed.prioridad, 'Urgente');
      const [audit] = await prisma.$queryRaw`SELECT usuario_id, observacion FROM "Auditoria_Movimientos" WHERE tabla = 'Ordenes' AND registro_pk->>'id_orden' = ${String(o.id_orden)} ORDER BY id_auditoria DESC LIMIT 1`;
      assert.equal(audit.usuario_id, jefe.id_usuario);
      assert.equal(audit.observacion, 'Cliente requiere atención prioritaria');
    });
  });
  test('Repuestos: revisar, reservar y entregar son pasos distintos', async (t) => {
    await t.test('aprobación no entrega, la reserva limita stock y solo se finaliza tras entregar', async () => {
      const o = await startedOrder(), r = await part(2), p = await ask(o, r, 2);
      const approved = await api(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/aprobar`, 'PATCH', {});
      assert.equal(approved.estado_aprobacion, 'APROBADO');
      assert.equal(approved.estado_entrega, 'PENDIENTE');
      assert.equal(approved.fecha_entrega, null);
      const summary = await api('/jefe-tecnico/resumen'), stock = summary.catalogo.find((item) => item.id_repuesto === r.id_repuesto);
      assert.equal(stock.stock_actual, 2);
      assert.equal(stock.stock_reservado, 2);
      assert.equal(stock.stock_disponible, 0);
      await exception(o, closure, 409);
      await request(`/tecnicos/ordenes/${o.id_orden}/estado`, 'PATCH', { estado: 'EN_REPARACION' }, tecnicoA, 409);
      const delivered = await api(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/entregar`, 'PATCH', {});
      assert.equal(delivered.usuario_entregador_id, jefe.id_usuario);
      assert.ok(delivered.fecha_entrega);
      await request(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/corregir`, 'PATCH', { cantidad_usada: 1, motivo: 'Ya entregado' }, jefe, 409);
      await request(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/entregar`, 'PATCH', {}, jefe, 409);
      await exception(o, closure);
    });
    await t.test('rechaza con motivo, no entrega piezas rechazadas y deja reanudar', async () => {
      const o = await startedOrder(), r = await part(), p = await ask(o, r);
      await request(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/rechazar`, 'PATCH', {}, jefe, 400);
      const rejected = await api(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/rechazar`, 'PATCH', { motivo: 'No corresponde a esta reparación' });
      assert.equal(rejected.estado_aprobacion, 'DENEGADO');
      assert.equal(rejected.motivo_rechazo, 'No corresponde a esta reparación');
      await request(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/entregar`, 'PATCH', {}, jefe, 409);
      await api(`/tecnicos/ordenes/${o.id_orden}/estado`, 'PATCH', { estado: 'EN_REPARACION' }, tecnicoA);
    });
    await t.test('corrige cantidades reservadas antes de entregar, con motivo y validación de stock', async () => {
      const o = await startedOrder(), r = await part(3), p = await ask(o, r, 2);
      await api(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/aprobar`, 'PATCH', {});
      await request(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/corregir`, 'PATCH', { cantidad_usada: 3 }, jefe, 400);
      await request(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/corregir`, 'PATCH', { cantidad_usada: 4, motivo: 'Excede inventario' }, jefe, 409);
      const corrected = await api(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/corregir`, 'PATCH', { cantidad_usada: 3, motivo: 'Cantidad confirmada' });
      assert.equal(corrected.cantidad_usada, 3);
      assert.equal(corrected.estado_aprobacion, 'APROBADO');
    });
    await t.test('dos aprobaciones simultáneas no reservan la misma última pieza', async () => {
      const a = await startedOrder(), b = await startedOrder(), r = await part(1), pa = await ask(a, r), pb = await ask(b, r);
      const results = await Promise.all([pa, pb].map((p) => request(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/aprobar`, 'PATCH', {}, jefe, null)));
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      const reserved = await prisma.ordenes_Repuestos.aggregate({ where: { repuesto_id: r.id_repuesto, estado_aprobacion: 'APROBADO' }, _sum: { cantidad_usada: true } });
      assert.equal(reserved._sum.cantidad_usada, 1);
    });
  });
  test('Correcciones de repuestos: decisiones reversibles, entregas y devoluciones con historial', async (t) => {
    const path = (p, action) => `/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/${action}`;
    const available = async (r) => (await api('/jefe-tecnico/resumen')).catalogo.find((item) => item.id_repuesto === r.id_repuesto).stock_disponible;
    const history = async (o, p) => (await api(`/jefe-tecnico/ordenes/${o.id_orden}`)).intervenciones.filter((m) => m.datos_nuevos.id_detalle_repuesto === p.id_detalle_repuesto);
    const delivered = async () => {
      const o = await startedOrder(), r = await part(2), p = await ask(o, r, 2);
      await api(path(p, 'aprobar'), 'PATCH', {});
      const receipt = await api(path(p, 'entregar'), 'PATCH', {});
      return { o, r, p, receipt };
    };
    await t.test('retirar aprobación libera la reserva, conserva el trabajo y exige motivo', async () => {
      const o = await startedOrder(), r = await part(2), p = await ask(o, r, 2);
      const approved = await api(path(p, 'aprobar'), 'PATCH', {});
      assert.equal(await available(r), 0);
      await request(path(p, 'retirar-aprobacion'), 'PATCH', {}, jefe, 400);
      const summary = await api('/jefe-tecnico/resumen');
      assert.equal(summary.repuestos.find((item) => item.id_detalle_repuesto === p.id_detalle_repuesto).puede_retirar_aprobacion, true);
      const reset = await api(path(p, 'retirar-aprobacion'), 'PATCH', { motivo: 'Aprobación de la solicitud equivocada' });
      assert.equal(reset.estado_aprobacion, 'PENDIENTE'); assert.equal(reset.fecha_aprobacion, null); assert.equal(reset.usuario_aprobador_id, null);
      assert.equal(await available(r), 2); assert.equal((await prisma.repuestos.findUnique({ where: { id_repuesto: r.id_repuesto } })).stock_actual, 2);
      const [event] = await history(o, p); assert.equal(event.tipo, 'RETIRAR_APROBACION'); assert.equal(event.usuario_id, jefe.id_usuario);
      assert.equal(event.datos_anteriores.fecha_aprobacion, approved.fecha_aprobacion); assert.equal(event.datos_nuevos.estado_aprobacion, 'PENDIENTE');
      const unchanged = await prisma.ordenes.findUnique({ where: { id_orden: o.id_orden } });
      assert.equal(unchanged.fecha_inicio_reparacion.toISOString(), o.fecha_inicio_reparacion); assert.equal(unchanged.tecnico_id, tecnicoA.perfil.id_tecnico);
      const [audit] = await prisma.$queryRaw`SELECT usuario_id, observacion FROM "Auditoria_Movimientos" WHERE tabla = 'Ordenes_Repuestos' AND registro_pk->>'id_detalle_repuesto' = ${String(p.id_detalle_repuesto)} ORDER BY id_auditoria DESC LIMIT 1`;
      assert.equal(audit.usuario_id, jefe.id_usuario); assert.equal(audit.observacion, event.motivo);
      await request(path(p, 'retirar-aprobacion'), 'PATCH', { motivo: 'Duplicado' }, jefe, 409);
      await api(path(p, 'aprobar'), 'PATCH', {}); assert.equal(await available(r), 0);
    });
    await t.test('reabrir conserva el rechazo anterior y permite una nueva revisión', async () => {
      const o = await startedOrder(), r = await part(), p = await ask(o, r);
      await request(path(p, 'reabrir'), 'PATCH', { motivo: 'Todavía pendiente' }, jefe, 409);
      const rejected = await api(path(p, 'rechazar'), 'PATCH', { motivo: 'Rechazo equivocado' });
      await request(path(p, 'reabrir'), 'PATCH', {}, jefe, 400);
      const reopened = await api(path(p, 'reabrir'), 'PATCH', { motivo: 'La pieza sí corresponde a la reparación' });
      assert.equal(reopened.estado_aprobacion, 'PENDIENTE'); assert.equal(reopened.fecha_rechazo, null); assert.equal(reopened.motivo_rechazo, null);
      const [event] = await history(o, p); assert.equal(event.tipo, 'REABRIR_SOLICITUD'); assert.equal(event.datos_anteriores.motivo_rechazo, 'Rechazo equivocado');
      assert.equal(event.datos_anteriores.fecha_rechazo, rejected.fecha_rechazo);
      await api(path(p, 'aprobar'), 'PATCH', {});
      await request(path(p, 'reabrir'), 'PATCH', { motivo: 'Ya aprobada' }, jefe, 409);
    });
    await t.test('corregir una entrega exige confirmación y conserva la aprobación y la reserva', async () => {
      const { o, r, p, receipt } = await delivered();
      await request(path(p, 'retirar-aprobacion'), 'PATCH', { motivo: 'Pieza entregada' }, jefe, 409);
      for (const flag of [undefined, false, 'true']) await request(path(p, 'corregir-entrega'), 'PATCH', { motivo: 'Registro por error', entrega_no_realizada: flag }, jefe, 400);
      const corrected = await api(path(p, 'corregir-entrega'), 'PATCH', { motivo: 'La pieza todavía está en el almacén', entrega_no_realizada: true });
      assert.equal(corrected.estado_entrega, 'PENDIENTE'); assert.equal(corrected.fecha_entrega, null); assert.equal(corrected.usuario_entregador_id, null);
      assert.equal(corrected.estado_aprobacion, 'APROBADO'); assert.equal(corrected.fecha_aprobacion, receipt.fecha_aprobacion); assert.equal(await available(r), 0);
      const [event] = await history(o, p); assert.equal(event.tipo, 'CORREGIR_ENTREGA'); assert.equal(event.datos_anteriores.fecha_entrega, receipt.fecha_entrega);
      assert.equal(event.datos_anteriores.usuario_entregador_id, jefe.id_usuario); assert.equal(event.datos_nuevos.estado_entrega, 'PENDIENTE');
      await exception(o, closure, 409);
      await request(path(p, 'corregir-entrega'), 'PATCH', { motivo: 'Duplicado', entrega_no_realizada: true }, jefe, 409);
      await api(path(p, 'entregar'), 'PATCH', {}); await exception(o, closure);
    });
    await t.test('la devolución total libera la reserva sin sumar stock otra vez y vuelve a revisión', async () => {
      const { o, r, p, receipt } = await delivered();
      for (const flag of [undefined, false, 'true']) await request(path(p, 'devolver'), 'PATCH', { motivo: 'Retorno físico', devolucion_total_confirmada: flag }, jefe, 400);
      const returned = await api(path(p, 'devolver'), 'PATCH', { motivo: 'Pieza recibida de vuelta sin utilizar', devolucion_total_confirmada: true });
      assert.equal(returned.estado_aprobacion, 'PENDIENTE'); assert.equal(returned.estado_entrega, 'PENDIENTE'); assert.equal(returned.fecha_entrega, null);
      assert.equal(await available(r), 2); assert.equal((await prisma.repuestos.findUnique({ where: { id_repuesto: r.id_repuesto } })).stock_actual, 2);
      const [event] = await history(o, p); assert.equal(event.tipo, 'DEVOLUCION_REPUESTO'); assert.equal(event.datos_anteriores.fecha_entrega, receipt.fecha_entrega);
      assert.equal(event.datos_anteriores.cantidad_usada, 2); assert.equal(event.usuario_id, jefe.id_usuario);
      await request(path(p, 'devolver'), 'PATCH', { motivo: 'Duplicado', devolucion_total_confirmada: true }, jefe, 409);
      await exception(o, closure, 409);
      await api(path(p, 'rechazar'), 'PATCH', { motivo: 'La reparación ya no necesita esta pieza' }); await exception(o, closure);
    });
    await t.test('la corrección de pieza o cantidad conserva los valores originales', async () => {
      const o = await startedOrder(), r = await part(3), next = await part(3), p = await ask(o, r, 1);
      await api(path(p, 'aprobar'), 'PATCH', {});
      await request(path(p, 'corregir'), 'PATCH', { cantidad_usada: 1, motivo: 'Sin cambios' }, jefe, 409);
      await api(path(p, 'corregir'), 'PATCH', { repuesto_id: next.id_repuesto, cantidad_usada: 2, motivo: 'Modelo y cantidad comprobados' });
      const [event] = await history(o, p); assert.equal(event.tipo, 'CORRECCION_REPUESTO'); assert.equal(event.datos_anteriores.repuesto_id, r.id_repuesto);
      assert.equal(event.datos_nuevos.repuesto_id, next.id_repuesto); assert.equal(event.datos_nuevos.cantidad_usada, 2);
      assert.equal(await available(r), 3); assert.equal(await available(next), 1);
    });
    await t.test('el técnico y Secretaría no pueden ejecutar las correcciones del jefe', async () => {
      const { p } = await delivered();
      for (const action of ['retirar-aprobacion', 'reabrir', 'corregir-entrega', 'devolver']) for (const actor of [tecnicoA, secretaria]) {
        await request(path(p, action), 'PATCH', { motivo: 'Intento desde otro rol', entrega_no_realizada: true, devolucion_total_confirmada: true }, actor, 403);
      }
    });
    await t.test('una orden cerrada o facturada bloquea cualquier reversión y conserva su historial', async () => {
      const { o, p } = await delivered();
      await exception(o, closure);
      const assertBlocked = async () => {
        for (const action of ['retirar-aprobacion', 'reabrir', 'corregir-entrega', 'devolver']) await request(path(p, action), 'PATCH', { motivo: 'Trabajo cerrado', entrega_no_realizada: true, devolucion_total_confirmada: true }, jefe, 409);
        assert.equal((await history(o, p)).length, 0);
      };
      await assertBlocked();
      await prisma.facturas.create({ data: { orden_id: o.id_orden, monto_repuestos: 200, mano_obra: 0, subtotal: 200, impuestos: 0, total: 200 } });
      await assertBlocked();
      assert.equal((await prisma.ordenes_Repuestos.findUnique({ where: { id_detalle_repuesto: p.id_detalle_repuesto } })).estado_entrega, 'ENTREGADO');
    });
    await t.test('dos correcciones simultáneas de la misma entrega registran una sola acción', async () => {
      const { o, p } = await delivered();
      const results = await Promise.all([
        request(path(p, 'corregir-entrega'), 'PATCH', { motivo: 'Error de registro', entrega_no_realizada: true }, jefe, null),
        request(path(p, 'devolver'), 'PATCH', { motivo: 'Recepción física', devolucion_total_confirmada: true }, jefe, null),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]); assert.equal((await history(o, p)).length, 1);
    });
  });
  test('Irreparables: solo revisa solicitudes reales y conserva al responsable', async (t) => {
    await t.test('el técnico justifica, el jefe devuelve a reparación y puede confirmar una nueva solicitud', async () => {
      const o = await startedOrder(), id = o.id_orden, technicalUrl = `/tecnicos/ordenes/${id}/estado`, reviewUrl = `/jefe-tecnico/ordenes/${id}/irreparable`;
      await request(reviewUrl, 'PATCH', { decision: 'APROBADO', motivo: 'Sin solicitud' }, jefe, 409);
      const pending = await api(technicalUrl, 'PATCH', { estado: 'IRREPARABLE', observacion_final: 'Daño estructural de placa' }, tecnicoA);
      assert.equal(pending.irreparable_estado, 'PENDIENTE');
      assert.equal(pending.fecha_finalizacion, null);
      await request(reviewUrl, 'PATCH', { decision: 'RECHAZADO' }, jefe, 400);
      const returned = await api(reviewUrl, 'PATCH', { decision: 'RECHAZADO', motivo: 'Revisar una alternativa de reparación' });
      assert.equal(returned.estado, 'EN_REPARACION');
      assert.equal(returned.tecnico_id, tecnicoA.perfil.id_tecnico);
      assert.equal(returned.fecha_finalizacion, null);
      await api(technicalUrl, 'PATCH', { estado: 'IRREPARABLE', observacion_final: 'Alternativa descartada, placa fracturada' }, tecnicoA);
      const confirmed = await api(reviewUrl, 'PATCH', { decision: 'APROBADO', motivo: 'Daño físico confirmado' });
      assert.equal(confirmed.irreparable_estado, 'APROBADO');
      assert.equal(confirmed.usuario_revisor_irreparable_id, jefe.id_usuario);
      assert.ok(confirmed.fecha_revision_irreparable && confirmed.fecha_finalizacion);
      await request(reviewUrl, 'PATCH', { decision: 'RECHAZADO', motivo: 'Revisada' }, jefe, 409);
    });
  });
  test('Seguimiento: incluye pendientes asignados y su última actividad real', async () => {
    const old = new Date(Date.now() - 80 * 3600000);
    const d = await diag({ tecnico_id: tecnicoA.perfil.id_tecnico, estado_del_diagnostico: 'ASIGNADO', fecha_asignacion: old, fecha_hora: old });
    await prisma.historialDiagnosticos.updateMany({ where: { diagnostico_id: d.id_diagnostico }, data: { fecha_hora: old } });
    const summary = await api('/jefe-tecnico/resumen');
    const work = summary.trabajos.find((r) => r.tipo === 'diagnostico' && r.id === d.id_diagnostico);
    assert.ok(work.activo && work.horas_sin_avance >= 79);
    assert.equal(work.tecnico.id_tecnico, tecnicoA.perfil.id_tecnico);
    assert.ok(summary.indicadores.atrasados >= 1);
    assert.ok(summary.tecnicos.find((t) => t.id_tecnico === tecnicoA.perfil.id_tecnico).atrasados >= 1);
  });
}
