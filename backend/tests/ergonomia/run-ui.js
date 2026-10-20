// Entorno desechable para comprobar la interfaz; CTE_UI_GROUP2=1 añade supervisión y posventa.
// Inicie con una conexión administrativa PostgreSQL LOCAL y escriba stop al terminar.
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
const frontendRoot = path.resolve(backendRoot, '../frontend');
const adminUrl = new URL(process.env.CTE_TEST_DATABASE_ADMIN_URL);
if (!['postgres:', 'postgresql:'].includes(adminUrl.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(adminUrl.hostname)) throw new Error('Se exige una base local de pruebas.');
adminUrl.pathname = '/postgres';
const name = `cte_ergonomia_test_${randomUUID().replaceAll('-', '')}`;
const testUrl = new URL(adminUrl); testUrl.pathname = `/${name}`;
const backupRoot = path.resolve(backendRoot, 'tests/ergonomia/runtime', name);
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: testUrl.href, SQL_DATABASE_URL: testUrl.href,
  JWT_SECRET: randomUUID(), CORS_ORIGIN: 'http://127.0.0.1:5174,http://localhost:5174',
  CHECKPOINT_DISABLE: '1', RESEND_API_KEY: '', VERCEL: '0', BACKUP_ROOT: backupRoot, BACKUP_STORAGE: 'local' });
