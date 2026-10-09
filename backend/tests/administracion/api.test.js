import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, writeFile, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import pg from 'pg';
const databaseName = process.env.CTE_ADMIN_TEST_DATABASE;
if (!databaseName) {
  test('Administración requiere el ejecutor de base y respaldos temporales', { skip: 'Use npm run test:admin:integracion' }, () => {});
} else {
  assert.match(databaseName, /^cte_administracion_test_[0-9a-f]{32}$/);
  assert.equal(new URL(process.env.DATABASE_URL).pathname, `/${databaseName}`);
  assert.ok(['db', 'localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname));
  assert.match(path.basename(process.env.BACKUP_ROOT), /^cte_admin_test_[a-zA-Z0-9]+$/);
  const { default: app } = await import('../../src/app/app.js');
  const { default: prisma } = await import('../../src/app/prismaClient.js');
  const { initializeAdministrationStorage, getAdminSettings } = await import('../../src/services/adminSettingsService.js');
  const { synchronizeBackupSchedule, runScheduledBackup, getBackupSummary, resolveBackupFile, postgresTool } = await import('../../src/services/backupService.js');
  let server, base, actor, denied, technician, sample, sequence = 0;
  const password = 'ClavePrueba2026';
  const request = async (route, { method = 'GET', body, token = actor?.token, status = 200 } = {}) => {
    const response = await fetch(`${base}${route}`, { method, signal: AbortSignal.timeout(90000),
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, status, `${method} ${route}: ${Buffer.isBuffer(data) ? 'archivo' : JSON.stringify(data)}`);
    return { data, response };
  };
  const api = async (...args) => (await request(...args)).data;
  const login = async (user, pwd = password) => { const data = await api('/auth/login', { method: 'POST', body: { username: user.nombre_usuario, password: pwd }, token: null }); user.token = data.token; return data; };
  const account = async (name, role = 'Administrador') => prisma.usuarios.create({ data: { nombre_usuario: name, rol: role, contrasena_hash: await bcrypt.hash(password, 10) } });
  const fixture = async (data = {}, orderData = {}) => {
    const cliente = await prisma.clientes.create({ data: { nombre: `Cliente administración ${++sequence}` } });
    const equipo = await prisma.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: 'Laptop', marca: 'Prueba', modelo: `Modelo ${sequence}` } });
    const diagnostico = await prisma.diagnosticos.create({ data: { equipo_id: equipo.id_equipo, tecnico_id: technician.id_tecnico, estado_del_diagnostico: 'COMPLETADO', fecha_completado: new Date(), diagnostico_real: 'Fuente dañada', presupuesto_estimado: 500, ...data } });
    const orden = await prisma.ordenes.create({ data: { diagnostico_id: diagnostico.id_diagnostico, tecnico_id: technician.id_tecnico, monto_autorizado: 500, estado: 'ASIGNADO', ...orderData } });
    return { cliente, equipo, diagnostico, orden };
  };
  before(async () => {
    await initializeAdministrationStorage();
    actor = await account('administrador_pruebas'); denied = await account('secretaria_pruebas_admin', 'Secretaria');
    const tech = await account('tecnico_pruebas_admin', 'Tecnico');
    technician = await prisma.tecnicos.create({ data: { usuario_id: tech.id_usuario, nombre: 'Técnico de pruebas' } });
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}/api`;
    await login(actor); await login(denied); sample = await fixture();
  });
  after(async () => { server?.closeAllConnections(); if (server?.listening) await new Promise((resolve) => server.close(resolve)); await prisma.$disconnect(); });

  test('Solo administración accede a cuenta, configuración, reportes, auditoría y respaldos', async () => {
    for (const route of ['/mi-cuenta', '/configuracion', '/reglas', '/auditoria', '/backups', '/reportes/catalogo', '/reportes/opciones', '/reportes/usuarios', '/reportes/usuarios/excel']) {
      await api(`/admin_pro${route}`, { token: denied.token, status: 403 }); await api(`/admin_pro${route}`, { token: null, status: 401 });
    }
    const me = await api('/admin_pro/mi-cuenta'); assert.equal(me.data.id_usuario, actor.id_usuario); assert.ok(!JSON.stringify(me).includes('contrasena_hash'));
  });
  test('Perfil exige contraseña actual y conserva rol; no se puede desactivar la cuenta propia', async () => {
    await api('/admin_pro/mi-cuenta', { method: 'PUT', body: { nombre_usuario: 'nuevo', correo_electronico: 'admin@example.test', password_actual: 'incorrecta' }, status: 403 });
    const changed = await api('/admin_pro/mi-cuenta', { method: 'PUT', body: { nombre_usuario: 'administrador_actualizado', nombre_persona: 'Responsable del taller', correo_electronico: 'admin@example.test', password_actual: password, rol: 'Tecnico' } });
    actor.nombre_usuario = changed.data.nombre_usuario; assert.equal(changed.data.rol, 'Administrador');
    assert.equal(changed.data.nombre_persona, 'Responsable del taller');
    await api(`/admin_pro/usuarios/${actor.id_usuario}`, { method: 'PUT', body: { activo: false }, status: 409 });
    await api(`/admin_pro/usuarios/${actor.id_usuario}`, { method: 'PUT', body: { rol: 'ServicioCliente' }, status: 409 });
  });
  test('Configuración valida límites, evita sobrescrituras y registra motivo y autor', async () => {
    const config = (await api('/admin_pro/configuracion')).data;
    await api('/admin_pro/configuracion', { method: 'PUT', body: { revision: config.revision, motivo: 'Prueba inválida', valores: { reglas: { password_minimo: 4 } } }, status: 400 });
    const saved = await api('/admin_pro/configuracion', { method: 'PUT', body: { revision: config.revision, motivo: 'Ajuste administrativo de prueba', valores: { negocio: { garantia_meses: 6, garantia_condiciones: 'Condiciones de prueba', margen_repuesto_porcentaje: 20 }, reglas: { garantia_aviso_dias: 15, correccion_cierre_horas: 48, correccion_excepcional_habilitada: false } } } });
    assert.equal(saved.data.revision, config.revision + 1); assert.equal(saved.data.valores.reglas.password_minimo, 8);
    assert.equal(saved.data.valores.reglas.correccion_cierre_horas, 48);
    assert.equal((await api('/admin_pro/configuracion')).data.valores.reglas.correccion_excepcional_habilitada, false);
    await api('/admin_pro/configuracion', { method: 'PUT', body: { revision: config.revision, motivo: 'Datos desactualizados', valores: { negocio: { nombre: 'Cambio perdido' } } }, status: 409 });
    const audit = await api('/admin_pro/auditoria?tabla=ConfiguracionAdministracion');
    assert.equal(audit.data[0].usuario_id, actor.id_usuario); assert.equal(audit.data[0].observacion, 'Ajuste administrativo de prueba');
    assert.equal((await api('/admin_pro/dashboard')).data.garantiaAvisoDias, 15);
  });
  test('Cuentas del personal cumplen contraseña mínima y las respuestas ocultan hashes', async () => {
    await api('/admin_pro/usuarios', { method: 'POST', body: { nombre_usuario: 'corta', rol: 'Tecnico', password: '1234' }, status: 400 });
    await api('/admin_pro/usuarios', { method: 'POST', body: { nombre_usuario: 'elevada', rol: 'Administrador', password }, status: 400 });
    const created = await api('/admin_pro/usuarios', { method: 'POST', body: { nombre_usuario: 'tecnico_creado', nombre_persona: 'Técnico de prueba', correo_electronico: 'tech@example.test', rol: 'Tecnico', password }, status: 201 });
    assert.ok(created.tecnico); assert.ok(!JSON.stringify(created).includes('contrasena_hash'));
    assert.equal(created.tecnico.nombre, 'Técnico de prueba');
    const integral = await api('/admin_pro/usuarios', { method: 'POST', body: { nombre_usuario: 'operacion_integral', nombre_persona: 'Encargada de prueba', rol: 'Secretaria', password }, status: 201 });
    assert.equal(integral.data.rol, 'Secretaria'); assert.equal(integral.data.nombre_persona, 'Encargada de prueba');
    const staff = created.data; await login(staff);
    await api(`/admin_pro/usuarios/${staff.id_usuario}/password`, { method: 'PUT', body: { password: 'OtraClaveSegura', admin_password: password } });
    await api('/admin_pro/reportes/usuarios', { token: staff.token, status: 401 });
    await login(staff, 'OtraClaveSegura');
    await api(`/admin_pro/usuarios/${staff.id_usuario}`, { method: 'PUT', body: { activo: false } });
    await api('/admin_pro/reportes/usuarios', { token: staff.token, status: 401 });
  });
  test('Contraseña propia valida confirmación, invalida sesiones y permite ingresar con la nueva', async () => {
    await api('/admin_pro/mi-cuenta/password', { method: 'PUT', body: { password_actual: password, password: 'NuevaClaveAdmin2026', confirmacion: 'distinta' }, status: 400 });
    const old = actor.token;
    await api('/admin_pro/mi-cuenta/password', { method: 'PUT', body: { password_actual: password, password: 'NuevaClaveAdmin2026', confirmacion: 'NuevaClaveAdmin2026' } });
    await api('/admin_pro/mi-cuenta', { token: old, status: 401 });
    await api('/auth/login', { method: 'POST', body: { username: actor.nombre_usuario, password }, token: null, status: 401 });
    await login(actor, 'NuevaClaveAdmin2026');
    await api('/admin_pro/mi-cuenta/password', { method: 'PUT', body: { password_actual: 'NuevaClaveAdmin2026', password, confirmacion: password } });
    await login(actor);
    const previous = actor.token;
    await api('/admin_pro/mi-cuenta/cerrar-sesiones', { method: 'POST', body: { password_actual: password } });
    await api('/admin_pro/mi-cuenta', { token: previous, status: 401 }); await login(actor);
  });
  test('Nuevas garantías usan los valores configurados y conservan las anteriores', async () => {
    await prisma.ordenes.update({ where: { id_orden: sample.orden.id_orden }, data: { estado: 'FINALIZADO' } });
    const factura = await prisma.facturas.create({ data: { orden_id: sample.orden.id_orden, diagnostico_id: sample.diagnostico.id_diagnostico, monto_diagnostico: 100, total: 500 } });
    const first = await prisma.garantias.findUnique({ where: { factura_id: factura.id_factura } });
    assert.equal(first.duracion_meses, 6); assert.equal(first.condiciones, 'Condiciones de prueba'); assert.equal(first.fecha_inicio, null);
    await prisma.garantias.delete({ where: { id_garantia: first.id_garantia } });
    const manual = await api('/admin_pro/garantias', { method: 'POST', body: { factura_id: factura.id_factura }, status: 201 });
    assert.equal(manual.data.duracion_meses, 6); assert.equal(manual.data.condiciones, 'Condiciones de prueba');
    await api('/admin_pro/garantias', { method: 'POST', body: { factura_id: factura.id_factura }, status: 409 });
    await api(`/admin_pro/garantias/${manual.data.id_garantia}`, { method: 'PUT', body: { condiciones: 'Condiciones personalizadas de prueba' } });
    assert.equal((await api('/admin_pro/auditoria?tabla=Garantias')).data[0].usuario_id, actor.id_usuario);
    const config = await getAdminSettings();
    await api('/admin_pro/configuracion', { method: 'PUT', body: { revision: config.revision, motivo: 'Nueva vigencia para futuras garantías', valores: { negocio: { garantia_meses: 9 } } } });
    const nextOrder = await fixture({}, { estado: 'FINALIZADO' });
    const next = await prisma.facturas.create({ data: { orden_id: nextOrder.orden.id_orden, diagnostico_id: nextOrder.diagnostico.id_diagnostico, monto_diagnostico: 100, total: 500 } });
    assert.equal((await prisma.garantias.findUnique({ where: { factura_id: next.id_factura } })).duracion_meses, 9);
    assert.equal((await prisma.garantias.findUnique({ where: { factura_id: factura.id_factura } })).duracion_meses, 6);
  });
  test('Margen inicial se aplica a nuevos repuestos y respeta una ganancia explícita', async () => {
    const a = await api('/repuestos', { method: 'POST', body: { nombre: 'Margen predeterminado', categoria_nombre: 'Fuentes', costo_individual: 100 } , status: 201 });
    const b = await api('/repuestos', { method: 'POST', body: { nombre: 'Margen explícito', categoria_nombre: 'Fuentes', costo_individual: 100, ganancia_cordobas: 0 }, status: 201 });
    assert.equal(a.data.ganancia_cordobas, 20); assert.equal(b.data.ganancia_cordobas, 0);
  });
  test('Facturas de solo diagnóstico aparecen en los reportes financieros', async () => {
    const diagnostico = await prisma.diagnosticos.create({ data: {
      equipo_id: sample.equipo.id_equipo,
      tecnico_id: technician.id_tecnico,
      estado_del_diagnostico: 'COMPLETADO',
      estado_contacto: 'RECHAZADO',
      diagnostico_real: 'Falla irreparable',
    } });
    const factura = await prisma.facturas.create({ data: {
      diagnostico_id: diagnostico.id_diagnostico,
      monto_diagnostico: 150,
      subtotal: 150,
      total: 150,
      metodo_pago: 'Efectivo',
    } });
    const filtro = '?fecha_inicio=2000-01-01&fecha_fin=2030-12-31';
    const facturacion = await api(`/admin_pro/reportes/facturacion${filtro}`);
    assert.ok(facturacion.data.some((row) => row.id_factura === factura.id_factura && row.id_orden === null));
    const fuentes = await api(`/admin_pro/reportes/ganancias_fuentes${filtro}`);
    assert.ok(fuentes.data.some((row) => row.referencia.includes(`Diagnóstico #${diagnostico.id_diagnostico}`)));
  });
  test('Reportes de diagnósticos conservan monedas, fecha y búsqueda en Excel', async () => {
    await fixture({ moneda_presupuesto: 'USD', presupuesto_estimado: 125.5, fecha_hora: new Date('2001-01-17T12:00:00Z') });
    await fixture({ moneda_presupuesto: 'NIO', presupuesto_estimado: 800, fecha_hora: new Date('2001-01-17T12:00:00Z') });
    const route = '/admin_pro/reportes/diagnosticos_detalle?fecha_inicio=2001-01-17&fecha_fin=2001-01-17&buscar=USD';
    const data = await api(route); assert.equal(data.total, 1); assert.equal(data.data[0].moneda_presupuesto, 'USD');
    const excel = await request(route.replace('diagnosticos_detalle?', 'diagnosticos_detalle/excel?'));
    assert.equal(excel.data.subarray(0, 2).toString(), 'PK');
    const book = new ExcelJS.Workbook(); await book.xlsx.load(excel.data); assert.equal(book.worksheets[0].rowCount, 5);
    assert.ok(JSON.stringify(book.worksheets[0].getRow(5).values).includes('USD'));
    await api('/admin_pro/reportes/diagnosticos_detalle?fecha_inicio=2026-02-30', { status: 400 });
    await api('/admin_pro/reportes/historial_equipo?equipo_id=1%20OR%201=1', { status: 400 });
  });
  test('Descargas de diagnósticos y repuestos entregan Excel real con datos legibles', async () => {
    const fresh = await fixture({ presupuesto_estimado: 125.5 });
    await prisma.clientes.update({ where: { id_cliente: fresh.cliente.id_cliente }, data: { telefono: '00123456' } });
    const category = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: 'Categoría exportación' } });
    const piece = await prisma.repuestos.create({ data: { nombre: '=2+3', tipo_repuesto_id: category.id_tipo_repuesto, costo_individual: 35.5 } });
    const detail = await prisma.ordenes_Repuestos.create({ data: { orden_id: fresh.orden.id_orden, repuesto_id: piece.id_repuesto, cantidad_usada: 2, estado_aprobacion: 'APROBADO' } });

    const checkWorkbook = async (route, filename) => {
      const { data, response } = await request(route);
      assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      assert.match(response.headers.get('content-disposition'), new RegExp(filename.replace('.', '\\.')));
      assert.equal(data.subarray(0, 2).toString(), 'PK');
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(data);
      assert.equal(book.worksheets[0].views[0].ySplit, 4);
      return book.worksheets[0];
    };

    const diagnoses = await checkWorkbook('/admin_pro/diagnosticos/reporte', 'diagnosticos-reporte.xlsx');
    const diagnosisRow = diagnoses.getRows(5, diagnoses.rowCount - 4).find((row) => row.getCell(1).value === fresh.diagnostico.id_diagnostico);
    assert.equal(diagnosisRow.getCell(4).value, '00123456');
    assert.equal(diagnosisRow.getCell(10).value, 125.5);

    const parts = await checkWorkbook(`/admin_pro/ordenes/${fresh.orden.id_orden}/repuestos/reporte`, `repuestos-orden-${fresh.orden.id_orden}.xlsx`);
    const partRow = parts.getRows(5, parts.rowCount - 4).find((row) => row.getCell(4).value === detail.id_detalle_repuesto);
    assert.equal(partRow.getCell(5).value, '=2+3');
    assert.equal(partRow.getCell(5).type, ExcelJS.ValueType.String);
    assert.equal(partRow.getCell(10).value, 35.5);
    await api('/admin_pro/ordenes/invalid/repuestos/reporte', { status: 400 });
  });
  test('Inventario usa stock físico y reservas; salidas son solamente entregas reales', async () => {
    const category = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: 'Reserva de prueba' } });
    const piece = await prisma.repuestos.create({ data: { nombre: 'Reserva verificable', tipo_repuesto_id: category.id_tipo_repuesto, stock_actual: 8, stock_minimo: 5, costo_individual: 50 } });
    const fresh = await fixture();
    await prisma.ordenes_Repuestos.create({ data: { orden_id: fresh.orden.id_orden, repuesto_id: piece.id_repuesto, cantidad_usada: 3, estado_aprobacion: 'APROBADO', estado_entrega: 'PENDIENTE' } });
    const r = (await api('/admin_pro/reportes/inventario?buscar=Reserva%20verificable')).data[0];
    assert.equal(r.stock_actual, 8); assert.equal(r.stock_reservado, 3); assert.equal(r.stock_disponible, 5); assert.equal(r.cantidad_usada, 0);
    assert.equal((await api('/admin_pro/reportes/stock_bajo?buscar=Reserva%20verificable')).total, 1);
  });
  test('Todo el catálogo tiene una consulta válida y no expone contraseñas', async () => {
    const catalog = (await api('/admin_pro/reportes/catalogo')).data;
    for (const type of ['actividad_financiera', 'movimientos_contables', 'devoluciones_proveedor', 'calidad_diagnosticos', 'calidad_ordenes', 'reclamos']) {
      assert.ok(catalog.some((item) => item.id === type));
    }
    await api('/admin_pro/reportes/opciones');
    for (const report of catalog) {
      const params = new URLSearchParams({ equipo_id: String(sample.equipo.id_equipo), repuesto_id: '1', orden_id: String(sample.orden.id_orden), fecha_inicio: '2000-01-01', fecha_fin: '2030-12-31' });
      const data = await api(`/admin_pro/reportes/${report.id}?${params}`);
      assert.equal(data.reporte.id, report.id); assert.ok(Array.isArray(data.data)); assert.ok(!JSON.stringify(data).includes('contrasena_hash'));
      if (report.id === 'actividad_financiera') assert.equal(data.resumen_financiero.neto_caja,
        Math.round((data.resumen_financiero.entradas_caja - data.resumen_financiero.salidas_caja) * 100) / 100);
    }
    const financialExcel = await request('/admin_pro/reportes/actividad_financiera/excel?fecha_inicio=2000-01-01&fecha_fin=2030-12-31');
    assert.ok(Buffer.isBuffer(financialExcel.data) && financialExcel.data.length > 1000);
  });
  test('Auditoría antigua se redacta y la paginación no repite movimientos', async () => {
    await prisma.auditoria_Movimientos.create({ data: { tabla: 'Usuarios', operacion: 'LEGACY', datos_nuevos: { nombre: 'Antiguo', contrasena_hash: 'HASH-SECRETO', token: 'TOKEN-SECRETO' } } });
    const first = await api('/admin_pro/auditoria?limit=2'), second = await api('/admin_pro/auditoria?limit=2&page=2');
    assert.equal(first.data.length, 2); assert.equal(second.data.length, 2); assert.ok(!first.data.some((a) => second.data.some((b) => a.id_auditoria === b.id_auditoria)));
    assert.ok(!JSON.stringify(first).includes('HASH-SECRETO')); assert.ok(!JSON.stringify(first).includes('TOKEN-SECRETO'));
  });
  test('Respaldo completo incluye funciones SQL, se descarga y detecta corrupción', async () => {
    const response = await api('/admin_pro/backups/manual', { method: 'POST' });
    const job = response.data.latestBackup; assert.equal(job.estado, 'COMPLETO');
    const dump = job.archivos.find((f) => f.tipo === 'BASE_COMPLETA'); assert.ok(dump);
    const inventoryExcel = job.archivos.find((f) => f.tipo === 'INVENTARIO_EXCEL'); assert.ok(inventoryExcel);
    const inventoryPdf = job.archivos.find((f) => f.tipo === 'INVENTARIO_PDF'); assert.ok(inventoryPdf);
    const excelDownload = await request(`/admin_pro/backups/${job.month}/${inventoryExcel.nombre}/descargar`);
    assert.equal(excelDownload.data.subarray(0, 2).toString(), 'PK');
    const inventoryBook = new ExcelJS.Workbook(); await inventoryBook.xlsx.load(excelDownload.data);
    assert.equal(inventoryBook.worksheets[0].getCell('A1').value, 'Inventario de repuestos');
    assert.equal(inventoryBook.worksheets[0].views[0].ySplit, 4);
    assert.equal(typeof inventoryBook.worksheets[0].getCell('F5').value, 'number');
    const pdfDownload = await request(`/admin_pro/backups/${job.month}/${inventoryPdf.nombre}/descargar`);
    assert.equal(pdfDownload.data.subarray(0, 5).toString(), '%PDF-');
    await api(`/admin_pro/backups/${job.month}/${job.manifest}/verificar`, { method: 'POST' });
    const download = await request(`/admin_pro/backups/${job.month}/${dump.nombre}/descargar`);
    assert.equal(download.data.subarray(0, 5).toString(), 'PGDMP');
    const location = await resolveBackupFile(job.month, dump.nombre), original = await readFile(location);
    await writeFile(location, 'archivo dañado');
    await api(`/admin_pro/backups/${job.month}/${job.manifest}/verificar`, { method: 'POST', status: 409 });
    assert.equal((await getBackupSummary()).jobs.find((j) => j.id === job.id).integridad.resultado, 'ERROR');
    await writeFile(location, original);
    await assert.rejects(resolveBackupFile(job.month, '../fuera.dump'), { status: 400 });
    // Restauración real limitada a otra base temporal, nunca sobre la base del taller.
    const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
    const db = new URL(process.env.SQL_DATABASE_URL), restoreName = `${databaseName}_restore`;
    const client = new pg.Client({ connectionString: db.href }); await client.connect();
    try {
      await client.query(`CREATE DATABASE "${restoreName}"`);
      await promisify(execFile)(await postgresTool('pg_restore'), ['--host', db.hostname, '--port', db.port || '5432', '--username', decodeURIComponent(db.username), '--dbname', restoreName, '--no-owner', '--no-privileges', '--exit-on-error', location], { env: { ...process.env, PGPASSWORD: decodeURIComponent(db.password) }, timeout: 60000 });
      const restoredUrl = new URL(db); restoredUrl.pathname = `/${restoreName}`;
      const restored = new pg.Client({ connectionString: restoredUrl.href }); await restored.connect();
      try { const result = await restored.query("SELECT to_regprocedure('admin_pro.resumen_general(date,date)') IS NOT NULL AS restored"); assert.equal(result.rows[0].restored, true);
        assert.equal(Number((await restored.query('SELECT COUNT(*) AS total FROM "Usuarios"')).rows[0].total), await prisma.usuarios.count()); }
      finally { await restored.end(); }
    } finally { assert.match(restoreName, /^cte_administracion_test_[0-9a-f]{32}_restore$/); await client.query(`DROP DATABASE IF EXISTS "${restoreName}" WITH (FORCE)`); await client.end(); }
  });
  test('Fallo de pg_dump se identifica como copia parcial y no reemplaza la última completa', async () => {
    const previous = (await getBackupSummary()).latestComplete.id, oldPath = process.env.PG_DUMP_PATH;
    try { process.env.PG_DUMP_PATH = 'pg_dump_unavailable_for_test'; const data = await api('/admin_pro/backups/manual', { method: 'POST' }); assert.equal(data.data.latestBackup.estado, 'PARCIAL'); assert.equal(data.data.latestComplete.id, previous); }
    finally { if (oldPath === undefined) delete process.env.PG_DUMP_PATH; else process.env.PG_DUMP_PATH = oldPath; }
  });
  test('Bloqueo entre procesos impide respaldos simultáneos', async () => {
    const client = new pg.Client({ connectionString: process.env.SQL_DATABASE_URL }); await client.connect();
    try { await client.query('SELECT pg_advisory_lock(734822)'); await api('/admin_pro/backups/manual', { method: 'POST', status: 409 }); }
    finally { await client.query('SELECT pg_advisory_unlock(734822)'); await client.end(); }
  });
  test('Una ejecución pendiente persiste y solo genera una copia al retomarse', async () => {
    const settings = (await getAdminSettings()).valores.respaldos; await synchronizeBackupSchedule(settings);
    await prisma.$executeRaw`UPDATE "EstadoRespaldos" SET proxima_ejecucion = now() - interval '1 hour' WHERE id = 1`;
    await synchronizeBackupSchedule(settings);
    const beforeCount = (await getBackupSummary()).jobs.length;
    await Promise.all([runScheduledBackup(), runScheduledBackup()]);
    const summary = await getBackupSummary(); assert.equal(summary.jobs.length, beforeCount + 1); assert.equal(summary.jobs[0].origen, 'programado');
    assert.ok(new Date(summary.state.proxima_ejecucion) > new Date()); await runScheduledBackup(); assert.equal((await getBackupSummary()).jobs.length, beforeCount + 1);
  });
  test('Conservación mantiene las copias parciales y archivos antiguos sin manifiesto', async () => {
    const initialConfig = await getAdminSettings();
    await api('/admin_pro/configuracion', { method: 'PUT', body: { revision: initialConfig.revision, motivo: 'Desactivar conservación durante preparación de prueba', valores: { respaldos: { conservacion_dias: 0 } } } });
    const latest = (await getBackupSummary()).latestComplete;
    const directory = path.join(process.env.BACKUP_ROOT, latest.month);
    const oldJobs = [];
    for (const estado of ['COMPLETO', 'PARCIAL']) {
      const old = { ...latest, id: `retencion_${estado}`, inicio: '2001-01-01T12:00:00Z', fin: '2001-01-01T12:01:00Z', estado,
        manifest: `backup_meta_retencion_${estado}.json`, archivos: [] };
      for (const file of latest.archivos) {
        const nombre = `retencion_${estado}_${file.nombre}`;
        await copyFile(path.join(directory, file.nombre), path.join(directory, nombre));
        old.archivos.push({ ...file, nombre });
      }
      await writeFile(path.join(directory, old.manifest), JSON.stringify(old)); oldJobs.push(old);
    }
    const legacy = path.join(directory, 'copia_antigua_sin_manifiesto.json'); await writeFile(legacy, '{}');
    await api('/admin_pro/backups/manual', { method: 'POST' });
    for (const job of oldJobs) await access(path.join(directory, job.manifest));
    const config = await getAdminSettings();
    await api('/admin_pro/configuracion', { method: 'PUT', body: { revision: config.revision, motivo: 'Conservación temporal de prueba', valores: { respaldos: { conservacion_dias: 1 } } } });
    const generated = (await api('/admin_pro/backups/manual', { method: 'POST' })).data.latestBackup;
    assert.equal(generated.estado, 'COMPLETO');
    await assert.rejects(access(path.join(directory, oldJobs[0].manifest)), { code: 'ENOENT' });
    for (const file of oldJobs[0].archivos) await assert.rejects(access(path.join(directory, file.nombre)), { code: 'ENOENT' });
    await access(path.join(directory, oldJobs[1].manifest)); await access(legacy);
    for (const file of oldJobs[1].archivos) await access(path.join(directory, file.nombre));
    assert.equal((await getBackupSummary()).latestComplete.id, generated.id);
    for (const file of generated.archivos) await access(await resolveBackupFile(generated.month, file.nombre));
  });
  test('Fallo programado reintenta a cinco y diez minutos y luego retoma el calendario', async () => {
    const previous = (await getBackupSummary()).latestComplete.id, oldPath = process.env.PG_DUMP_PATH;
    try {
      process.env.PG_DUMP_PATH = 'pg_dump_unavailable_for_test';
      for (let attempt = 1; attempt <= 3; attempt++) {
        await prisma.$executeRaw`UPDATE "EstadoRespaldos" SET proxima_ejecucion = now() - interval '1 minute' WHERE id = 1`;
        await runScheduledBackup();
        const summary = await getBackupSummary(); assert.equal(summary.latestComplete.id, previous);
        assert.equal(summary.jobs[0].estado, 'PARCIAL'); assert.equal(summary.state.reintentos, attempt === 3 ? 0 : attempt);
        assert.ok(summary.state.ultimo_error);
        const remaining = new Date(summary.state.proxima_ejecucion) - Date.now();
        if (attempt < 3) assert.ok(remaining > attempt * 300000 - 10000 && remaining <= attempt * 300000);
        else assert.ok(remaining > 600000);
        const count = summary.jobs.length; await runScheduledBackup(); assert.equal((await getBackupSummary()).jobs.length, count);
      }
    } finally { if (oldPath === undefined) delete process.env.PG_DUMP_PATH; else process.env.PG_DUMP_PATH = oldPath; }
    await prisma.$executeRaw`UPDATE "EstadoRespaldos" SET proxima_ejecucion = now() - interval '1 minute' WHERE id = 1`;
    await runScheduledBackup();
    const recovered = await getBackupSummary(); assert.notEqual(recovered.latestComplete.id, previous);
    assert.equal(recovered.state.reintentos, 0); assert.equal(recovered.state.ultimo_error, null);
  });
  test('Recupera una versión completa y conserva una copia del estado reemplazado', async () => {
    const job = (await api('/admin_pro/backups/manual', { method: 'POST' })).data.latestBackup;
    assert.equal(job.estado, 'COMPLETO');
    const marker = await prisma.clientes.create({ data: { nombre: 'Cliente creado después del respaldo' } });
    const route = `/admin_pro/backups/${job.month}/${job.manifest}/restaurar`;
    await api(route, { method: 'POST', body: { respaldo_id: job.id, confirmacion: 'incorrecta' }, status: 400 });
    await api(route, { method: 'POST', token: denied.token, body: { respaldo_id: job.id, confirmacion: 'RESTAURAR' }, status: 403 });
    assert.ok(await prisma.clientes.findUnique({ where: { id_cliente: marker.id_cliente } }));
    const restored = await api(route, { method: 'POST', body: { respaldo_id: job.id, confirmacion: 'RESTAURAR' } });
    assert.equal(restored.data.estado, 'COMPLETADO');
    assert.equal(restored.data.respaldo_id, job.id);
    assert.equal(await prisma.clientes.findUnique({ where: { id_cliente: marker.id_cliente } }), null);
    const safety = (await getBackupSummary()).jobs.find((j) => j.id === restored.data.copia_previa.id);
    assert.equal(safety?.estado, 'COMPLETO');
    assert.ok(safety.archivos.some((file) => file.tipo === 'BASE_COMPLETA'));
  });
  test('Desactivaciones simultáneas conservan al menos un administrador activo', async () => {
    const other = await account('segundo_administrador'); await login(other);
    const responses = await Promise.all([fetch(`${base}/admin_pro/usuarios/${other.id_usuario}`, { method: 'PUT', headers: { Authorization: `Bearer ${actor.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: false }) }),
      fetch(`${base}/admin_pro/usuarios/${actor.id_usuario}`, { method: 'PUT', headers: { Authorization: `Bearer ${other.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: false }) })]);
    assert.equal(responses.filter((r) => r.status === 200).length, 1); assert.ok(responses.some((r) => [401, 409].includes(r.status)));
    assert.equal(await prisma.usuarios.count({ where: { activo: true, rol: 'Administrador' } }), 1);
  });
}
