import test, { before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { S3Client } from '@aws-sdk/client-s3';

const databaseName = process.env.CTE_SECRETARIA_TEST_DATABASE;
if (!databaseName) {
  test('Secretaría: API y SQL requieren el ejecutor de base temporal', { skip: 'Use npm run test:secretaria:integracion' }, () => {});
} else {
  // Nunca permitir que una invocación manual pruebe sobre la base del taller.
  assert.match(databaseName, /^cte_secretaria_test_[0-9a-f]{32}$/);
  assert.equal(new URL(process.env.DATABASE_URL).pathname, `/${databaseName}`);
  assert.ok(['db', 'localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname));
  process.env.NODE_ENV = 'test';
  Object.assign(process.env, {
    R2_ACCOUNT_ID: '00000000000000000000000000000000', R2_BUCKET: 'secretaria-test',
    R2_ACCESS_KEY_ID: 'test-access-key', R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_ENDPOINT: 'https://00000000000000000000000000000000.r2.cloudflarestorage.com',
  });
  const objects = new Map();
  let storageFailure = null;
  mock.method(S3Client.prototype, 'send', async (command) => {
    assert.equal(command.input.Bucket, 'secretaria-test');
    if (storageFailure) throw Object.assign(new Error('Fallo simulado de R2'), { name: storageFailure });
    const { Key, Body } = command.input;
    switch (command.constructor.name) {
      case 'PutObjectCommand': objects.set(Key, Buffer.from(Body)); return {};
      case 'GetObjectCommand': {
        if (!objects.has(Key)) throw Object.assign(new Error('No existe'), { name: 'NoSuchKey' });
        return { Body: { transformToByteArray: async () => objects.get(Key) } };
      }
      case 'DeleteObjectCommand': objects.delete(Key); return {};
      default: throw new Error('Operación de almacenamiento no prevista');
    }
  });

  const { default: app } = await import('../../src/app/app.js');
  const { default: prisma } = await import('../../src/app/prismaClient.js');
  let referenceFailure = false;
  prisma.$use(async (params, next) => {
    if (referenceFailure && params.model === 'ArchivosServicio' && params.action === 'create') {
      throw new Error('Fallo de referencia simulado');
    }
    return next(params);
  });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA9sAAAAASUVORK5CYII=', 'base64');
  let server, baseUrl, token, deniedToken, userId;
  let sequence = 0;
  const unique = (label) => `${label} ${++sequence} ${randomUUID().slice(0, 8)}`;
  before(async () => {
    const user = await prisma.usuarios.create({ data: { nombre_usuario: 'secretaria_pruebas', contrasena_hash: 'sin-login', rol: 'Secretaria' } });
    userId = user.id_usuario;
    const denied = await prisma.usuarios.create({ data: { nombre_usuario: 'sin_permiso_pruebas', contrasena_hash: 'sin-login', rol: 'Visitante' } });
    token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '10m' });
    deniedToken = jwt.sign({ id: denied.id_usuario }, process.env.JWT_SECRET, { expiresIn: '10m' });
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });
  after(async () => {
    server?.closeAllConnections();
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    mock.restoreAll();
    objects.clear();
  });

  const api = async (route, { method = 'GET', body, bytes, headers = {}, auth = token, expected = 200 } = {}) => {
    const response = await fetch(`${baseUrl}${route}`, {
      method, signal: AbortSignal.timeout(10000),
      headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(bytes !== undefined ? { 'Content-Type': 'image/png' } : {}), ...headers },
      body: bytes ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const json = response.headers.get('content-type')?.includes('application/json');
    const payload = json ? await response.json() : Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, expected, `${method} ${route}: ${json ? JSON.stringify(payload) : `respuesta ${response.status}`}`);
    return { payload, headers: response.headers };
  };
  const post = async (route, body, expected = 201) => (await api(route, { method: 'POST', body, expected })).payload.data;
  const fixture = async (type = 'Laptop', diagnosisData = {}) => {
    const cliente = await prisma.clientes.create({ data: { nombre: unique('Cliente fixture'), telefono: String(90000000 + sequence) } });
    const equipo = await prisma.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: type, marca: 'Samsung', modelo: unique('Modelo') } });
    const diagnostico = await prisma.diagnosticos.create({ data: { equipo_id: equipo.id_equipo, falla_reportada: 'No enciende', ...diagnosisData } });
    return { cliente, equipo, diagnostico };
  };
  const ready = async () => fixture('Laptop', {
    estado_del_diagnostico: 'COMPLETADO', diagnostico_real: 'Fuente averiada', presupuesto_estimado: 500,
    estado_contacto: 'DOCUMENTO_ENVIADO', calidad_estado: 'APROBADO',
  });
  const orderFixture = async (state = 'PENDIENTE') => {
    const data = await ready();
    const orden = await prisma.ordenes.create({ data: { diagnostico_id: data.diagnostico.id_diagnostico, estado: state, monto_autorizado: 500 } });
    return { ...data, orden };
  };
  const photo = async (kind, id, type = 'FOTO_RECEPCION', options = {}) => api(`/archivos-servicio/${kind}/${id}`, {
    method: 'POST', bytes: png, expected: 201,
    ...options, headers: { 'X-Tipo-Archivo': type, 'X-File-Name': encodeURIComponent('frente del equipo.png'), ...options.headers },
  });

  test('Secretaría: sesión y acceso a sus operaciones', async (t) => {
    await t.test('sin sesión devuelve 401 y sin capacidad devuelve 403', async () => {
      for (const route of ['/clientes', '/equipos', '/secretaria/diagnostico', '/ordenes', '/facturas', '/compras', '/proveedores']) {
        await api(route, { auth: null, expected: 401 });
        await api(route, { auth: deniedToken, expected: 403 });
      }
    });
    await t.test('una cuenta desactivada deja de operar aunque conserve el token', async () => {
      await prisma.usuarios.update({ where: { id_usuario: userId }, data: { activo: false } });
      try { await api('/clientes', { expected: 401 }); }
      finally { await prisma.usuarios.update({ where: { id_usuario: userId }, data: { activo: true } }); }
    });
  });

  test('Secretaría: clientes y equipos', async (t) => {
    await t.test('rechaza clientes sin nombre o teléfono y evita teléfono duplicado', async () => {
      await post('/clientes', { telefono: '88112233' }, 400);
      await post('/clientes', { nombre: 'Cliente incompleto' }, 400);
      const body = { nombre: '  Cliente válido  ', telefono: ' 88112233 ', correo: ' ', direccion: ' ' };
      const cliente = await post('/clientes', body);
      assert.equal(cliente.nombre, 'Cliente válido');
      assert.equal(cliente.correo, null);
      assert.equal(cliente.direccion, null);
      await post('/clientes', body, 409);
      const updated = (await api(`/clientes/${cliente.id_cliente}`, { method: 'PUT', body: { nombre: 'Cliente editado', telefono: '88112233' } })).payload.data;
      assert.equal(updated.nombre, 'Cliente editado');
      await api(`/clientes/${cliente.id_cliente}`, { method: 'DELETE', expected: 204 });
      const result = (await api('/clientes?search=Cliente%20editado')).payload;
      assert.ok(!result.data.some((item) => item.id_cliente === cliente.id_cliente));
    });
    await t.test('selección por prefijo busca desde la primera letra y refina al escribir', async () => {
      await prisma.clientes.createMany({ data: ['Diana prefijo', 'Diego prefijo', 'Dora prefijo', 'Adriana prefijo'].map((nombre) => ({ nombre })) });
      const first = (await api('/clientes?search=d&searchMode=prefix')).payload.data.map((row) => row.nombre);
      assert.ok(first.includes('Diana prefijo') && first.includes('Dora prefijo'));
      assert.ok(!first.includes('Adriana prefijo'));
      const refined = (await api('/clientes?search=DI&searchMode=prefix')).payload.data.map((row) => row.nombre);
      assert.deepEqual(refined, ['Diana prefijo', 'Diego prefijo']);
    });
    await t.test('clientes carga solo 20 y la segunda página no repite registros', async () => {
      await prisma.clientes.createMany({ data: Array.from({ length: 21 }, (_, i) => ({ nombre: `Paginación cliente ${i}` })) });
      const first = (await api('/clientes?search=Paginaci%C3%B3n%20cliente')).payload;
      const second = (await api('/clientes?search=Paginaci%C3%B3n%20cliente&page=2')).payload;
      assert.equal(first.data.length, 20);
      assert.equal(first.meta.total, 21);
      assert.equal(first.meta.hasMore, true);
      assert.equal(second.data.length, 1);
      assert.equal(second.meta.hasMore, false);
      assert.ok(!first.data.some((row) => row.id_cliente === second.data[0].id_cliente));
    });
    await t.test('crea, edita y elimina un equipo asociado al cliente correcto', async () => {
      const cliente = await post('/clientes', { nombre: unique('Cliente equipo'), telefono: String(88000000 + sequence) });
      await post('/equipos', { tipo: 'Monitor' }, 400);
      const equipo = await post('/equipos', { cliente_id: cliente.id_cliente, tipo: 'monitor', marca: ' Samsung ', modelo: 'G5', numero_serie: ' serie-123 ' });
      assert.equal(equipo.cliente_id, cliente.id_cliente);
      assert.equal(equipo.tipo, 'Monitor');
      assert.equal(equipo.numero_serie, 'serie-123');
      const updated = (await api(`/equipos/${equipo.id_equipo}`, { method: 'PUT', body: { cliente_id: cliente.id_cliente, tipo: 'Monitor', marca: 'Samsung', modelo: 'G7' } })).payload.data;
      assert.equal(updated.modelo, 'G7');
      await api(`/equipos/${equipo.id_equipo}`, { method: 'DELETE', expected: 204 });
      assert.equal(await prisma.equipos.findUnique({ where: { id_equipo: equipo.id_equipo } }), null);
    });
  });

  test('Secretaría: flujo de atención pagina, busca y filtra sin cargar el historial completo', async () => {
    const prefix = unique('Flujo paginado');
    for (const [index, estado] of ['EN_REVISION', 'COMPLETADO', 'PENDIENTE'].entries()) {
      const cliente = await prisma.clientes.create({ data: { nombre: `${prefix} ${index}`, telefono: String(92000000 + sequence + index) } });
      const equipo = await prisma.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: 'Laptop', marca: 'Prueba' } });
      await prisma.diagnosticos.create({ data: { equipo_id: equipo.id_equipo, estado_del_diagnostico: estado, falla_reportada: 'Falla de prueba' } });
    }
    const query = `search=${encodeURIComponent(prefix)}&pageSize=2`;
    const first = (await api(`/flujo-atencion?${query}&page=1`)).payload;
    const defaultPage = (await api(`/flujo-atencion?search=${encodeURIComponent(prefix)}`)).payload;
    assert.equal(defaultPage.meta.pageSize, 20);
    assert.equal(first.data.length, 2);
    assert.equal(first.meta.resumen.todos, 3);
    assert.equal(first.meta.hasMore, true);
    const second = (await api(`/flujo-atencion?${query}&page=2`)).payload;
    assert.equal(second.data.length, 1);
    assert.equal(second.meta.hasMore, false);
    assert.equal(new Set([...first.data, ...second.data].map((item) => item.id)).size, 3);
    const filtered = (await api(`/flujo-atencion?${query}&filtro=listos-orden`)).payload;
    assert.equal(filtered.data.length, 1);
    assert.equal(filtered.data[0].filtro, 'listos-orden');
    await api('/flujo-atencion?filtro=invalido', { expected: 400 });
  });

  test('Recepción: cada reingreso del mismo equipo conserva su propia orden y cuenta como ingreso', async () => {
    const before = (await api('/flujo-atencion/resumen-recepcion')).payload.data;
    const prefix = unique('Equipo con dos visitas');
    const cliente = await prisma.clientes.create({ data: { nombre: prefix, telefono: String(93000000 + sequence) } });
    const equipo = await prisma.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: 'Laptop', marca: 'Prueba' } });
    const previousDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const anterior = await prisma.diagnosticos.create({ data: {
      equipo_id: equipo.id_equipo, fecha_hora: previousDate, falla_reportada: 'Pantalla rota', estado_del_diagnostico: 'COMPLETADO',
    } });
    const ordenAnterior = await prisma.ordenes.create({ data: {
      diagnostico_id: anterior.id_diagnostico, estado: 'ENTREGADO', fecha_ingreso: previousDate, fecha_entrega: previousDate,
    } });
    const actual = await prisma.diagnosticos.create({ data: {
      equipo_id: equipo.id_equipo, falla_reportada: 'No carga', estado_del_diagnostico: 'COMPLETADO',
    } });
    const ordenActual = await prisma.ordenes.create({ data: {
      diagnostico_id: actual.id_diagnostico, estado: 'EN_REPARACION',
    } });

    const query = `search=${encodeURIComponent(prefix)}&pageSize=1`;
    const first = (await api(`/flujo-atencion?${query}&page=1`)).payload;
    const second = (await api(`/flujo-atencion?${query}&page=2`)).payload;
    assert.equal(first.meta.resumen.todos, 2);
    assert.equal(first.meta.hasMore, true);
    assert.equal(second.meta.hasMore, false);
    assert.equal(first.data[0].orden.id_orden, ordenActual.id_orden);
    assert.equal(first.data[0].diagnostico.falla_reportada, 'No carga');
    assert.equal(second.data[0].orden.id_orden, ordenAnterior.id_orden);
    assert.equal(second.data[0].diagnostico.falla_reportada, 'Pantalla rota');
    assert.equal(first.data[0].equipo.id_equipo, second.data[0].equipo.id_equipo);

    const after = (await api('/flujo-atencion/resumen-recepcion')).payload.data;
    assert.equal(after.total, before.total + 2);
    assert.equal(after.semana, before.semana + 1);
    assert.equal(after.mes, before.mes + 1);
  });

  test('Secretaría: recepción y actualización de diagnósticos', async (t) => {
    await t.test('no crea diagnóstico sin equipo ni falla y rechaza presupuesto negativo', async () => {
      const { equipo } = await fixture();
      await post('/secretaria/diagnostico/create', { falla_reportada: 'Falla' }, 400);
      await post('/secretaria/diagnostico/create', { equipo_id: equipo.id_equipo, falla_reportada: ' ' }, 400);
      await post('/secretaria/diagnostico/create', { equipo_id: equipo.id_equipo, falla_reportada: 'Falla', presupuesto_estimado: -1 }, 400);
    });
    await t.test('monitor neutraliza cargador y acceso; laptop acepta los entregados', async () => {
      for (const [type, expectedCharger, expectedAccess] of [['Monitor', 'NO_INCLUIDO', 'NO_REQUIERE'], ['Laptop', 'ENTREGADO', 'ENTREGADO']]) {
        const { equipo } = await fixture(type);
        const created = await post('/secretaria/diagnostico/create', { equipo_id: equipo.id_equipo, falla_reportada: 'Imagen intermitente', deja_cargador: true, estado_cargador: 'ENTREGADO', estado_acceso: 'ENTREGADO', detalle_accesorios: ' ' });
        assert.equal(created.estado_cargador, expectedCharger);
        assert.equal(created.deja_cargador, type === 'Laptop');
        assert.equal(created.estado_acceso, expectedAccess);
        assert.equal(created.detalle_accesorios, null);
      }
    });
    await t.test('editar estado conserva etiquetas, checks históricos y fecha de finalización', async () => {
      const { equipo, diagnostico } = await fixture('Monitor antiguo', { deja_cargador: true, estado_cargador: 'ENTREGADO', estado_acceso: 'ENTREGADO' });
      const first = (await api(`/secretaria/diagnostico/${diagnostico.id_diagnostico}`, { method: 'PUT', body: { estado_del_diagnostico: 'COMPLETADO', diagnostico_real: 'Revisado', presupuesto_estimado: 300 } })).payload.data;
      const second = (await api(`/secretaria/diagnostico/${diagnostico.id_diagnostico}`, { method: 'PUT', body: { observaciones_recepcion: 'Observación añadida' } })).payload.data;
      assert.equal(second.estado_cargador, 'ENTREGADO');
      assert.equal(second.deja_cargador, true);
      assert.equal(second.estado_acceso, 'ENTREGADO');
      assert.equal(second.fecha_completado, first.fecha_completado);
      assert.equal((await prisma.equipos.findUnique({ where: { id_equipo: equipo.id_equipo } })).tipo, 'Monitor antiguo');
    });
    await t.test('cambiar de laptop a monitor reinicia únicamente los campos que no aplican', async () => {
      const laptop = await fixture('Laptop', { deja_cargador: true, estado_cargador: 'ENTREGADO', estado_acceso: 'ENTREGADO' });
      const monitor = await fixture('Monitor');
      const updated = (await api(`/secretaria/diagnostico/${laptop.diagnostico.id_diagnostico}`, { method: 'PUT', body: { equipo_id: monitor.equipo.id_equipo } })).payload.data;
      assert.equal(updated.deja_cargador, false);
      assert.equal(updated.estado_cargador, 'NO_INCLUIDO');
      assert.equal(updated.estado_acceso, 'NO_REQUIERE');
      assert.equal(updated.falla_reportada, 'No enciende');
    });
    await t.test('PDF incompleto se rechaza y diagnóstico listo devuelve un PDF válido', async () => {
      const pending = await fixture();
      await api(`/secretaria/diagnostico/${pending.diagnostico.id_diagnostico}/documento`, { expected: 409 });
      const completed = await ready();
      const result = await api(`/secretaria/diagnostico/${completed.diagnostico.id_diagnostico}/documento`);
      assert.equal(result.headers.get('content-type'), 'application/pdf');
      assert.equal(result.payload.subarray(0, 5).toString(), '%PDF-');
    });
  });

  test('Secretaría: fotografías durante creación y edición', async (t) => {
    await t.test('agregar otra foto al editar conserva la anterior y ambas se leen', async () => {
      const { equipo, diagnostico } = await fixture('Monitor');
      const id = diagnostico.id_diagnostico;
      const first = (await photo('diagnosticos', id)).payload.data;
      await api(`/secretaria/diagnostico/${id}`, { method: 'PUT', body: { observaciones_recepcion: 'Nueva revisión' } });
      const second = (await photo('diagnosticos', id, 'FOTO_DIAGNOSTICO')).payload.data;
      const list = (await api(`/archivos-servicio/diagnosticos/${id}`)).payload.data;
      assert.deepEqual(new Set(list.map((item) => item.id_archivo)), new Set([first.id_archivo, second.id_archivo]));
      const records = await prisma.archivosServicio.findMany({ where: { diagnostico_id: id }, orderBy: { id_archivo: 'asc' } });
      const folder = `fotos/equipos/monitor-samsung-${equipo.modelo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-equipo-${equipo.id_equipo}`;
      assert.ok(records[0].ruta_archivo.startsWith(`${folder}/recepcion/`));
      assert.ok(records[1].ruta_archivo.startsWith(`${folder}/diagnostico/`));
      assert.notEqual(records[0].ruta_archivo, records[1].ruta_archivo);
      for (const { id_archivo } of list) {
        const content = await api(`/archivos-servicio/${id_archivo}/contenido`);
        assert.deepEqual(content.payload, png);
        assert.equal(content.headers.get('cache-control'), 'private, no-store');
      }
      await api(`/archivos-servicio/${first.id_archivo}/contenido`, { auth: null, expected: 401 });
      await api(`/archivos-servicio/${first.id_archivo}/contenido`, { auth: deniedToken, expected: 403 });
    });
    await t.test('rechaza contenido falso, etapa incorrecta y archivo superior a 5 MB', async () => {
      const { diagnostico } = await fixture();
      const id = diagnostico.id_diagnostico;
      const beforeCount = objects.size;
      await photo('diagnosticos', id, 'FOTO_RECEPCION', { bytes: Buffer.from('No es PNG'), expected: 400 });
      await photo('diagnosticos', id, 'FOTO_ENTREGA', { expected: 400 });
      await photo('diagnosticos', id, 'FOTO_RECEPCION', { bytes: Buffer.alloc(5 * 1024 * 1024 + 1), expected: 413 });
      assert.equal(objects.size, beforeCount);
      assert.equal(await prisma.archivosServicio.count({ where: { diagnostico_id: id } }), 0);
    });
    await t.test('fallo de almacenamiento no crea referencia y se puede reintentar', async () => {
      const { diagnostico } = await fixture();
      storageFailure = 'AccessDenied';
      try { await photo('diagnosticos', diagnostico.id_diagnostico, 'FOTO_RECEPCION', { expected: 503 }); }
      finally { storageFailure = null; }
      assert.equal(await prisma.archivosServicio.count({ where: { diagnostico_id: diagnostico.id_diagnostico } }), 0);
      await photo('diagnosticos', diagnostico.id_diagnostico);
      assert.equal(await prisma.archivosServicio.count({ where: { diagnostico_id: diagnostico.id_diagnostico } }), 1);
    });
    await t.test('si falla guardar la referencia, elimina el objeto recién subido', async () => {
      const { diagnostico } = await fixture();
      const beforeCount = objects.size;
      referenceFailure = true;
      try { await photo('diagnosticos', diagnostico.id_diagnostico, 'FOTO_RECEPCION', { expected: 500 }); }
      finally { referenceFailure = false; }
      assert.equal(objects.size, beforeCount);
      assert.equal(await prisma.archivosServicio.count({ where: { diagnostico_id: diagnostico.id_diagnostico } }), 0);
    });
  });

  test('Secretaría: avisos pendientes se recuperan sin conexión y las lecturas se limitan a cada cuenta', async () => {
    const { notifyRole } = await import('../../src/services/notifications.js');
    const other = await prisma.usuarios.create({ data: { nombre_usuario: unique('Secretaria avisos'), rol: 'Secretaria', contrasena_hash: 'sin-login' } });
    const otherToken = jwt.sign({ id: other.id_usuario }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const technical = await prisma.usuarios.create({ data: { nombre_usuario: unique('Tecnico avisos'), rol: 'Tecnico', contrasena_hash: 'sin-login' } });
    const technicalToken = jwt.sign({ id: technical.id_usuario }, process.env.JWT_SECRET, { expiresIn: '10m' });
    // Esta suite no inicializa Socket.IO: no depende de que haya un módulo conectado.
    await notifyRole('Secretaria', { type: 'diagnostico_completado', title: 'Informe disponible', message: 'Aviso de prueba sin conexión', entity: { kind: 'diagnostico', id: 999 } });
    const first = (await api('/notificaciones')).payload.data, second = (await api('/notificaciones', { auth: otherToken })).payload.data;
    const notice = first.find((row) => row.message === 'Aviso de prueba sin conexión');
    assert.ok(notice); assert.ok(second.some((row) => row.id === notice.id));
    assert.equal((await api('/notificaciones')).payload.data.find((row) => row.id === notice.id).message, notice.message);
    assert.equal((await api('/notificaciones', { auth: technicalToken })).payload.data.length, 0);
    assert.equal((await api('/notificaciones/leidas', { auth: technicalToken, method: 'PATCH', body: { ids: [notice.id] } })).payload.data.leidas, 0);
    await api('/notificaciones/leidas', { method: 'PATCH', body: { ids: [notice.id] } });
    assert.ok(!(await api('/notificaciones')).payload.data.some((row) => row.id === notice.id));
    assert.ok((await api('/notificaciones', { auth: otherToken })).payload.data.some((row) => row.id === notice.id));
    await api('/notificaciones/leidas', { method: 'PATCH', body: { ids: ['id inválido'] }, expected: 400 });
  });
  test('Secretaría: la orden admite piezas aunque se envíe la modalidad antigua sin piezas', async () => {
    const { orden } = await orderFixture();
    const changed = (await api(`/ordenes/${orden.id_orden}`, { method: 'PUT', body: { requiere_piezas: false } })).payload.data;
    assert.equal(changed.requiere_piezas, true);
    const category = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: unique('Pieza modalidad'), electronico: 'Laptop' } });
    const part = await prisma.repuestos.create({ data: { nombre: unique('Fuente modalidad'), tipo_repuesto_id: category.id_tipo_repuesto, stock_actual: 1 } });
    await prisma.ordenes_Repuestos.create({ data: { orden_id: orden.id_orden, repuesto_id: part.id_repuesto, cantidad_usada: 1 } });
    await api(`/ordenes/${orden.id_orden}`, { method: 'PUT', body: { requiere_piezas: false } });
    assert.equal((await prisma.ordenes.findUnique({ where: { id_orden: orden.id_orden } })).requiere_piezas, true);
    const closed = await orderFixture('FINALIZADO');
    await api(`/ordenes/${closed.orden.id_orden}`, { method: 'PUT', body: { requiere_piezas: false } });
  });
  test('Secretaría: informe PDF conserva el acceso administrativo y rechaza un diagnóstico incompleto', async () => {
    const pending = await fixture();
    await api(`/secretaria/diagnostico/${pending.diagnostico.id_diagnostico}/documento`, { expected: 409 });
    const completed = await ready();
    const result = await api(`/secretaria/diagnostico/${completed.diagnostico.id_diagnostico}/documento`);
    assert.equal(result.headers.get('content-type'), 'application/pdf'); assert.equal(result.payload.subarray(0, 5).toString(), '%PDF-');
    await api(`/secretaria/diagnostico/${completed.diagnostico.id_diagnostico}/documento`, { auth: deniedToken, expected: 403 });
  });
  test('Secretaría: nueva orden, contacto, retiro y cancelación', async (t) => {
    await t.test('nueva orden exige diagnóstico listo, informe, presupuesto, monto y contacto', async () => {
      const pending = await fixture();
      await post('/ordenes', { diagnostico_id: pending.diagnostico.id_diagnostico, monto_autorizado: 500 }, 409);
      const missingReport = await fixture('Laptop', { estado_del_diagnostico: 'COMPLETADO', calidad_estado: 'APROBADO', presupuesto_estimado: 500 });
      await post('/ordenes', { diagnostico_id: missingReport.diagnostico.id_diagnostico, monto_autorizado: 500 }, 400);
      await prisma.diagnosticos.update({ where: { id_diagnostico: missingReport.diagnostico.id_diagnostico }, data: { diagnostico_real: 'Informe sin presupuesto', presupuesto_estimado: 0 } });
      await post('/ordenes', { diagnostico_id: missingReport.diagnostico.id_diagnostico, monto_autorizado: 500 }, 400);
      const prepared = await ready();
      for (const amount of [undefined, 0, -10]) await post('/ordenes', { diagnostico_id: prepared.diagnostico.id_diagnostico, monto_autorizado: amount }, 400);
      await prisma.diagnosticos.update({ where: { id_diagnostico: prepared.diagnostico.id_diagnostico }, data: { estado_contacto: 'PENDIENTE_CONTACTAR' } });
      await post('/ordenes', { diagnostico_id: prepared.diagnostico.id_diagnostico, monto_autorizado: 500 }, 400);
    });
    await t.test('un presupuesto USD se conserva y la orden requiere un monto autorizado explícito en NIO', async () => {
      const { diagnostico } = await fixture('Laptop', { estado_del_diagnostico: 'COMPLETADO', calidad_estado: 'APROBADO', diagnostico_real: 'Informe presupuesto USD', presupuesto_estimado: 125.50, moneda_presupuesto: 'USD', estado_contacto: 'DOCUMENTO_ENVIADO' });
      const id = diagnostico.id_diagnostico;
      const available = (await api('/ordenes/diagnosticos-listos?search=Informe%20presupuesto%20USD')).payload.data;
      assert.equal(available.find((row) => row.id_diagnostico === id).moneda_presupuesto, 'USD');
      await api(`/secretaria/diagnostico/${id}`, { method: 'PUT', body: { moneda_presupuesto: 'EUR' }, expected: 400 });
      await post('/ordenes', { diagnostico_id: id }, 400);
      assert.equal(await prisma.ordenes.count({ where: { diagnostico_id: id } }), 0);
      const orden = await post('/ordenes', { diagnostico_id: id, monto_autorizado: 4500, requiere_piezas: false });
      assert.equal(Number(orden.monto_autorizado), 4500);
      assert.equal(orden.diagnostico.moneda_presupuesto, 'USD'); assert.equal(Number(orden.diagnostico.presupuesto_estimado), 125.50);
    });
    await t.test('crear orden registra autorización, evita duplicado y conserva historial', async () => {
      const { diagnostico } = await fixture('Laptop', { estado_del_diagnostico: 'COMPLETADO', calidad_estado: 'APROBADO', diagnostico_real: 'Fuente averiada', presupuesto_estimado: 500 });
      const contactRoute = `/secretaria/diagnostico/${diagnostico.id_diagnostico}/contacto`;
      const contact = (await api(contactRoute, { method: 'PATCH', body: { estado_contacto: 'DOCUMENTO_ENVIADO' } })).payload.data;
      assert.ok(contact.fecha_envio_documento);
      await api(contactRoute, { method: 'PATCH', body: { estado_contacto: 'ESPERANDO_RESPUESTA' } });
      const body = { diagnostico_id: diagnostico.id_diagnostico, monto_autorizado: 450.25, requiere_piezas: false };
      const orden = await post('/ordenes', body);
      assert.equal(Number(orden.monto_autorizado), 450.25);
      const approved = await prisma.diagnosticos.findUnique({ where: { id_diagnostico: diagnostico.id_diagnostico } });
      assert.equal(approved.estado_contacto, 'APROBADO');
      assert.equal(approved.Estado_aprobacion, 'Aprobado');
      await post('/ordenes', body, 409);
      assert.equal(await prisma.ordenes.count({ where: { diagnostico_id: diagnostico.id_diagnostico } }), 1);
      const history = (await api(`/ordenes/${orden.id_orden}/historial`)).payload.data;
      assert.equal(history.length, 1);
      assert.equal(history[0].usuario_id, userId);
      const available = (await api('/ordenes/diagnosticos-listos')).payload;
      assert.ok(!available.data.some((row) => row.id_diagnostico === diagnostico.id_diagnostico));
    });
    await t.test('diagnósticos disponibles y órdenes respetan páginas de 20', async () => {
      const { equipo } = await fixture();
      const rows = await prisma.diagnosticos.createManyAndReturn({ data: Array.from({ length: 21 }, () => ({ equipo_id: equipo.id_equipo, falla_reportada: 'Grupo paginado listo', estado_del_diagnostico: 'COMPLETADO', calidad_estado: 'APROBADO', diagnostico_real: 'Informe paginado', presupuesto_estimado: 100 })) });
      const first = (await api('/ordenes/diagnosticos-listos?search=Grupo%20paginado%20listo')).payload;
      const second = (await api('/ordenes/diagnosticos-listos?search=Grupo%20paginado%20listo&page=2')).payload;
      assert.equal(first.data.length, 20);
      assert.equal(first.meta.total, 21);
      assert.equal(second.data.length, 1);
      await prisma.ordenes.createMany({ data: rows.map((row) => ({ diagnostico_id: row.id_diagnostico, monto_autorizado: 100 })) });
      const orders = (await api('/ordenes')).payload;
      assert.equal(orders.data.length, 20);
      assert.equal(orders.meta.pageSize, 20);
      assert.equal(orders.meta.hasMore, true);
    });
    await t.test('retiro sin reparar exige rechazo, persona y foto de salida', async () => {
      const { diagnostico } = await ready();
      const id = diagnostico.id_diagnostico;
      await photo('diagnosticos', id, 'FOTO_SALIDA_SIN_REPARAR', { expected: 409 });
      await api(`/secretaria/diagnostico/${id}/contacto`, { method: 'PATCH', body: { estado_contacto: 'APROBADO' }, expected: 400 });
      await api(`/secretaria/diagnostico/${id}/contacto`, { method: 'PATCH', body: { estado_contacto: 'RECHAZADO', observacion_respuesta: 'Cliente rechaza' } });
      await api(`/secretaria/diagnostico/${id}/retiro`, { method: 'PATCH', body: {}, expected: 400 });
      await api(`/secretaria/diagnostico/${id}/retiro`, { method: 'PATCH', body: { persona_recibe_retiro: 'Cliente' }, expected: 409 });
      await photo('diagnosticos', id, 'FOTO_SALIDA_SIN_REPARAR');
      await post('/facturas/diagnosticos', { diagnostico_id: id, monto_diagnostico: 100, metodo_pago: 'Efectivo' });
      const retired = (await api(`/secretaria/diagnostico/${id}/retiro`, { method: 'PATCH', body: { persona_recibe_retiro: 'Cliente' } })).payload.data;
      assert.equal(retired.estado_equipo, 'RETIRADO_SIN_REPARAR');
      assert.ok(retired.fecha_retiro_sin_reparar);
      await api(`/secretaria/diagnostico/${id}/retiro`, { method: 'PATCH', body: { persona_recibe_retiro: 'Cliente' }, expected: 409 });
    });
    await t.test('cancelación exige motivo y una orden cerrada no acepta edición ni borrado', async () => {
      const { orden } = await orderFixture();
      await api(`/ordenes/${orden.id_orden}/cancelar`, { method: 'PATCH', body: {}, expected: 400 });
      const cancelled = (await api(`/ordenes/${orden.id_orden}/cancelar`, { method: 'PATCH', body: { motivo_cancelacion: 'Cliente cancela' } })).payload.data;
      assert.equal(cancelled.estado, 'CANCELADO');
      assert.ok(cancelled.fecha_cancelacion);
      await api(`/ordenes/${orden.id_orden}`, { method: 'PUT', body: { prioridad: 'Alta' }, expected: 409 });
      await api(`/ordenes/${orden.id_orden}`, { method: 'DELETE', expected: 409 });
    });
  });

  test('Secretaría: proveedores, categorías, repuestos y compras', async (t) => {
    await t.test('normaliza proveedores, rechaza correo y duplicado y permite desactivar', async () => {
      await post('/proveedores', { nombre: 'Proveedor correo', correo: 'incorrecto' }, 400);
      const proveedor = await post('/proveedores', { nombre: '  Tienda   electrónica ', web: 'example.test' });
      assert.equal(proveedor.nombre, 'Tienda electrónica');
      assert.equal(proveedor.web, 'https://example.test');
      await post('/proveedores', { nombre: 'TIENDA ELECTRÓNICA' }, 409);
      await api(`/proveedores/${proveedor.id_proveedor}`, { method: 'PUT', body: { nombre: 'Proveedor editado', telefono: '88889999' } });
      await api(`/proveedores/${proveedor.id_proveedor}`, { method: 'DELETE', expected: 204 });
      assert.equal((await api('/proveedores?search=Proveedor%20editado')).payload.data.length, 0);
    });
    await t.test('repuesto exige categoría y cantidades válidas; categoría usada no se elimina', async () => {
      await post('/repuestos', { nombre: 'Cable sin categoría' }, 400);
      await post('/repuestos', { nombre: 'Cable inválido', categoria_nombre: 'Cables', costo_individual: -10 }, 400);
      await post('/repuestos', { nombre: 'Cable inválido', categoria_nombre: 'Cables', stock_minimo: -1 }, 400);
      const repuesto = await post('/repuestos', { nombre: unique('Cable'), categoria_nombre: 'Cables', ganancia_cordobas: 20 });
      assert.equal(repuesto.stock_actual, 0);
      assert.equal(repuesto.stock_minimo, 1);
      await api(`/tipos-repuesto/${repuesto.tipo_repuesto_id}`, { method: 'DELETE', expected: 409 });
      const tipo = await post('/tipos-repuesto', { nombre_tipo: unique('Tipo vacío') });
      await api(`/tipos-repuesto/${tipo.id_tipo_repuesto}`, { method: 'DELETE' });
    });
    await t.test('comprar incrementa stock, editar aplica solo la diferencia y el precio nuevo crea variante', async () => {
      const proveedor = await post('/proveedores', { nombre: unique('Proveedor compras') });
      const repuesto = await post('/repuestos', { nombre: unique('Pantalla compra'), categoria_nombre: 'Pantallas', ganancia_cordobas: 30 });
      const body = { repuesto_id: repuesto.id_repuesto, proveedor_id: proveedor.id_proveedor, cantidad: 5, costo_unitario: 100, metodo_pago: 'Efectivo' };
      await post('/compras', { ...body, cantidad: 0 }, 400);
      await post('/compras', { ...body, cantidad: 1.5 }, 400);
      await post('/compras', { ...body, costo_unitario: -1 }, 400);
      const compra = await post('/compras', body);
      assert.equal((await prisma.repuestos.findUnique({ where: { id_repuesto: repuesto.id_repuesto } })).stock_actual, 5);
      await api(`/compras/${compra.id_compra}`, { method: 'PUT', body: { ...body, cantidad: 7 } });
      assert.equal((await prisma.repuestos.findUnique({ where: { id_repuesto: repuesto.id_repuesto } })).stock_actual, 7);
      const variant = await post('/compras', { ...body, cantidad: 2, costo_unitario: 120 });
      assert.notEqual(variant.repuesto_id, repuesto.id_repuesto);
      assert.equal((await prisma.repuestos.findUnique({ where: { id_repuesto: repuesto.id_repuesto } })).stock_actual, 7);
      assert.equal((await prisma.repuestos.findUnique({ where: { id_repuesto: variant.repuesto_id } })).stock_actual, 2);
      const available = (await api('/repuestos?disponibles=1')).payload.data;
      assert.ok(available.some((row) => row.id_repuesto === repuesto.id_repuesto));
      assert.ok(available.every((row) => Number.isInteger(row.stock_actual)));
    });
  });

  test('Secretaría: facturación, garantía y entrega', async (t) => {
    await t.test('factura exige orden finalizada, pago válido e importes no negativos', async () => {
      const { orden } = await orderFixture();
      await post('/facturas', { orden_id: orden.id_orden, mano_obra: 100, metodo_pago: 'Efectivo' }, 409);
      await post('/facturas', { orden_id: orden.id_orden, mano_obra: -1, metodo_pago: 'Efectivo' }, 400);
      await post('/facturas', { orden_id: orden.id_orden, mano_obra: 100, metodo_pago: 'Inventado' }, 400);
      await photo('ordenes', orden.id_orden, 'FOTO_ENTREGA', { expected: 409 });
      await api(`/ordenes/${orden.id_orden}/entrega`, { method: 'PATCH', body: { persona_recibe: 'Cliente' }, expected: 409 });
    });
    await t.test('piezas pendientes bloquean; factura suma piezas aprobadas y descuenta una sola vez', async () => {
      const { orden } = await orderFixture('FINALIZADO');
      const category = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: unique('Facturación') } });
      const repuesto = await prisma.repuestos.create({ data: { tipo_repuesto_id: category.id_tipo_repuesto, nombre: 'Pieza aprobada', costo_individual: 100, ganancia_cordobas: 20, stock_actual: 10 } });
      await prisma.ordenes_Repuestos.create({ data: { orden_id: orden.id_orden, repuesto_id: repuesto.id_repuesto, cantidad_usada: 2, estado_aprobacion: 'APROBADO' } });
      const pending = await prisma.ordenes_Repuestos.create({ data: { orden_id: orden.id_orden, pieza_solicitada: 'No compatible' } });
      const body = { orden_id: orden.id_orden, monto_diagnostico: 50, mano_obra: 500, impuestos: 10, metodo_pago: 'Efectivo' };
      await post('/facturas', body, 409);
      await prisma.ordenes_Repuestos.update({ where: { id_detalle_repuesto: pending.id_detalle_repuesto }, data: { estado_aprobacion: 'DENEGADO', motivo_rechazo: 'No compatible' } });
      const factura = await post('/facturas', body);
      assert.equal(Number(factura.monto_repuestos), 240);
      assert.equal(Number(factura.subtotal), 790);
      assert.equal(Number(factura.total), 800);
      assert.equal((await prisma.repuestos.findUnique({ where: { id_repuesto: repuesto.id_repuesto } })).stock_actual, 8);
      await post('/facturas', body, 409);
      assert.equal((await prisma.repuestos.findUnique({ where: { id_repuesto: repuesto.id_repuesto } })).stock_actual, 8);
      const guarantee = await prisma.garantias.findUnique({ where: { factura_id: factura.id_factura } });
      assert.equal(guarantee.duracion_meses, 3);
      assert.equal(guarantee.fecha_inicio, null);
      assert.equal(guarantee.fecha_vencimiento, null);
    });
    await t.test('stock insuficiente revierte factura y conserva cantidad disponible', async () => {
      const { orden } = await orderFixture('FINALIZADO');
      const category = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: unique('Stock limitado') } });
      const repuesto = await prisma.repuestos.create({ data: { tipo_repuesto_id: category.id_tipo_repuesto, nombre: 'Pieza escasa', costo_individual: 100, stock_actual: 1 } });
      await prisma.ordenes_Repuestos.create({ data: { orden_id: orden.id_orden, repuesto_id: repuesto.id_repuesto, cantidad_usada: 2, estado_aprobacion: 'APROBADO' } });
      await post('/facturas', { orden_id: orden.id_orden, monto_diagnostico: 50, mano_obra: 100, metodo_pago: 'Efectivo' }, 409);
      assert.equal(await prisma.facturas.count({ where: { orden_id: orden.id_orden } }), 0);
      assert.equal((await prisma.repuestos.findUnique({ where: { id_repuesto: repuesto.id_repuesto } })).stock_actual, 1);
    });
    await t.test('entrega exige persona y foto; inicia garantía y bloquea segunda entrega o cancelación', async () => {
      const { orden } = await orderFixture('FINALIZADO');
      const factura = await post('/facturas', { orden_id: orden.id_orden, monto_diagnostico: 50, mano_obra: 500, impuestos: 0, metodo_pago: 'Efectivo' });
      const route = `/ordenes/${orden.id_orden}/entrega`;
      await api(route, { method: 'PATCH', body: {}, expected: 400 });
      await api(route, { method: 'PATCH', body: { persona_recibe: 'Cliente' }, expected: 409 });
      await photo('ordenes', orden.id_orden, 'FOTO_ENTREGA');
      const delivered = (await api(route, { method: 'PATCH', body: { persona_recibe: 'Cliente', observacion_entrega: 'Recibido conforme' } })).payload.data;
      assert.equal(delivered.estado, 'ENTREGADO');
      assert.equal(delivered.entregado_por_id, userId);
      const guarantee = await prisma.garantias.findUnique({ where: { factura_id: factura.id_factura } });
      assert.equal(guarantee.fecha_inicio.toISOString(), delivered.fecha_entrega);
      assert.ok(guarantee.fecha_vencimiento > guarantee.fecha_inicio);
      await api(route, { method: 'PATCH', body: { persona_recibe: 'Cliente' }, expected: 409 });
      await api(`/ordenes/${orden.id_orden}/cancelar`, { method: 'PATCH', body: { motivo_cancelacion: 'Intento posterior' }, expected: 409 });
      await post('/garantias', { factura_id: factura.id_factura, duracion_meses: 3 }, 409);
      const history = (await api(`/ordenes/${orden.id_orden}/historial`)).payload.data;
      assert.equal(history.at(-1).estado_nuevo, 'ENTREGADO');
      assert.equal(history.at(-1).usuario_id, userId);
    });
    await t.test('dashboard y garantía consultan datos del circuito de Secretaría', async () => {
      const dashboard = (await api('/secretaria/dashboard?periodo=month')).payload;
      assert.equal(dashboard.success, true);
      assert.ok(dashboard.stats && typeof dashboard.stats === 'object');
      const guarantees = (await api('/garantias')).payload;
      assert.ok(guarantees.data.length > 0);
      assert.equal(guarantees.meta.pageSize, 20);
    });
  });

  test('Secretaría: orden directa cobra reparación sin cargo de diagnóstico', async () => {
    const { equipo, cliente } = await fixture();
    const otroCliente = await prisma.clientes.create({ data: { nombre: unique('Otro cliente'), telefono: String(91000000 + sequence) } });
    await prisma.equipos.create({ data: { cliente_id: otroCliente.id_cliente, tipo: 'Pantalla', marca: 'LG', modelo: 'Prueba' } });
    const encontrados = (await api(`/clientes?search=${encodeURIComponent(cliente.nombre)}`)).payload.data;
    assert.ok(encontrados.some((row) => row.id_cliente === cliente.id_cliente));
    const equiposCliente = (await api(`/equipos?cliente_id=${cliente.id_cliente}`)).payload.data;
    assert.deepEqual(equiposCliente.map((row) => row.id_equipo), [equipo.id_equipo]);
    await post('/ordenes/directa', { equipo_id: equipo.id_equipo, falla_reportada: 'Cambio de conector', monto_autorizado: 400 }, 400);
    await post('/ordenes/directa', { cliente_id: otroCliente.id_cliente, equipo_id: equipo.id_equipo, falla_reportada: 'Cambio de conector', monto_autorizado: 400, autorizado: true }, 400);
    const usuarioTecnico = await prisma.usuarios.create({ data: { nombre_usuario: unique('Tecnico directo'), rol: 'Tecnico', contrasena_hash: 'sin-login' } });
    const tecnico = await prisma.tecnicos.create({ data: { usuario_id: usuarioTecnico.id_usuario, nombre: 'Técnico directo' } });
    await post('/ordenes/directa', { cliente_id: cliente.id_cliente, equipo_id: equipo.id_equipo, falla_reportada: 'Cambio de conector', monto_autorizado: 400, autorizado: true, tecnico_id: tecnico.id_tecnico }, 403);
    const orden = await post('/ordenes/directa', { cliente_id: cliente.id_cliente, equipo_id: equipo.id_equipo, falla_reportada: 'Cambio de conector', monto_autorizado: 400, autorizado: true });
    assert.equal(orden.diagnostico.origen_directo, true);
    assert.equal(orden.requiere_piezas, true);
    assert.equal(orden.tecnico_id, null);
    await api(`/ordenes/${orden.id_orden}`, { method: 'PUT', body: { tecnico_id: tecnico.id_tecnico }, expected: 403 });
    await post('/ordenes/directa', { equipo_id: equipo.id_equipo, falla_reportada: 'Cambio de conector', monto_autorizado: 400, autorizado: true }, 409);
    const usuarioJefe = await prisma.usuarios.create({ data: { nombre_usuario: unique('Jefe directo'), rol: 'TecnicoJefe', contrasena_hash: 'sin-login' } });
    const jefeToken = jwt.sign({ id: usuarioJefe.id_usuario }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const pendientes = (await api('/jefe-tecnico/resumen', { auth: jefeToken })).payload.data.trabajos;
    assert.ok(pendientes.some((row) => row.tipo === 'orden' && row.id === orden.id_orden && row.puede_asignar));
    const asignada = (await api(`/jefe-tecnico/ordenes/${orden.id_orden}/asignacion`, { method: 'POST', body: { tecnico_id: tecnico.id_tecnico }, auth: jefeToken })).payload.data;
    assert.equal(asignada.tecnico_id, tecnico.id_tecnico);
    await prisma.ordenes.update({ where: { id_orden: orden.id_orden }, data: { estado: 'FINALIZADO' } });
    await post('/facturas', { orden_id: orden.id_orden, monto_diagnostico: 100, mano_obra: 400, metodo_pago: 'Efectivo' }, 400);
    const factura = await post('/facturas', { orden_id: orden.id_orden, monto_diagnostico: 0, mano_obra: 400, metodo_pago: 'Efectivo' });
    assert.equal(Number(factura.total), 400);
    assert.equal(factura.diagnostico_id, orden.diagnostico_id);
    const listed = (await api('/facturas?search=' + encodeURIComponent(cliente.nombre))).payload.data;
    assert.ok(listed.some((row) => row.id_factura === factura.id_factura));
  });

  test('Secretaría: diagnóstico rechazado se cobra en factura propia, sin garantía', async () => {
    const { diagnostico } = await ready();
    await api(`/secretaria/diagnostico/${diagnostico.id_diagnostico}/contacto`, { method: 'PATCH', body: { estado_contacto: 'RECHAZADO' } });
    const available = (await api('/facturas/diagnosticos-disponibles')).payload.data;
    assert.ok(available.some((row) => row.id_diagnostico === diagnostico.id_diagnostico));
    const factura = await post('/facturas/diagnosticos', { diagnostico_id: diagnostico.id_diagnostico, monto_diagnostico: 150, impuestos: 22.5, metodo_pago: 'Tarjeta' });
    assert.equal(factura.orden_id, null);
    assert.equal(Number(factura.total), 172.5);
    assert.equal(await prisma.garantias.count({ where: { factura_id: factura.id_factura } }), 0);
    await post('/facturas/diagnosticos', { diagnostico_id: diagnostico.id_diagnostico, monto_diagnostico: 150, metodo_pago: 'Tarjeta' }, 409);
  });

  test('Secretaría: factura diagnósticos completados sin rechazo y omite cargos de diagnóstico en cero de la orden', async () => {
    for (const estado of ['COMPLETADO', 'DIAGNOSTICADO']) {
      const { diagnostico } = await fixture('Laptop', { estado_del_diagnostico: estado, calidad_estado: 'APROBADO', diagnostico_real: 'Pantalla averiada' });
      const disponibles = (await api('/facturas/diagnosticos-disponibles')).payload.data;
      assert.ok(disponibles.some((item) => item.id_diagnostico === diagnostico.id_diagnostico));
      await post('/facturas/diagnosticos', { diagnostico_id: diagnostico.id_diagnostico, monto_diagnostico: 0, metodo_pago: 'Efectivo' }, 400);
      const factura = await post('/facturas/diagnosticos', { diagnostico_id: diagnostico.id_diagnostico, monto_diagnostico: 125, metodo_pago: 'Efectivo' });
      assert.equal(Number(factura.total), 125);
      assert.equal(factura.orden_id, null);
      const listosParaOrden = (await api('/ordenes/diagnosticos-listos')).payload.data;
      assert.ok(!listosParaOrden.some((item) => item.id_diagnostico === diagnostico.id_diagnostico));
      await post('/facturas/diagnosticos', { diagnostico_id: diagnostico.id_diagnostico, monto_diagnostico: 125, metodo_pago: 'Efectivo' }, 409);
    }
    const { orden } = await orderFixture('FINALIZADO');
    const facturaOrden = await post('/facturas', { orden_id: orden.id_orden, monto_diagnostico: 0, mano_obra: 250, metodo_pago: 'Efectivo' });
    assert.equal(Number(facturaOrden.monto_diagnostico), 0);
    assert.equal(Number(facturaOrden.total), 250);
  });

  test('Secretaría: una orden irreparable factura diagnóstico y mano de obra sin piezas ni garantía', async () => {
    const { orden } = await orderFixture('IRREPARABLE');
    const factura = await post('/facturas', { orden_id: orden.id_orden, monto_diagnostico: 80, mano_obra: 200, metodo_pago: 'Efectivo' });
    assert.equal(Number(factura.monto_repuestos), 0);
    assert.equal(Number(factura.subtotal), 280);
    assert.equal(await prisma.garantias.count({ where: { factura_id: factura.id_factura } }), 0);
  });

  test('Secretaría: fotos del ticket se vinculan a la compra y se separan de las fotos de servicio', async () => {
    const proveedor = await post('/proveedores', { nombre: unique('Proveedor ticket') });
    const repuesto = await post('/repuestos', { nombre: unique('Pieza ticket'), categoria_nombre: 'Tickets' });
    const compra = await post('/compras', { repuesto_id: repuesto.id_repuesto, proveedor_id: proveedor.id_proveedor, cantidad: 1, costo_unitario: 15, metodo_pago: 'Efectivo', documento: 'T-123' });
    await api(`/compras/${compra.id_compra}/fotos`, { method: 'POST', bytes: Buffer.from('falso'), expected: 400 });
    const foto = (await api(`/compras/${compra.id_compra}/fotos`, { method: 'POST', bytes: png, headers: { 'X-File-Name': encodeURIComponent('ticket.png') }, expected: 201 })).payload.data;
    const stored = await prisma.archivosCompra.findUnique({ where: { id_archivo: foto.id_archivo } });
    assert.ok(stored.ruta_archivo.startsWith('documentos/compras/'));
    const purchaseRow = (await api('/compras?search=T-123')).payload.data.find((row) => row.id_compra === compra.id_compra);
    assert.equal(purchaseRow._count.archivos, 1);
    assert.equal((await api(`/compras/fotos?search=T-123`)).payload.data.some((row) => row.id_archivo === foto.id_archivo), true);
    assert.deepEqual((await api(`/compras/fotos/${foto.id_archivo}/contenido`)).payload, png);
    await api(`/compras/fotos/${foto.id_archivo}/contenido`, { auth: deniedToken, expected: 403 });
    const { diagnostico } = await fixture();
    const servicio = (await photo('diagnosticos', diagnostico.id_diagnostico)).payload.data;
    assert.ok((await api('/archivos-servicio/galeria')).payload.data.some((row) => row.id_archivo === servicio.id_archivo));
  });
}