const admin = new pg.Client({ connectionString: adminUrl.href, connectionTimeoutMillis: 10000 });
let prisma, server, vite, created = false, stopping = false;
const cleanup = async () => {
  if (stopping) return;
  stopping = true;
  if (vite && vite.exitCode === null) {
    const exited = new Promise((resolve) => vite.once('exit', resolve)); vite.kill(); await exited;
  }
  server?.closeAllConnections();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await prisma?.$disconnect();
  if (created) {
    if (!/^cte_ergonomia_test_[0-9a-f]{32}$/.test(name) || testUrl.pathname !== `/${name}`) throw new Error('Nombre temporal inválido.');
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    console.log(`Base temporal eliminada: ${name}`);
  }
  await admin.end();
  if (path.dirname(backupRoot) !== path.resolve(backendRoot, 'tests/ergonomia/runtime') || path.basename(backupRoot) !== name) throw new Error('Carpeta temporal inválida.');
  await rm(backupRoot, { recursive: true, force: true });
};
const expandSql = async (relative, ancestors = []) => {
  if (ancestors.includes(relative)) throw new Error('Inclusión SQL circular');
  const source = await readFile(path.join(backendRoot, relative), 'utf8');
  let expanded = '', position = 0;
  for (const match of source.matchAll(/^\\i[ \t]+(\S+)[ \t]*\r?$/gm)) {
    expanded += source.slice(position, match.index) + await expandSql(match[1], [...ancestors, relative]);
    position = match.index + match[0].length;
  }
  return expanded + source.slice(position);
};
try {
  await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`); created = true;
  console.log(`Base temporal creada: ${name}`);
  await new Promise((resolve, reject) => {
    const push = spawn(process.execPath, [path.join(backendRoot, 'node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'], { cwd: backendRoot, env: process.env, stdio: 'inherit' });
    push.on('error', reject); push.on('exit', (code) => code === 0 ? resolve() : reject(new Error('No se pudo crear el esquema temporal')));
  });
  const sql = new pg.Client({ connectionString: testUrl.href });
  try { await sql.connect(); await sql.query(await expandSql('scripts/load_functions.sql')); } finally { await sql.end(); }
  ({ default: prisma } = await import('../../src/app/prismaClient.js'));
  const { initializeAdministrationStorage } = await import('../../src/services/adminSettingsService.js');
  await initializeAdministrationStorage();
  const users = {};
  for (const [key, rol] of Object.entries({ recepcion: 'Recepcion', servicio: 'ServicioCliente', bodega: 'Bodega', tecnico: 'Tecnico' })) {
    users[key] = await prisma.usuarios.create({ data: { nombre_usuario: `ui_${key}`, rol, contrasena_hash: await bcrypt.hash('TecladoPrueba2026!', 10) } });
  }
  const tech = await prisma.tecnicos.create({ data: { usuario_id: users.tecnico.id_usuario, nombre: 'Técnico de prueba' } });
  const cliente = await prisma.clientes.create({ data: { nombre: 'Cliente Teclado', telefono: '88880000' } });
  for (const kind of ['libre', 'diagnostico', 'presupuesto', 'reparacion', 'facturacion']) {
    const equipo = await prisma.equipos.create({ data: { cliente_id: cliente.id_cliente, tipo: 'Laptop', marca: 'Prueba', modelo: kind, numero_serie: `TECLADO-${kind}` } });
    if (kind === 'libre') continue;
    const diagnostico = await prisma.diagnosticos.create({ data: { equipo_id: equipo.id_equipo, tecnico_id: tech.id_tecnico,
      falla_reportada: 'No enciende de forma estable', estado_del_diagnostico: kind === 'diagnostico' ? 'EN_REVISION' : 'COMPLETADO',
      estado_contacto: kind === 'presupuesto' ? 'DOCUMENTO_ENVIADO' : 'APROBADO', Estado_aprobacion: 'Aprobado', calidad_estado: kind === 'diagnostico' ? 'PENDIENTE' : 'APROBADO',
      diagnostico_real: kind === 'diagnostico' ? null : 'Fuente averiada', presupuesto_estimado: 100,
      fecha_asignacion: new Date(), fecha_inicio: kind === 'diagnostico' ? new Date() : null } });
    if (!['diagnostico', 'presupuesto'].includes(kind)) await prisma.ordenes.create({ data: { diagnostico_id: diagnostico.id_diagnostico, tecnico_id: tech.id_tecnico,
      estado: kind === 'reparacion' ? 'EN_REPARACION' : 'FINALIZADO', monto_autorizado: 100, fecha_aprobacion_cliente: new Date(),
      fecha_inicio_reparacion: new Date(), calidad_estado: kind === 'facturacion' ? 'APROBADO' : 'PENDIENTE', resultado_final: kind === 'facturacion' ? 'REPARADO' : null } });
  }
  const category = await prisma.categorias_Repuestos.create({ data: { nombre_tipo: 'Fuentes de prueba', electronico: 'Laptop' } });
  const provider = await prisma.proveedores.create({ data: { nombre: 'Proveedor Teclado', descontinuada: false } });
  const piece = await prisma.repuestos.create({ data: { nombre: 'Fuente de prueba', tipo_repuesto_id: category.id_tipo_repuesto, proveedor_id: provider.id_proveedor, costo_individual: 10, ganancia_cordobas: 2 } });
  await prisma.compras.create({ data: { repuesto_id: piece.id_repuesto, proveedor_id: provider.id_proveedor, cantidad: 5, costo_unitario: 10, documento: 'TECLADO-001', metodo_pago: 'Efectivo' } });
  if (process.env.CTE_UI_GROUP2 === '1') {
    const { seedGroupTwo } = await import('./seed-group-two.js');
    await seedGroupTwo(prisma, tech);
  }
  if (process.env.CTE_UI_GROUP3 === '1') {
    for (const [key, rol] of Object.entries({ admin: 'Administrador', contabilidad: 'Contabilidad', secretaria: 'Secretaria' })) {
      await prisma.usuarios.create({ data: { nombre_usuario: `ui_${key}`, rol, contrasena_hash: await bcrypt.hash('TecladoPrueba2026!', 10) } });
    }
    console.log('Grupo 3: ui_admin / ui_contabilidad / ui_secretaria (misma clave temporal).');
  }
  const { default: app } = await import('../../src/app/app.js');
  server = await new Promise((resolve, reject) => { const listening = app.listen(5007, '127.0.0.1', () => resolve(listening)); listening.on('error', reject); });
  vite = spawn(process.execPath, [path.join(frontendRoot, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
    cwd: frontendRoot, env: { ...process.env, VITE_API_URL: '/api', VITE_PROXY_TARGET: 'http://127.0.0.1:5007' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  vite.stdout.on('data', (chunk) => process.stdout.write(chunk)); vite.stderr.on('data', (chunk) => process.stderr.write(chunk));
  vite.on('error', async (error) => { console.error(error.message); await cleanup(); process.exit(1); });
  console.log('UI temporal: http://127.0.0.1:5174 · usuarios ui_recepcion/ui_servicio/ui_bodega/ui_tecnico · clave TecladoPrueba2026!');
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (text) => { if (text.trim() === 'stop') { await cleanup(); process.exit(0); } });
  process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
  process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });
} catch (error) { console.error(error.message); await cleanup(); process.exitCode = 1; }
