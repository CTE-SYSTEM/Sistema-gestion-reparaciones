import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import prisma from '../app/prismaClient.js';
import { databaseConnection, recordAdminAction } from './adminSettingsService.js';
import { createSafetyBackup, postgresTool, resolveBackupFile, verifyBackup } from './backupService.js';
import { restoreNeonSnapshot } from './neonSnapshots.js';
import { fail } from '../utils/adminPolicy.js';

const execFileAsync = promisify(execFile);
let restoring = false;
export const isBackupRestoreInProgress = () => restoring;

const restoreDump = async (file) => {
  const url = new URL(databaseConnection());
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) fail(503, 'No se pudo identificar la base de datos para restaurarla.');
  const restoreTool = await postgresTool('pg_restore');
  const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
  if (url.searchParams.get('sslmode')) env.PGSSLMODE = url.searchParams.get('sslmode');
  await prisma.$disconnect();
  await execFileAsync(restoreTool, [
    '--host', url.hostname, '--port', url.port || '5432',
    '--username', decodeURIComponent(url.username) || 'postgres', '--dbname', database,
    '--clean', '--if-exists', '--single-transaction', '--exit-on-error',
    '--no-owner', '--no-privileges', file,
  ], { env, timeout: 600000, maxBuffer: 4 * 1024 * 1024 });
};

export const restoreBackup = async (month, manifest, input, user) => {
  if (restoring) fail(409, 'Ya hay una restauración en ejecución.');
  if (input?.confirmacion !== 'RESTAURAR' || typeof input?.respaldo_id !== 'string') {
    fail(400, 'Escriba RESTAURAR para confirmar la recuperación de los datos.');
  }
  restoring = true;
  const lock = new pg.Client({ connectionString: databaseConnection(), connectionTimeoutMillis: 10000 });
  let restoreLocked = false, backupLocked = false, safety;
  try {
    await lock.connect();
    restoreLocked = (await lock.query('SELECT pg_try_advisory_lock(734823) AS acquired')).rows[0].acquired;
    if (!restoreLocked) fail(409, 'Ya hay una restauración en ejecución.');
    const { data: job } = await verifyBackup(month, manifest, user);
    if (job.estado !== 'COMPLETO' || job.id !== input.respaldo_id || job.month !== month || job.manifest !== manifest) {
      fail(409, 'Seleccione una copia completa y confirme su versión exacta.');
    }
    const sources = job.archivos.filter((file) => ['BASE_COMPLETA', 'BASE_NEON_SNAPSHOT'].includes(file.tipo));
    if (sources.length !== 1) fail(409, 'La copia no contiene una única base restaurable.');

    safety = await createSafetyBackup(user);
    if (safety.estado !== 'COMPLETO') fail(409, 'No se pudo guardar la base actual. La restauración no se inició.');
    backupLocked = (await lock.query('SELECT pg_try_advisory_lock(734822) AS acquired')).rows[0].acquired;
    if (!backupLocked) fail(409, 'Otro respaldo está en ejecución. La restauración no se inició.');

    // Releer la fuente después de crear la copia de seguridad y antes de modificar la base.
    const source = await resolveBackupFile(month, sources[0].nombre);
    let status = 'COMPLETADO';
    if (sources[0].tipo === 'BASE_NEON_SNAPSHOT') {
      const snapshot = JSON.parse(await fs.readFile(source, 'utf8'));
      await restoreNeonSnapshot(snapshot);
      status = 'SOLICITADO';
    } else {
      await restoreDump(source);
    }
    try {
      await recordAdminAction(null, 'Respaldos', 'RESTAURACION', null,
        { respaldo_id: job.id, copia_previa_id: safety.id, solicitante: user?.username, estado: status },
        `Recuperación del respaldo ${job.id}.`);
    } catch (error) { console.error('[Respaldos] No se pudo registrar la restauración:', error.message); }
    return { data: { estado: status, respaldo_id: job.id, copia_previa: safety },
      message: status === 'COMPLETADO'
        ? 'Datos restaurados. Se conservó una copia del estado anterior.'
        : 'Neon aceptó la solicitud de restauración. Se conservó una copia del estado anterior.' };
  } catch (error) {
    if (safety) error.safetyBackupId = safety.id;
    throw error;
  } finally {
    if (backupLocked) await lock.query('SELECT pg_advisory_unlock(734822)').catch(() => {});
    if (restoreLocked) await lock.query('SELECT pg_advisory_unlock(734823)').catch(() => {});
    await lock.end().catch(() => {});
    restoring = false;
  }
};
