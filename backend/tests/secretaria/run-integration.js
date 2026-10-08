import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
const suite = process.argv[2] || 'secretaria';
if (!['secretaria', 'jefeTecnico', 'tecnico', 'administracion', 'notificaciones', 'areas'].includes(suite)) throw new Error('Suite de integración no reconocida.');
const databaseName = `cte_${suite.toLowerCase()}_test_${randomUUID().replaceAll('-', '')}`;
const localHosts = new Set(['db', 'localhost', '127.0.0.1', '[::1]']);
const sourceUrl = process.env.CTE_TEST_DATABASE_ADMIN_URL || process.env.SQL_DATABASE_URL || process.env.DATABASE_URL;
if (!sourceUrl) throw new Error('Ejecute con Docker o configure CTE_TEST_DATABASE_ADMIN_URL para PostgreSQL local.');
let adminUrl;
try { adminUrl = new URL(sourceUrl); }
catch { throw new Error('La conexión de pruebas debe ser una URL PostgreSQL local válida.'); }
if (!['postgres:', 'postgresql:'].includes(adminUrl.protocol) || !localHosts.has(adminUrl.hostname)) {
  throw new Error('Las pruebas requieren PostgreSQL local; no se conectan a servidores publicados.');
}
adminUrl.pathname = '/postgres';
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${databaseName}`;
const testEnv = {
  ...process.env, NODE_ENV: 'test', DATABASE_URL: testUrl.href, SQL_DATABASE_URL: testUrl.href,
  [{ secretaria: 'CTE_SECRETARIA_TEST_DATABASE', jefeTecnico: 'CTE_JEFE_TEST_DATABASE', tecnico: 'CTE_TECNICO_TEST_DATABASE', administracion: 'CTE_ADMIN_TEST_DATABASE', notificaciones: 'CTE_NOTIFICACIONES_TEST_DATABASE', areas: 'CTE_AREAS_TEST_DATABASE' }[suite]]: databaseName,
  JWT_SECRET: randomUUID(), CHECKPOINT_DISABLE: '1',
};
const runNode = (args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { cwd: backendRoot, env: testEnv, stdio: 'inherit' });
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(`La verificación terminó con ${signal || `código ${code}`}.`));
  });
});

const admin = new pg.Client({ connectionString: adminUrl.href, connectionTimeoutMillis: 10000 });
const expandSql = async (relative, ancestors = []) => {
  if (ancestors.includes(relative)) throw new Error(`Inclusión SQL circular: ${relative}`);
  const source = await readFile(path.join(backendRoot, relative), 'utf8');
  let expanded = '', position = 0;
  // AdminPro.sql también contiene \i: se respeta el orden del cargador real.
  for (const match of source.matchAll(/^\\i[ \t]+(\S+)[ \t]*\r?$/gm)) {
    expanded += source.slice(position, match.index);
    expanded += await expandSql(match[1], [...ancestors, relative]);
    position = match.index + match[0].length;
  }
  return expanded + source.slice(position);
};
let created = false;
let backupTestRoot = null;
try {
  if (suite === 'administracion') {
    backupTestRoot = await mkdtemp(path.join(os.tmpdir(), 'cte_admin_test_'));
    testEnv.BACKUP_ROOT = backupTestRoot;
    testEnv.BACKUP_DISPLAY_ROOT = 'Respaldos temporales de prueba';
  }
  await admin.connect();
  // El nombre se genera aquí, no puede ser suministrado por el usuario ni por el .env.
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  console.log(`Base temporal creada: ${databaseName}`);
  await runNode([path.join(backendRoot, 'node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate']);
  const db = new pg.Client({ connectionString: testUrl.href });
  try {
    await db.connect();
    await db.query(await expandSql('scripts/load_functions.sql'));
    // Esta comprobación SQL previa también se ejecuta sobre la base temporal.
    if (suite !== 'notificaciones') await db.query(await readFile(path.join(backendRoot, 'tests/sql/historial_estados_smoke.sql'), 'utf8'));
    console.log('Esquema, reglas SQL e historial preparados.');
  } finally {
    await db.end();
  }
  const namePattern = process.argv[3];
  await runNode(['--test', '--test-reporter=spec', '--test-concurrency=1', ...(namePattern ? ['--test-name-pattern', namePattern] : []), `tests/${suite}/api.test.js`]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    if (created) {
      if (!/^cte_(secretaria|jefetecnico|tecnico|administracion|notificaciones|areas)_test_[0-9a-f]{32}$/.test(databaseName)) throw new Error('Nombre de limpieza inválido.');
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      console.log(`Base temporal eliminada: ${databaseName}`);
    }
  } catch (error) {
    console.error(`No se pudo retirar la base temporal ${databaseName}: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await admin.end();
    if (backupTestRoot) {
      const resolved = path.resolve(backupTestRoot);
      if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !/^cte_admin_test_[a-zA-Z0-9]+$/.test(path.basename(resolved))) throw new Error('Ruta de limpieza temporal inválida.');
      await rm(resolved, { recursive: true, force: true });
    }
  }
}
