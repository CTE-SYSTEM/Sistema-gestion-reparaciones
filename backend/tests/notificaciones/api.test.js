import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

const databaseName = process.env.CTE_NOTIFICACIONES_TEST_DATABASE;
if (!databaseName) {
  test('Avisos: integración requiere una base temporal', { skip: 'Use test:notificaciones:integracion' }, () => {});
} else {
  assert.match(databaseName, /^cte_notificaciones_test_[0-9a-f]{32}$/);
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.pathname, `/${databaseName}`);
  assert.ok(['db', 'localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const { default: app } = await import('../../src/app/app.js');
  const { default: prisma } = await import('../../src/app/prismaClient.js');
  const { notifyRole, notifyJefeTecnico, notifyTecnico, initializeNotifications } = await import('../../src/services/notifications.js');
  let server, base, io, jefe, otroJefe, secretaria, tecnico, otroTecnico, inactive, admin;
  const account = async (name, rol, active = true) => {
    const user = await prisma.usuarios.create({ data: { nombre_usuario: name, rol, activo: active, contrasena_hash: 'sin-login-pruebas' } });
    return { ...user, token: jwt.sign({ id: user.id_usuario }, process.env.JWT_SECRET, { expiresIn: '10m' }) };
  };
  const api = async (route, { actor = jefe, method = 'GET', body, status = 200 } = {}) => {
    const response = await fetch(`${base}${route}`, { method, signal: AbortSignal.timeout(10000),
      headers: { ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data;
  };
  before(async () => {
    jefe = await account('jefe_avisos', 'TecnicoJefe'); otroJefe = await account('otro_jefe_avisos', 'TecnicoJefe');
    secretaria = await account('secretaria_avisos', 'Secretaria'); admin = await account('admin_avisos', 'admin_pro');
    inactive = await account('jefe_inactivo_avisos', 'TecnicoJefe', false);
    tecnico = await account('tecnico_avisos', 'Tecnico'); otroTecnico = await account('otro_tecnico_avisos', 'Tecnico');
    tecnico.perfil = await prisma.tecnicos.create({ data: { nombre: 'Técnico asignado', usuario_id: tecnico.id_usuario } });
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}/api`;
    // Las pruebas iniciales no inicializan Socket.IO ni abren una web.
  });
  after(async () => {
    if (io) await new Promise((resolve) => io.close(resolve));
    server?.closeAllConnections();
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });
  test('Avisos: un diagnóstico creado sin navegador guarda contexto y cada jefe confirma su propia lectura', async () => {
    const cliente = await prisma.clientes.create({ data: { nombre: 'Cliente de notificación' } });
    const equipo = await prisma.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: 'Laptop', marca: 'Lenovo', modelo: 'Prueba' } });
    const created = await api('/secretaria/diagnostico/create', { actor: secretaria, method: 'POST', body: { equipo_id: equipo.id_equipo, falla_reportada: 'No enciende', prioridad: 'Alta' }, status: 201 });
    const pending = (await api('/notificaciones')).data;
    const notice = pending.find((n) => n.entity?.id === created.data.id_diagnostico);
    assert.ok(notice); assert.equal(notice.title, 'Nuevo diagnóstico recibido');
    assert.ok(notice.message.includes('Laptop Lenovo Prueba')); assert.ok(notice.message.includes(cliente.nombre));
    assert.ok(notice.message.includes('Pendiente de asignar técnico')); assert.ok(notice.message.includes('Alta'));
    assert.equal(notice.severity, 'warning'); assert.equal(notice.destinatario_rol, 'tecnicojefe');
    assert.ok((await api('/notificaciones', { actor: otroJefe })).data.some((n) => n.id === notice.id));
    assert.equal(await prisma.notificaciones.count({ where: { usuario_id: inactive.id_usuario } }), 0);
    const read = await api('/notificaciones/leidas', { method: 'PATCH', body: { ids: [notice.id] } });
    assert.equal(read.data.leidas, 1);
    assert.ok(!(await api('/notificaciones')).data.some((n) => n.id === notice.id));
    assert.ok((await api('/notificaciones', { actor: otroJefe })).data.some((n) => n.id === notice.id));
    assert.ok((await prisma.notificaciones.findUnique({ where: { id_usuario_id: { id: notice.id, usuario_id: jefe.id_usuario } } })).leida_en);
    const informativo = await notifyJefeTecnico({ type: 'orden_estado', title: 'Cambio de estado', entity: { kind: 'orden', id: 999 } });
    assert.ok(!(await api('/notificaciones', { actor: otroJefe })).data.some((n) => n.id === informativo.id));
    await api(`/jefe-tecnico/diagnosticos/${created.data.id_diagnostico}/asignacion`, {
      method: 'POST', body: { tecnico_id: tecnico.perfil.id_tecnico },
    });
    assert.ok(!(await api('/notificaciones', { actor: otroJefe })).data.some((n) => n.id === notice.id));
  });
  test('Avisos: el técnico recupera su aviso sin socket y solo recibe el contenido técnico autorizado', async () => {
    const n = await notifyTecnico(tecnico.perfil, { type: 'diagnostico_asignado', title: 'Cliente privado', message: '83333333 contacto@example.test', cliente: 'Cliente privado', severity: 'privada',
      entity: { kind: 'diagnostico', id: 123, cliente: 'Cliente privado' } });
    assert.match(n.id, /^[0-9a-f-]{36}$/i);
    const loaded = (await api('/notificaciones', { actor: tecnico })).data.find((item) => item.id === n.id);
    assert.ok(loaded); assert.equal(loaded.title, 'Nuevo diagnóstico asignado');
    assert.ok(!JSON.stringify(loaded).includes('Cliente privado')); assert.ok(!JSON.stringify(loaded).includes('83333333'));
    assert.ok(!JSON.stringify(loaded).includes('contacto@example.test')); assert.equal(loaded.severity, 'info');
    assert.equal((await api('/notificaciones', { actor: otroTecnico })).total, 0);
    assert.equal((await api('/notificaciones/leidas', { actor: otroTecnico, method: 'PATCH', body: { ids: [n.id] } })).data.leidas, 0);
    assert.ok((await api('/notificaciones', { actor: tecnico })).data.some((item) => item.id === n.id));
    await api('/notificaciones', { actor: null, status: 401 });
    await api('/notificaciones/leidas', { method: 'PATCH', body: { ids: ['inválido'] }, status: 400 });
    const adminNotice = await notifyRole('Administrador', { type: 'prueba', title: 'Aviso administrativo', message: 'Contexto administrativo' });
    assert.ok((await api('/notificaciones', { actor: admin })).data.some((item) => item.id === adminNotice.id));
  });
  test('Avisos: más de 25 pendientes mantienen el total y las lecturas muestran el siguiente grupo', async () => {
    const before = (await api('/notificaciones', { actor: secretaria })).total;
    for (let i = 0; i < 31; i++) await notifyRole('Secretaria', { type: 'prueba', title: `Pendiente ${i}`, message: 'Aviso guardado' });
    const first = await api('/notificaciones', { actor: secretaria });
    assert.equal(first.data.length, 25); assert.equal(first.total, before + 31);
    const ids = first.data.map((item) => item.id);
    assert.equal((await api('/notificaciones/leidas', { actor: secretaria, method: 'PATCH', body: { ids } })).data.leidas, 25);
    const next = await api('/notificaciones', { actor: secretaria });
    assert.equal(next.total, before + 6); assert.ok(!next.data.some((item) => ids.includes(item.id)));
    assert.equal(await prisma.notificaciones.count({ where: { usuario_id: secretaria.id_usuario } }), before + 31);
  });
  test('Avisos: un cambio de rol protege los avisos anteriores y conserva los de Secretaría histórica', async () => {
    const legacyId = randomUUID();
    await prisma.notificaciones.create({ data: { id: legacyId, usuario_id: secretaria.id_usuario, contenido: { id: legacyId, title: 'Aviso histórico', message: 'Contacto exclusivo de recepción', timestamp: new Date().toISOString() } } });
    assert.ok((await api('/notificaciones', { actor: secretaria })).data.some((item) => item.id === legacyId));
    await prisma.usuarios.update({ where: { id_usuario: secretaria.id_usuario }, data: { rol: 'Tecnico' } });
    assert.equal((await api('/notificaciones', { actor: secretaria })).total, 0);
    assert.equal((await api('/notificaciones/leidas', { actor: secretaria, method: 'PATCH', body: { ids: [legacyId] } })).data.leidas, 0);
    await prisma.usuarios.update({ where: { id_usuario: secretaria.id_usuario }, data: { rol: 'Secretaria' } });
    assert.ok((await api('/notificaciones', { actor: secretaria })).data.some((item) => item.id === legacyId));
  });
  test('Avisos: entrega en vivo y recuperación posterior usan el mismo aviso guardado', async () => {
    io = initializeNotifications(server, []);
    const endpoint = base.replace(/\/api$/, '') + '/socket.io/?EIO=4&transport=polling';
    const handshake = await (await fetch(endpoint)).text();
    const poll = endpoint + '&sid=' + encodeURIComponent(JSON.parse(handshake.slice(1)).sid);
    await fetch(poll, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '40' + JSON.stringify({ token: tecnico.token }) });
    await (await fetch(poll, { signal: AbortSignal.timeout(5000) })).text();
    const notification = await notifyTecnico(tecnico.perfil, { type: 'orden_asignado', entity: { kind: 'orden', id: 321 } });
    const packets = (await (await fetch(poll, { signal: AbortSignal.timeout(5000) })).text()).split('\x1e');
    const packet = packets.find((value) => value.startsWith('42["notificacion",'));
    assert.ok(packet);
    const live = JSON.parse(packet.slice(2))[1];
    assert.equal(live.id, notification.id); assert.equal(live.title, 'Nueva reparación asignada');
    const stored = (await api('/notificaciones', { actor: tecnico })).data.find((item) => item.id === live.id);
    assert.deepEqual(stored, live);
    await fetch(poll, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '41\x1e1' });
    const offline = await notifyTecnico(tecnico.perfil, { type: 'prioridad_actualizada', entity: { kind: 'orden', id: 321 } });
    assert.ok((await api('/notificaciones', { actor: tecnico })).data.some((item) => item.id === offline.id));
  });
}
