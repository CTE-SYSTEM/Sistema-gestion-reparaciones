import test, { before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import { S3Client } from '@aws-sdk/client-s3';

const databaseName = process.env.CTE_TECNICO_TEST_DATABASE;
if (!databaseName) {
  test('Técnico: integración requiere una base temporal', { skip: 'Use npm run test:tecnico:integracion' }, () => {});
} else {
  assert.match(databaseName, /^cte_tecnico_test_[0-9a-f]{32}$/);
  assert.equal(new URL(process.env.DATABASE_URL).pathname, '/' + databaseName);
  Object.assign(process.env, { R2_ACCOUNT_ID: '00000000000000000000000000000000', R2_BUCKET: 'tecnico-test',
    R2_ACCESS_KEY_ID: 'test-key', R2_SECRET_ACCESS_KEY: 'test-secret', R2_ENDPOINT: 'https://00000000000000000000000000000000.r2.cloudflarestorage.com' });
  const objects = new Map();
  mock.method(S3Client.prototype, 'send', async (command) => {
    const { Key, Body } = command.input;
    if (command.constructor.name === 'PutObjectCommand') { objects.set(Key, Buffer.from(Body)); return {}; }
    if (command.constructor.name === 'GetObjectCommand') return { Body: { transformToByteArray: async () => objects.get(Key) } };
    if (command.constructor.name === 'DeleteObjectCommand') { objects.delete(Key); return {}; }
    throw new Error('Operación R2 inesperada');
  });
  const { default: app } = await import('../../src/app/app.js');
  const { default: prisma } = await import('../../src/app/prismaClient.js');
  const { initializeNotifications, notifyTecnico } = await import('../../src/services/notifications.js');
  let server, sockets, base, tecnico, otro, secretaria, jefe, sequence = 0;
  const account = async (nombre_usuario, rol) => {
    const u = await prisma.usuarios.create({ data: { nombre_usuario, rol, contrasena_hash: 'sin-login' } });
    return { ...u, token: jwt.sign({ id: u.id_usuario }, process.env.JWT_SECRET, { expiresIn: '10m' }) };
  };
  before(async () => {
    tecnico = await account('tecnico_privacidad', 'Tecnico'); otro = await account('otro_tecnico', 'Tecnico');
    secretaria = await account('recepcion_privacidad', 'Secretaria'); jefe = await account('jefe_privacidad', 'TecnicoJefe');
    tecnico.perfil = await prisma.tecnicos.create({ data: { nombre: 'Técnico principal', usuario_id: tecnico.id_usuario } });
    otro.perfil = await prisma.tecnicos.create({ data: { nombre: 'Otro técnico', usuario_id: otro.id_usuario } });
    server = app.listen(0, '127.0.0.1'); sockets = initializeNotifications(server, []);
    await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}/api`;
  });
  after(async () => { await new Promise((resolve) => sockets.close(resolve)); server.closeAllConnections(); await prisma.$disconnect(); mock.restoreAll(); });
  const request = async (url, { actor = tecnico, method = 'GET', body, bytes, headers = {}, status = 200 } = {}) => {
    const response = await fetch(base + url, { method, signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Bearer ' + actor.token, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: bytes || (body ? JSON.stringify(body) : undefined) });
    const json = response.headers.get('content-type')?.includes('application/json');
    const data = json ? await response.json() : Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, status, `${method} ${url}: ${json ? JSON.stringify(data) : 'imagen'}`);
    return { data, headers: response.headers };
  };
  const api = async (...args) => (await request(...args)).data;
  const fixture = async (data = {}) => {
    sequence += 1;
    const cliente = await prisma.clientes.create({ data: { nombre: 'José Secreto Apellido', telefono: String(80000000 + sequence), correo: `privado${sequence}@example.com`, direccion: 'Dirección reservada 124', contacto_secundario: 'Contacto Familiar Reservado' } });
    const equipo = await prisma.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: 'Laptop', marca: 'Prueba', modelo: 'Modelo ' + sequence, numero_serie: 'SERIE-PRIVADA', observaciones_generales: cliente.nombre } });
    const diagnostico = await prisma.diagnosticos.create({ data: { equipo_id: equipo.id_equipo, tecnico_id: tecnico.perfil.id_tecnico, estado_del_diagnostico: 'ASIGNADO', fecha_asignacion: new Date(), falla_reportada: 'No enciende. JOSE SECRETO APÉLLIDO ' + cliente.telefono + ' ' + cliente.correo, observaciones_recepcion: cliente.direccion, observacion_respuesta: cliente.nombre, detalle_accesorios: 'Cargador original', ...data } });
    return { cliente, equipo, diagnostico };
  };
  const order = async (data = {}) => {
    const f = await fixture({ estado_del_diagnostico: 'COMPLETADO', diagnostico_real: 'Fuente dañada', fecha_completado: new Date() });
    f.orden = await prisma.ordenes.create({ data: { diagnostico_id: f.diagnostico.id_diagnostico, tecnico_id: tecnico.perfil.id_tecnico,
      estado: 'ASIGNADO', fecha_asignacion: new Date(), monto_autorizado: 500, persona_recibe: f.cliente.nombre,
      observacion_entrega: f.cliente.telefono, ...data } });
    return f;
  };
  const forbidden = new Set(['cliente', 'cliente_id', 'id_cliente', 'nombre_cliente', 'telefono', 'correo', 'direccion',
    'numero_serie', 'observaciones_generales', 'observaciones_recepcion', 'observacion_respuesta', 'persona_recibe', 'observacion_entrega', 'ruta_archivo', 'datos_anteriores', 'datos_nuevos']);
  const privateFree = (payload, cliente) => {
    const scan = (v) => { if (v && typeof v === 'object') for (const [key, value] of Object.entries(v)) { assert.ok(!forbidden.has(key), 'Campo privado: ' + key); scan(value); } };
    scan(payload);
    const serialized = JSON.stringify(payload).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (const secret of [cliente.nombre, cliente.telefono, cliente.correo, cliente.direccion, cliente.contacto_secundario]) {
      assert.ok(!serialized.includes(secret.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()), 'Valor privado filtrado');
    }
  };
  test('Listados, detalles y escrituras solo devuelven el contrato técnico', async () => {
    const f = await fixture(), id = f.diagnostico.id_diagnostico;
    privateFree(await api('/tecnicos/mis-diagnosticos/tecnico_privacidad'), f.cliente);
    privateFree(await api(`/tecnicos/diagnosticos/${id}`), f.cliente);
    privateFree(await api(`/tecnicos/diagnosticos/${id}/iniciar`, { method: 'PATCH', body: {} }), f.cliente);
    privateFree(await api(`/tecnicos/diagnosticos/${id}/borrador`, { method: 'PUT', body: { diagnostico: f.cliente.nombre + ' fuente revisada', solucion: 'Cambiar fuente', presupuesto: 0 } }), f.cliente);
    const draft = await prisma.diagnosticos.findUnique({ where: { id_diagnostico: id } });
    assert.equal(draft.estado_del_diagnostico, 'EN_REVISION'); assert.equal(draft.fecha_completado, null);
    privateFree(await api(`/tecnicos/diagnosticos/${id}`, { method: 'PUT', body: { diagnostico_real: f.cliente.nombre + ' fuente averiada', solucion_propuesta: 'Cambiar fuente', presupuesto_estimado: 0 } }), f.cliente);
    const final = await prisma.diagnosticos.findUnique({ where: { id_diagnostico: id } });
    assert.equal(final.borrador_tecnico, null); assert.equal(final.solucion_propuesta, 'Cambiar fuente'); assert.ok(final.fecha_completado);
    const o = await order(), oid = o.orden.id_orden;
    privateFree(await api('/tecnicos/mis-ordenes/tecnico_privacidad'), o.cliente);
    privateFree(await api(`/tecnicos/ordenes/${oid}/estado`, { method: 'PATCH', body: { estado: 'EN_REPARACION' } }), o.cliente);
    await api(`/tecnicos/ordenes/${oid}/estado`, { method: 'PATCH', body: { estado: 'FINALIZADO', observacion_final: 'Pruebas completas' }, status: 400 });
    await api(`/tecnicos/ordenes/${oid}/estado`, { method: 'PATCH', body: { estado: 'FINALIZADO', observacion_final: 'Pruebas incompletas',
      enciende_salida: true, usa_corriente_ac_salida: false, pruebas_salida: { funcion_principal: 'CORRECTO' } }, status: 400 });
    privateFree(await api(`/tecnicos/ordenes/${oid}/estado`, { method: 'PATCH', body: { estado: 'FINALIZADO', enciende_salida: true, usa_corriente_ac_salida: false,
      observacion_final: o.cliente.correo + ' funcionamiento probado', pruebas_salida: { funcion_principal: 'CORRECTO', carga: 'CORRECTO', pantalla: 'CORRECTO', conectividad: 'CORRECTO', cliente: o.cliente.nombre } } }), o.cliente);
  });
  test('El presupuesto conserva NIO por defecto y USD en borrador e informe; rechaza otras monedas', async () => {
    const f = await fixture(), id = f.diagnostico.id_diagnostico;
    assert.equal(f.diagnostico.moneda_presupuesto, 'NIO');
    await api(`/tecnicos/diagnosticos/${id}/iniciar`, { method: 'PATCH', body: {} });
    await api(`/tecnicos/diagnosticos/${id}/borrador`, { method: 'PUT', body: { presupuesto: 125.50, moneda_presupuesto: 'EUR' }, status: 400 });
    await api(`/tecnicos/diagnosticos/${id}/borrador`, { method: 'PUT', body: { diagnostico: 'Fuente averiada', solucion: 'Sustituir fuente', presupuesto: 125.50, moneda_presupuesto: 'USD' } });
    const draft = (await api(`/tecnicos/diagnosticos/${id}`)).data.registro;
    assert.equal(draft.borrador_tecnico.moneda_presupuesto, 'USD'); assert.equal(draft.borrador_tecnico.presupuesto, 125.50);
    assert.equal(draft.moneda_presupuesto, 'NIO', 'El borrador no cambia el informe final');
    const body = { diagnostico_real: 'Fuente averiada', solucion_propuesta: 'Sustituir fuente', presupuesto_estimado: 125.50, moneda_presupuesto: 'USD' };
    await api(`/tecnicos/diagnosticos/${id}`, { method: 'PUT', body: { ...body, moneda_presupuesto: 'EUR' }, status: 400 });
    assert.equal((await prisma.diagnosticos.findUnique({ where: { id_diagnostico: id } })).estado_del_diagnostico, 'EN_REVISION');
    const final = (await api(`/tecnicos/diagnosticos/${id}`, { method: 'PUT', body })).data;
    assert.equal(final.moneda_presupuesto, 'USD'); assert.equal(Number(final.presupuesto_estimado), 125.50);
    assert.equal((await api(`/tecnicos/diagnosticos/${id}`)).data.registro.moneda_presupuesto, 'USD');
    const legacy = await fixture({ moneda_presupuesto: 'USD', presupuesto_estimado: 20, estado_del_diagnostico: 'EN_REVISION', fecha_inicio: new Date() });
    await api(`/tecnicos/diagnosticos/${legacy.diagnostico.id_diagnostico}/borrador`, { method: 'PUT', body: { presupuesto: 800, moneda_presupuesto: 'NIO' } });
    assert.equal((await api(`/tecnicos/diagnosticos/${legacy.diagnostico.id_diagnostico}`)).data.registro.borrador_tecnico.moneda_presupuesto, 'NIO');
  });
  test('Los reportes suman presupuestos por moneda y PostgreSQL rechaza códigos inválidos', async () => {
    const date = new Date('2001-01-17T12:00:00Z');
    const f = await fixture({ presupuesto_estimado: 800, fecha_hora: date });
    await fixture({ presupuesto_estimado: 125.50, moneda_presupuesto: 'USD', fecha_hora: date });
    await fixture({ presupuesto_estimado: 24.50, moneda_presupuesto: 'USD', fecha_hora: date });
    const rows = await prisma.$queryRaw`SELECT * FROM admin_pro.diagnosticos_por_estado(DATE '2001-01-17', DATE '2001-01-17')`;
    assert.equal(rows.length, 2);
    const nio = rows.find((r) => r.moneda === 'NIO'), usd = rows.find((r) => r.moneda === 'USD');
    assert.equal(Number(nio.presupuesto_total), 800); assert.equal(Number(nio.cantidad), 1);
    assert.equal(Number(usd.presupuesto_total), 150); assert.equal(Number(usd.presupuesto_promedio), 75); assert.equal(Number(usd.cantidad), 2);
    await assert.rejects(prisma.diagnosticos.update({ where: { id_diagnostico: f.diagnostico.id_diagnostico }, data: { moneda_presupuesto: 'EUR' } }), /diagnosticos_moneda_presupuesto_check/);
  });
  test('No hay atajos para consultar clientes, documentos o trabajos ajenos', async () => {
    const f = await fixture(), id = f.diagnostico.id_diagnostico;
    for (const path of ['/clientes', '/equipos', '/ordenes', '/facturas', '/garantias', '/flujo-atencion', '/secretaria/diagnostico', '/jefe-tecnico/resumen', '/admin_pro/clientes', `/secretaria/diagnostico/${id}/documento`]) await api(path, { status: 403 });
    await api(`/tecnicos/diagnosticos/${id}`, { actor: otro, status: 403 });
    await api(`/tecnicos/diagnosticos/${id}/borrador`, { actor: otro, method: 'PUT', body: { diagnostico: 'Ajeno' }, status: 403 });
    await api(`/tecnicos/diagnosticos/${id}/avances`, { actor: otro, method: 'POST', body: { observacion: 'Ajeno' }, status: 403 });
    await api('/tecnicos/mis-ordenes/otro_tecnico', { status: 403 });
  });
  test('La bitácora registra autor y avance; un trabajo cerrado no admite notas', async () => {
    const f = await order({ estado: 'EN_REPARACION', fecha_inicio_reparacion: new Date() }), id = f.orden.id_orden;
    privateFree(await api(`/tecnicos/ordenes/${id}/avances`, { method: 'POST', body: { observacion: 'Placa revisada. ' + f.cliente.telefono } }), f.cliente);
    const detail = await api(`/tecnicos/ordenes/${id}`); assert.equal(detail.data.avances.length, 1); privateFree(detail, f.cliente);
    assert.equal(detail.data.avances[0].usuario.nombre_usuario, tecnico.nombre_usuario);
    const [audit] = await prisma.$queryRaw`SELECT usuario_id FROM "Auditoria_Movimientos" WHERE tabla = 'BitacoraTecnica' AND registro_pk->>'id_avance' = ${String(detail.data.avances[0].id_avance)} ORDER BY id_auditoria DESC LIMIT 1`;
    assert.ok(audit, 'El avance tiene una auditoría vinculada a su identificador');
    assert.equal(audit.usuario_id, tecnico.id_usuario);
    await prisma.ordenes.update({ where: { id_orden: id }, data: { estado: 'FINALIZADO' } });
    await api(`/tecnicos/ordenes/${id}/avances`, { method: 'POST', body: { observacion: 'Cambio tardío' }, status: 409 });
  });
  test('El técnico corrige informes y notas con motivo e historial, y aclara informes ya vinculados', async () => {
    const f = await fixture({ estado_del_diagnostico: 'COMPLETADO', fecha_inicio: new Date(),
      fecha_completado: new Date(), diagnostico_real: 'Informe inicial' });
    const id = f.diagnostico.id_diagnostico;
    const url = `/tecnicos/diagnosticos/${id}/correccion`;
    await api(url, { actor: otro, method: 'PATCH', body: { tipo: 'CORREGIR', motivo: 'Error', diagnostico_real: 'Otro' }, status: 403 });
    await api(url, { method: 'PATCH', body: { tipo: 'CORREGIR', diagnostico_real: 'Informe corregido' }, status: 400 });
    privateFree(await api(url, { method: 'PATCH', body: { tipo: 'CORREGIR', motivo: 'Dato mal transcrito',
      diagnostico_real: 'Informe corregido', solucion_propuesta: 'Revisar fuente', presupuesto_estimado: 25 } }), f.cliente);
    const note = await prisma.bitacoraTecnica.create({ data: { diagnostico_id: id, usuario_id: tecnico.id_usuario, observacion: 'Nota original' } });
    await api(`/tecnicos/diagnosticos/${id}/avances/${note.id_avance}`, { method: 'PATCH', body: { observacion: 'Nota corregida', motivo: 'Error en prueba' } });
    const detail = await api(`/tecnicos/diagnosticos/${id}`);
    privateFree(detail, f.cliente);
    assert.equal(detail.data.avances[0].observacion, 'Nota corregida');
    assert.ok(detail.data.correcciones.some((c) => c.tipo === 'CORRECCION_DIAGNOSTICO' && c.antes.diagnostico_real === 'Informe inicial'));
    assert.ok(detail.data.correcciones.some((c) => c.tipo === 'CORRECCION_AVANCE' && c.antes.observacion === 'Nota original'));
    await prisma.ordenes.create({ data: { diagnostico_id: id, tecnico_id: tecnico.perfil.id_tecnico, estado: 'ASIGNADO' } });
    await api(url, { method: 'PATCH', body: { tipo: 'CORREGIR', motivo: 'Cambio tardío', diagnostico_real: 'Otro informe' }, status: 409 });
    await api(url, { method: 'PATCH', body: { tipo: 'ACLARAR', motivo: 'Dato adicional', aclaracion: 'Fuente revisada de nuevo' } });
  });
  test('Un diagnóstico completado por error vuelve a revisión con borrador e historial', async () => {
    const f = await fixture({ estado_del_diagnostico: 'COMPLETADO', fecha_inicio: new Date(),
      fecha_completado: new Date(), diagnostico_real: 'Falla en placa\n\nSolución: Revisar fuente',
      solucion_propuesta: 'Revisar fuente', presupuesto_estimado: 150 });
    const id = f.diagnostico.id_diagnostico, url = `/tecnicos/diagnosticos/${id}/correccion`;
    assert.equal((await api(`/tecnicos/diagnosticos/${id}`)).data.puede_reabrir_diagnostico, true);
    const completedList = await api('/tecnicos/mis-diagnosticos/tecnico_privacidad?grupo=completados');
    const listed = completedList.data.find((d) => d.id_diagnostico === id);
    assert.equal(listed?.puede_reabrir_diagnostico, true);
    assert.equal(listed?.motivo_reapertura, null);
    await api(url, { actor: otro, method: 'PATCH', body: { tipo: 'REABRIR', motivo: 'Cierre accidental' }, status: 403 });
    await api(url, { method: 'PATCH', body: { tipo: 'REABRIR' }, status: 400 });
    const reopened = await api(url, { method: 'PATCH', body: { tipo: 'REABRIR', motivo: 'Se completó por error antes de la segunda prueba' } });
    privateFree(reopened, f.cliente);
    assert.equal(reopened.data.estado_del_diagnostico, 'EN_REVISION');
    assert.equal(reopened.data.fecha_completado, null);
    assert.equal(reopened.data.diagnostico_real, '');
    assert.equal(reopened.data.borrador_tecnico.diagnostico, 'Falla en placa');
    assert.equal(reopened.data.borrador_tecnico.solucion, 'Revisar fuente');
    assert.equal(reopened.data.borrador_tecnico.presupuesto, 150);
    const detail = await api(`/tecnicos/diagnosticos/${id}`);
    assert.ok(detail.data.correcciones.some((c) => c.tipo === 'REAPERTURA_DIAGNOSTICO' && c.antes.estado === 'COMPLETADO'));
    assert.ok(detail.data.historial.some((h) => h.estado_anterior === 'COMPLETADO' && h.estado_nuevo === 'EN_REVISION'));
    assert.ok((await api('/tecnicos/mis-diagnosticos/tecnico_privacidad')).data.some((d) => d.id_diagnostico === id));
    await api(`/tecnicos/diagnosticos/${id}`, { method: 'PUT', body: { diagnostico_real: 'Placa revisada', solucion_propuesta: 'Fuente sustituida', presupuesto_estimado: 180 } });
    assert.equal((await prisma.diagnosticos.findUnique({ where: { id_diagnostico: id } })).estado_del_diagnostico, 'COMPLETADO');
    const linked = await order();
    const linkedList = await api('/tecnicos/mis-diagnosticos/tecnico_privacidad?grupo=completados');
    assert.match(linkedList.data.find((d) => d.id_diagnostico === linked.diagnostico.id_diagnostico)?.motivo_reapertura || '', /orden asociada/);
    await api(`/tecnicos/diagnosticos/${linked.diagnostico.id_diagnostico}/correccion`, { method: 'PATCH', body: { tipo: 'REABRIR', motivo: 'Error' }, status: 409 });
    await prisma.diagnosticos.update({ where: { id_diagnostico: linked.diagnostico.id_diagnostico }, data: { estado_del_diagnostico: 'APROBADO' } });
    const approvedId = linked.diagnostico.id_diagnostico;
    const approvedDetail = await api(`/tecnicos/diagnosticos/${approvedId}`);
    assert.equal(approvedDetail.data.puede_reabrir_diagnostico, false);
    assert.match(approvedDetail.data.registro.motivo_reapertura, /orden asociada/);
    await api(`/tecnicos/diagnosticos/${approvedId}/correccion`, { method: 'PATCH', body: { tipo: 'REABRIR', motivo: 'Error' }, status: 409 });
    await api(`/tecnicos/diagnosticos/${approvedId}/correccion`, { method: 'PATCH', body: { tipo: 'ACLARAR', motivo: 'Aclarar el resultado', aclaracion: 'Prueba adicional documentada' } });
    const approvedAfter = await api(`/tecnicos/diagnosticos/${approvedId}`);
    assert.ok(approvedAfter.data.correcciones.some((c) => c.tipo === 'ACLARACION_DIAGNOSTICO' && c.despues.aclaracion === 'Prueba adicional documentada'));
    assert.equal(approvedAfter.data.registro.estado_del_diagnostico, 'APROBADO');
    const sent = await fixture({ estado_del_diagnostico: 'COMPLETADO', fecha_completado: new Date(),
      diagnostico_real: 'Enviado', estado_contacto: 'DOCUMENTO_ENVIADO', fecha_envio_documento: new Date() });
    await api(`/tecnicos/diagnosticos/${sent.diagnostico.id_diagnostico}/correccion`, { method: 'PATCH', body: { tipo: 'REABRIR', motivo: 'Error' }, status: 409 });
  });
  test('La solicitud pendiente puede corregirse o retirarse antes de la decisión del jefe', async () => {
    const f = await order({ estado: 'ESPERANDO_PIEZA', fecha_inicio_reparacion: new Date() }), id = f.orden.id_orden;
    const piece = await prisma.ordenes_Repuestos.create({ data: { orden_id: id, tecnico_solicitante_id: tecnico.perfil.id_tecnico,
      pieza_solicitada: 'Pantalla', cantidad_usada: 1, estado_aprobacion: 'PENDIENTE' } });
    const url = `/tecnicos/solicitudes/${piece.id_detalle_repuesto}`;
    await api(url, { actor: otro, method: 'PATCH', body: { tipo: 'RETIRAR', motivo: 'Error' }, status: 403 });
    await api(url, { method: 'PATCH', body: { tipo: 'CORREGIR', pieza_solicitada: 'Pantalla', cantidad: 2, motivo: 'Cantidad errónea' } });
    assert.equal((await prisma.ordenes_Repuestos.findUnique({ where: { id_detalle_repuesto: piece.id_detalle_repuesto } })).cantidad_usada, 2);
    await api(url, { method: 'PATCH', body: { tipo: 'RETIRAR', motivo: 'Ya no se necesita' } });
    assert.equal(await prisma.ordenes_Repuestos.findUnique({ where: { id_detalle_repuesto: piece.id_detalle_repuesto } }), null);
    assert.equal((await prisma.ordenes.findUnique({ where: { id_orden: id } })).estado, 'EN_REPARACION');
    const detail = await api(`/tecnicos/ordenes/${id}`); privateFree(detail, f.cliente);
    assert.ok(detail.data.correcciones.some((c) => c.tipo === 'RETIRO_SOLICITUD_TECNICO' && c.antes.cantidad_usada === 2));
  });
  test('El informe irreparable pendiente puede corregirse o retirarse antes de la decisión', async () => {
    const f = await order({ estado: 'IRREPARABLE', fecha_inicio_reparacion: new Date(),
      irreparable_estado: 'PENDIENTE', resultado_final: 'IRREPARABLE', justificacion_irreparable: 'Informe inicial', observacion_final: 'Informe inicial' });
    const id = f.orden.id_orden, url = `/tecnicos/ordenes/${id}/irreparable`;
    await api(url, { actor: otro, method: 'PATCH', body: { tipo: 'RETIRAR', motivo: 'Error' }, status: 403 });
    await api(url, { method: 'PATCH', body: { tipo: 'CORREGIR', motivo: 'Prueba omitida', justificacion: 'Daño de placa confirmado' } });
    assert.equal((await prisma.ordenes.findUnique({ where: { id_orden: id } })).justificacion_irreparable, 'Daño de placa confirmado');
    await api(url, { method: 'PATCH', body: { tipo: 'RETIRAR', motivo: 'Reparación posible' } });
    const orden = await prisma.ordenes.findUnique({ where: { id_orden: id } });
    assert.equal(orden.estado, 'EN_REPARACION'); assert.equal(orden.irreparable_estado, 'NO_SOLICITADO');
    const detail = await api(`/tecnicos/ordenes/${id}`); privateFree(detail, f.cliente);
    assert.ok(detail.data.correcciones.some((c) => c.tipo === 'RETIRO_IRREPARABLE'));
    await api(url, { method: 'PATCH', body: { tipo: 'CORREGIR', motivo: 'Tardío', justificacion: 'Otra' }, status: 409 });
  });
  test('Irreparable pendiente permanece activa; la decisión del jefe se refleja sin datos privados', async () => {
    const f = await order({ estado: 'EN_REPARACION', fecha_inicio_reparacion: new Date() }), id = f.orden.id_orden;
    await api(`/tecnicos/ordenes/${id}/estado`, { method: 'PATCH', body: { estado: 'IRREPARABLE', observacion_final: 'Daño en placa', enciende_salida: 'true' }, status: 400 });
    const reported = await api(`/tecnicos/ordenes/${id}/estado`, { method: 'PATCH', body: { estado: 'IRREPARABLE', observacion_final: 'Daño en placa' } });
    assert.equal(reported.data.enciende_salida, null); assert.equal(reported.data.usa_corriente_ac_salida, null);
    const pending = await api('/tecnicos/mis-ordenes/tecnico_privacidad?grupo=revision_jefe'); assert.ok(pending.data.some((o) => o.id_orden === id));
    const closed = await api('/tecnicos/mis-ordenes/tecnico_privacidad?grupo=completados'); assert.ok(!closed.data.some((o) => o.id_orden === id));
    await api(`/jefe-tecnico/ordenes/${id}/irreparable`, { actor: jefe, method: 'PATCH', body: { decision: 'RECHAZADO', motivo: f.cliente.nombre + ' revisar regulador' } });
    const detail = await api(`/tecnicos/ordenes/${id}`); assert.equal(detail.data.registro.estado, 'EN_REPARACION'); privateFree(detail, f.cliente);
  });
  test('Las fotos se revisan antes de publicar; el técnico recibe nombres neutros y bytes sin EXIF', async () => {
    const f = await fixture();
    const bytes = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#fff' } }).jpeg().withMetadata({ exif: { IFD0: { Artist: f.cliente.nombre, ImageDescription: f.cliente.telefono } } }).toBuffer();
    const uploaded = await api(`/archivos-servicio/diagnosticos/${f.diagnostico.id_diagnostico}`, { actor: secretaria, method: 'POST', bytes,
      headers: { 'Content-Type': 'image/jpeg', 'X-Tipo-Archivo': 'FOTO_RECEPCION', 'X-File-Name': encodeURIComponent(f.cliente.nombre + '.jpg') }, status: 201 });
    const id = uploaded.data.id_archivo;
    assert.equal((await api(`/archivos-servicio/diagnosticos/${f.diagnostico.id_diagnostico}`)).data.length, 0);
    await api(`/archivos-servicio/${id}/contenido`, { status: 403 });
    await api(`/archivos-servicio/${id}/visibilidad-tecnica`, { method: 'PATCH', body: { visible_tecnico: true, sin_datos_cliente: true }, status: 403 });
    assert.equal((await api(`/archivos-servicio/diagnosticos/${f.diagnostico.id_diagnostico}`, { actor: jefe })).data[0].id_archivo, id);
    await api(`/archivos-servicio/${id}/visibilidad-tecnica`, { actor: jefe, method: 'PATCH', body: { visible_tecnico: true, motivo: 'Sin datos personales' }, status: 400 });
    await api(`/archivos-servicio/${id}/visibilidad-tecnica`, { actor: jefe, method: 'PATCH', body: { visible_tecnico: true, sin_datos_cliente: true }, status: 400 });
    await api(`/archivos-servicio/${id}/visibilidad-tecnica`, { actor: jefe, method: 'PATCH', body: { visible_tecnico: true, sin_datos_cliente: true, motivo: 'Solo muestra el equipo' } });
    await api(`/archivos-servicio/${id}/visibilidad-tecnica`, { actor: jefe, method: 'PATCH', body: { visible_tecnico: true, sin_datos_cliente: true, motivo: 'Duplicado' }, status: 409 });
    const [audit] = await prisma.$queryRaw`SELECT usuario_id FROM "Auditoria_Movimientos" WHERE tabla = 'ArchivosServicio' AND registro_pk->>'id_archivo' = ${String(id)} ORDER BY id_auditoria DESC LIMIT 1`;
    assert.ok(audit, 'La revisión de la foto tiene una auditoría vinculada a su identificador');
    assert.equal(audit.usuario_id, jefe.id_usuario);
    const review = (await api(`/jefe-tecnico/diagnosticos/${f.diagnostico.id_diagnostico}`, { actor: jefe })).data.intervenciones.find((entry) => entry.tipo === 'REVISION_FOTO_TECNICA');
    assert.equal(review.motivo, 'Solo muestra el equipo');
    assert.equal(review.usuario_id, jefe.id_usuario);
    assert.equal(review.datos_nuevos.id_archivo, id);
    assert.equal(review.datos_nuevos.visible_tecnico, true);
    privateFree(await api(`/archivos-servicio/diagnosticos/${f.diagnostico.id_diagnostico}`), f.cliente);
    const image = await request(`/archivos-servicio/${id}/contenido`); const meta = await sharp(image.data).metadata();
    assert.equal(meta.format, 'webp'); assert.equal(meta.width, 12); assert.equal(meta.height, 12);
    assert.equal(image.headers.get('content-type'), 'image/webp');
    assert.equal(meta.exif, undefined); assert.equal(meta.xmp, undefined); assert.ok(image.headers.get('content-disposition').includes('foto-tecnica-'));
    await api(`/archivos-servicio/${id}/contenido`, { actor: otro, status: 403 });
    await api(`/archivos-servicio/${id}/visibilidad-tecnica`, { actor: secretaria, method: 'PATCH', body: { visible_tecnico: false, motivo: 'Se detectó una etiqueta con datos del cliente' } });
    await api(`/archivos-servicio/${id}/contenido`, { status: 403 });
    const history = (await api(`/jefe-tecnico/diagnosticos/${f.diagnostico.id_diagnostico}`, { actor: jefe })).data.intervenciones.filter((entry) => entry.tipo === 'REVISION_FOTO_TECNICA');
    assert.equal(history.length, 2);
    assert.equal(history[0].motivo, 'Se detectó una etiqueta con datos del cliente');
    assert.equal(history[0].datos_nuevos.visible_tecnico, false);
  });
  test('La revisión de fotos de reparación conserva el motivo en la orden', async () => {
    const f = await order();
    const bytes = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const uploaded = await api(`/archivos-servicio/ordenes/${f.orden.id_orden}`, { actor: secretaria, method: 'POST', bytes,
      headers: { 'Content-Type': 'image/jpeg', 'X-Tipo-Archivo': 'FOTO_REPARACION' }, status: 201 });
    const id = uploaded.data.id_archivo;
    await api(`/archivos-servicio/${id}/visibilidad-tecnica`, { actor: jefe, method: 'PATCH', body: { visible_tecnico: true, sin_datos_cliente: true, motivo: 'Evidencia de la pieza reparada' } });
    const detail = (await api(`/jefe-tecnico/ordenes/${f.orden.id_orden}`, { actor: jefe })).data;
    const review = detail.intervenciones.find((entry) => entry.tipo === 'REVISION_FOTO_TECNICA');
    assert.equal(review.motivo, 'Evidencia de la pieza reparada');
    assert.equal(review.datos_nuevos.id_archivo, id);
    assert.equal(review.datos_nuevos.visible_tecnico, true);
    await api(`/archivos-servicio/${id}/visibilidad-tecnica`, { actor: jefe, method: 'PATCH', body: { visible_tecnico: false, motivo: 'La foto corresponde a otro equipo' } });
    assert.equal((await api(`/archivos-servicio/ordenes/${f.orden.id_orden}`, { actor: jefe })).data[0].visible_tecnico, false);
    const diagnosticPhoto = await api(`/archivos-servicio/diagnosticos/${f.diagnostico.id_diagnostico}`, { actor: secretaria, method: 'POST', bytes,
      headers: { 'Content-Type': 'image/jpeg', 'X-Tipo-Archivo': 'FOTO_DIAGNOSTICO' }, status: 201 });
    await api(`/archivos-servicio/${diagnosticPhoto.data.id_archivo}/visibilidad-tecnica`, { actor: jefe, method: 'PATCH', body: {
      visible_tecnico: true, sin_datos_cliente: true, motivo: 'Diagnóstico visible para el responsable de la orden',
    } });
    const linked = (await api(`/jefe-tecnico/ordenes/${f.orden.id_orden}`, { actor: jefe })).data;
    assert.ok(linked.intervenciones_diagnostico.some((entry) => entry.tipo === 'REVISION_FOTO_TECNICA'
      && entry.datos_nuevos.id_archivo === diagnosticPhoto.data.id_archivo));
  });
  test('Corrección del cierre y fotos conservan historial; fuera del plazo se marcan como excepción', async () => {
    const f = await order({ estado: 'EN_REPARACION', fecha_inicio_reparacion: new Date() });
    const id = f.orden.id_orden;
    await api(`/tecnicos/ordenes/${id}/estado`, { method: 'PATCH', body: { estado: 'FINALIZADO',
      observacion_final: 'Informe original', enciende_salida: true, usa_corriente_ac_salida: true,
      pruebas_salida: { funcion_principal: 'CORRECTO', carga: 'CORRECTO', pantalla: 'CORRECTO', conectividad: 'CORRECTO' } } });
    const cerradas = await api('/tecnicos/mis-ordenes/tecnico_privacidad?grupo=completados');
    assert.equal(cerradas.data.find((o) => o.id_orden === id)?.correccion_cierre?.puede_editar_informe, true);
    const correction = { tipo: 'CORREGIR', motivo: 'Faltó anotar una prueba', observacion_final: 'Informe corregido',
      enciende_salida: true, usa_corriente_ac_salida: false,
      pruebas_salida: { funcion_principal: 'CORRECTO', carga: 'CORRECTO', pantalla: 'CORRECTO', conectividad: 'CORRECTO' } };
    await api(`/tecnicos/ordenes/${id}/correccion-cierre`, { actor: otro, method: 'PATCH', body: correction, status: 403 });
    privateFree(await api(`/tecnicos/ordenes/${id}/correccion-cierre`, { method: 'PATCH', body: correction }), f.cliente);
    let detail = await api(`/tecnicos/ordenes/${id}`);
    assert.equal(detail.data.registro.observacion_final, 'Informe corregido');
    assert.equal(detail.data.correcciones[0].observacion_anterior, 'Informe original');
    assert.equal(detail.data.correcciones[0].es_excepcion, false);
    const bytes = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const photo = await api(`/archivos-servicio/ordenes/${id}`, { method: 'POST', bytes, status: 201,
      headers: { 'Content-Type': 'image/jpeg', 'X-Tipo-Archivo': 'FOTO_REPARACION',
        'X-File-Name': 'correccion.jpg', 'X-Motivo-Correccion': encodeURIComponent('Foto posterior al cierre') } });
    const listed = await api(`/archivos-servicio/ordenes/${id}`);
    assert.equal(listed.data[0].id_archivo, photo.data.id_archivo);
    assert.equal(listed.data[0].correccion_cierre, true);
    assert.equal(listed.data[0].es_excepcion, false);
    await prisma.ordenes.update({ where: { id_orden: id }, data: { fecha_finalizacion: new Date(Date.now() - 49 * 3600000), fecha_cierre: new Date(Date.now() - 49 * 3600000) } });
    await api(`/tecnicos/ordenes/${id}/correccion-cierre`, { method: 'PATCH', body: { tipo: 'ACLARAR', motivo: 'Aclaración tardía', aclaracion: 'Detalle adicional' }, status: 409 });
    await api(`/tecnicos/ordenes/${id}/correccion-cierre`, { method: 'PATCH', body: { tipo: 'ACLARAR', motivo: 'Aclaración tardía', aclaracion: 'Detalle adicional', excepcion: true } });
    await api(`/archivos-servicio/ordenes/${id}`, { method: 'POST', bytes, status: 409,
      headers: { 'Content-Type': 'image/jpeg', 'X-Tipo-Archivo': 'FOTO_REPARACION', 'X-File-Name': 'tardia.jpg',
        'X-Motivo-Correccion': encodeURIComponent('Foto tardía') } });
    const latePhoto = await api(`/archivos-servicio/ordenes/${id}`, { method: 'POST', bytes, status: 201,
      headers: { 'Content-Type': 'image/jpeg', 'X-Tipo-Archivo': 'FOTO_REPARACION', 'X-File-Name': 'tardia.jpg',
        'X-Motivo-Correccion': encodeURIComponent('Foto tardía'), 'X-Correccion-Excepcion': 'true' } });
    const lateList = await api(`/archivos-servicio/ordenes/${id}`);
    assert.equal(lateList.data[0].id_archivo, latePhoto.data.id_archivo);
    assert.equal(lateList.data[0].es_excepcion, true);
    detail = await api(`/tecnicos/ordenes/${id}`);
    const lateNote = detail.data.correcciones.find((c) => c.tipo === 'ACLARACION_CIERRE');
    assert.equal(lateNote.es_excepcion, true);
    assert.equal(lateNote.aclaracion, 'Detalle adicional');
    await prisma.facturas.create({ data: { orden_id: id, diagnostico_id: f.diagnostico.id_diagnostico, monto_diagnostico: 100, total: 500 } });
    await api(`/tecnicos/ordenes/${id}/correccion-cierre`, { method: 'PATCH', body: { ...correction, excepcion: true }, status: 409 });
    await api(`/tecnicos/ordenes/${id}/correccion-cierre`, { method: 'PATCH', body: { tipo: 'ACLARAR', motivo: 'Aclaración facturada', aclaracion: 'Dato complementario', excepcion: true } });
    assert.equal((await prisma.ordenes.findUnique({ where: { id_orden: id } })).observacion_final, 'Informe corregido');
    privateFree(detail, f.cliente);
    const extra = await order({ estado: 'EN_REPARACION', fecha_inicio_reparacion: new Date() });
    const extraId = extra.orden.id_orden;
    await api(`/tecnicos/ordenes/${extraId}/estado`, { method: 'PATCH', body: { estado: 'FINALIZADO',
      observacion_final: 'Cierre prematuro', enciende_salida: true, usa_corriente_ac_salida: true,
      pruebas_salida: { funcion_principal: 'CORRECTO', carga: 'CORRECTO', pantalla: 'CORRECTO', conectividad: 'CORRECTO' } } });
    await api(`/tecnicos/ordenes/${extraId}/correccion-cierre`, { method: 'PATCH', body: { tipo: 'REABRIR', motivo: 'Faltó completar una prueba física' } });
    const reopened = await prisma.ordenes.findUnique({ where: { id_orden: extraId } });
    assert.equal(reopened.estado, 'EN_REPARACION'); assert.equal(reopened.fecha_finalizacion, null);
    assert.equal(reopened.resultado_final, null);
    assert.ok((await api('/tecnicos/mis-ordenes/tecnico_privacidad?grupo=activos')).data.some((o) => o.id_orden === extraId));
    assert.ok((await api(`/tecnicos/ordenes/${extraId}`)).data.correcciones.some((c) => c.tipo === 'REAPERTURA_CIERRE'));
  });
  test('Catálogo paginado encuentra piezas fuera de la primera página y descuenta reservas', async () => {
    const categoria = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: 'Fuentes', electronico: 'Laptop' } });
    const proveedor = await prisma.proveedores.create({ data: { nombre: 'Proveedor de pruebas' } });
    const pieces = [];
    for (let i = 0; i < 23; i += 1) {
      const p = await prisma.repuestos.create({ data: { nombre: 'Fuente ' + String(i).padStart(2, '0'), tipo_repuesto_id: categoria.id_tipo_repuesto, proveedor_id: proveedor.id_proveedor, costo_individual: 10 } });
      await prisma.compras.create({ data: { repuesto_id: p.id_repuesto, proveedor_id: proveedor.id_proveedor, cantidad: 2, costo_unitario: 10 } }); pieces.push(p);
    }
    const first = await api('/tecnicos/catalogo?tipo=Laptop'), second = await api('/tecnicos/catalogo?tipo=Laptop&page=2');
    assert.equal(first.data.length, 20); assert.equal(second.data.length, 3);
    assert.equal((await api('/tecnicos/catalogo?search=Fuente%2022')).data[0].id_repuesto, pieces[22].id_repuesto);
    assert.equal((await api('/tecnicos/catalogo?search=Fuente%2022&cantidad=3')).data[0].disponible, false);
    const f = await order({ estado: 'EN_REPARACION', fecha_inicio_reparacion: new Date() });
    await prisma.ordenes_Repuestos.create({ data: { orden_id: f.orden.id_orden, repuesto_id: pieces[22].id_repuesto, cantidad_usada: 2, estado_aprobacion: 'APROBADO' } });
    assert.equal((await api('/tecnicos/catalogo?search=Fuente%2022')).data[0].disponible, false);
    const legacy = await api('/repuestos?search=Fuente%2022'); assert.ok(!('stock_actual' in legacy.data[0])); assert.ok(!('proveedor' in legacy.data[0]));
    privateFree(await api('/tecnicos/solicitudes'), f.cliente);
  });
  test('Los listados usan 20 filas, prioridad global y las mismas fechas que los indicadores', async () => {
    const f = await fixture();
    await prisma.equipos.update({ where: { id_equipo: f.equipo.id_equipo }, data: { modelo: 'Paginación específica' } });
    await prisma.diagnosticos.createMany({ data: Array.from({ length: 23 }, (_, i) => ({ equipo_id: f.equipo.id_equipo, tecnico_id: tecnico.perfil.id_tecnico,
      estado_del_diagnostico: 'ASIGNADO', fecha_asignacion: new Date(), prioridad: i === 22 ? 'URGENTE' : 'Normal', falla_reportada: 'Paginación específica' })) });
    const first = await api('/tecnicos/mis-diagnosticos/tecnico_privacidad?search=Paginaci%C3%B3n'), second = await api('/tecnicos/mis-diagnosticos/tecnico_privacidad?search=Paginaci%C3%B3n&page=2');
    assert.equal(first.data.length, 20); assert.equal(second.data.length, 4); assert.equal(first.data[0].prioridad, 'URGENTE');
    assert.ok(!second.data.some((d) => first.data.some((a) => a.id_diagnostico === d.id_diagnostico)));
    const [today, summary] = await Promise.all([api('/tecnicos/mis-diagnosticos/tecnico_privacidad?periodo=hoy'), api('/tecnicos/resumen?periodo=hoy')]);
    assert.equal(today.meta.total, summary.data.diagnosticos_activos);
  });
  test('La búsqueda no permite deducir nombres ni contactos escritos en las notas originales', async () => {
    const f = await order();
    for (const value of [f.cliente.nombre, 'Secreto', f.cliente.telefono, f.cliente.correo]) {
      const q = '?search=' + encodeURIComponent(value);
      assert.equal((await api('/tecnicos/mis-diagnosticos/tecnico_privacidad' + q)).meta.total, 0);
      assert.equal((await api('/tecnicos/mis-ordenes/tecnico_privacidad' + q)).meta.total, 0);
    }
  });
  test('El filtro cubre nombres cortos y no vuelve a sustituir los marcadores reservados', async () => {
    const f = await fixture();
    await prisma.clientes.update({ where: { id_cliente: f.cliente.id_cliente }, data: { nombre: 'Li Yu', contacto_secundario: 'Wu' } });
    await prisma.diagnosticos.update({ where: { id_diagnostico: f.diagnostico.id_diagnostico }, data: { falla_reportada: 'Salida limpia. Li, Yu y Wu dejaron el equipo.' } });
    const data = (await api(`/tecnicos/diagnosticos/${f.diagnostico.id_diagnostico}`)).data.registro;
    assert.equal(data.falla_reportada, 'Salida limpia. [dato reservado], [dato reservado] y [dato reservado] dejaron el equipo.');
    await prisma.clientes.update({ where: { id_cliente: f.cliente.id_cliente }, data: { nombre: 'Dato Reservado', contacto_secundario: 'Contacto Reservado' } });
    await prisma.diagnosticos.update({ where: { id_diagnostico: f.diagnostico.id_diagnostico }, data: { falla_reportada: 'Dato Reservado indica que no enciende.' } });
    assert.equal((await api(`/tecnicos/diagnosticos/${f.diagnostico.id_diagnostico}`)).data.registro.falla_reportada, '[dato reservado] indica que no enciende.');
  });
  test('Las correcciones del jefe conservan la privacidad del expediente del técnico', async () => {
    const f = await order({ estado: 'EN_REPARACION', fecha_inicio_reparacion: new Date() });
    const category = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: 'Correcciones privadas', electronico: 'Laptop' } });
    const part = await prisma.repuestos.create({ data: { nombre: 'Fuente de prueba', tipo_repuesto_id: category.id_tipo_repuesto, stock_actual: 1 } });
    const p = await prisma.ordenes_Repuestos.create({ data: { orden_id: f.orden.id_orden, repuesto_id: part.id_repuesto, cantidad_usada: 1,
      estado_aprobacion: 'APROBADO', estado_entrega: 'ENTREGADO', fecha_aprobacion: new Date(), fecha_entrega: new Date(), usuario_entregador_id: jefe.id_usuario } });
    await api(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/corregir-entrega`, { actor: jefe, method: 'PATCH', body: { motivo: f.cliente.nombre + ' ' + f.cliente.telefono, entrega_no_realizada: true } });
    await api(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/retirar-aprobacion`, { actor: jefe, method: 'PATCH', body: { motivo: f.cliente.correo + ' revisión' } });
    const technical = await api(`/tecnicos/ordenes/${f.orden.id_orden}`); privateFree(technical, f.cliente);
    assert.equal(technical.data.registro.repuestos_usados[0].estado_aprobacion, 'PENDIENTE');
    assert.equal(technical.data.registro.repuestos_usados[0].estado_entrega, 'PENDIENTE');
    privateFree(await api('/tecnicos/solicitudes'), f.cliente);
    for (const action of ['retirar-aprobacion', 'reabrir', 'corregir-entrega', 'devolver']) await api(`/jefe-tecnico/repuestos/${p.id_detalle_repuesto}/${action}`, { method: 'PATCH', body: { motivo: 'Intento sin rol de jefe' }, status: 403 });
  });
  test('Los avisos por Socket.IO solo transmiten referencias y mensajes técnicos controlados', async () => {
    const f = await order();
    const endpoint = base.replace(/\/api$/, '') + '/socket.io/?EIO=4&transport=polling';
    const handshake = await (await fetch(endpoint)).text();
    const sid = JSON.parse(handshake.slice(1)).sid;
    const poll = endpoint + '&sid=' + encodeURIComponent(sid);
    const auth = await fetch(poll, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '40' + JSON.stringify({ token: tecnico.token }) });
    assert.equal(auth.status, 200);
    await (await fetch(poll, { signal: AbortSignal.timeout(5000) })).text();
    await notifyTecnico(tecnico.perfil, { type: 'repuesto_aprobar', title: f.cliente.nombre, message: f.cliente.telefono,
      severity: f.cliente.correo, entity: { kind: 'repuesto', id: 1, orden_id: f.orden.id_orden, cliente: f.cliente.nombre } });
    const packets = (await (await fetch(poll, { signal: AbortSignal.timeout(5000) })).text()).split('\x1e');
    const event = packets.find((packet) => packet.startsWith('42["notificacion",'));
    assert.ok(event, 'Se recibió el aviso dirigido a la cuenta del técnico');
    const payload = JSON.parse(event.slice(2))[1]; privateFree(payload, f.cliente);
    assert.equal(payload.entity.orden_id, f.orden.id_orden); assert.equal(payload.severity, 'info');
    await fetch(poll, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '41\x1e1' });
  });
}
