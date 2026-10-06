import fs from 'fs/promises';
import path from 'path';
import { createWriteStream, createReadStream } from 'fs';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import prisma from '../app/prismaClient.js';
import { databaseConnection, getBusinessSettings, recordAdminAction } from './adminSettingsService.js';
import { fail } from '../utils/adminPolicy.js';
import { nextBackupDate, nicaraguaParts, validateBackupLocation } from '../utils/backupSchedule.js';

const execFileAsync = promisify(execFile);

const CONTAINER_BACKUP_ROOT = path.join(path.sep, 'backup', 'CTE-Backup');
const BACKUP_ROOT = process.env.BACKUP_ROOT || CONTAINER_BACKUP_ROOT;
const BACKUP_DISPLAY_ROOT = process.env.BACKUP_DISPLAY_ROOT || BACKUP_ROOT;
const PRODUCT_BACKUP_NAME = 'productos';
let scheduler = null;
let polling = false;

const formatDate = (date) => {
  const p = nicaraguaParts(date);
  const year = p.year;
  const month = String(p.month).padStart(2, '0');
  const day = String(p.day).padStart(2, '0');
  const hour = String(p.hour).padStart(2, '0');
  const minute = String(p.minute).padStart(2, '0');
  const second = String(p.second).padStart(2, '0');
  return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
};

const getBackupMonthFolder = (date = new Date()) => {
  const p = nicaraguaParts(date);
  const year = p.year;
  const month = String(p.month).padStart(2, '0');
  return path.join(BACKUP_ROOT, `${year}-${month}`);
};

const createDirectory = async (folderPath) => {
  await fs.mkdir(folderPath, { recursive: true });
  return folderPath;
};

export const postgresTool = async (tool) => {
  if (!['pg_dump', 'pg_restore'].includes(tool)) fail(400, 'Herramienta de respaldo inválida.');
  const override = process.env[tool === 'pg_dump' ? 'PG_DUMP_PATH' : 'PG_RESTORE_PATH'];
  if (override) return override;
  const [server] = await prisma.$queryRaw`SELECT current_setting('server_version_num') AS version`;
  const major = Math.floor(Number(server.version) / 10000);
  if (process.platform !== 'win32') {
    const candidate = `/usr/lib/postgresql${major}/bin/${tool}`;
    try { await fs.access(candidate); return candidate; } catch { /* Instalaciones con binarios en PATH. */ }
  }
  return process.platform === 'win32' ? `${tool}.exe` : tool;
};
const runPgDump = async (outputFile) => {
  const pgDumpCommand = await postgresTool('pg_dump');
  if (!process.env.DATABASE_URL && !process.env.SQL_DATABASE_URL) {
    throw new Error('DATABASE_URL no está definido');
  }

  try {
    const [server] = await prisma.$queryRaw`SELECT current_setting('server_version_num') AS version`;
    const clientVersion = await execFileAsync(pgDumpCommand, ['--version'], { timeout: 10000 });
    if (Number(clientVersion.stdout.match(/(\d+)\./)?.[1]) !== Math.floor(Number(server.version) / 10000)) {
      throw new Error('La versión mayor de pg_dump debe coincidir con PostgreSQL para asegurar compatibilidad de restauración.');
    }
    const dbUrl = new URL(databaseConnection());
    const dbName = dbUrl.pathname?.replace(/^\//, '') || '';
    const args = [
      '--host', dbUrl.hostname || 'localhost',
      '--port', dbUrl.port || '5432',
      '--username', decodeURIComponent(dbUrl.username) || 'postgres',
      '--dbname', decodeURIComponent(dbName),
      '--format=custom', '--no-owner', '--no-privileges',
      '--file', outputFile,
    ];

    const env = { ...process.env };
    if (dbUrl.password) {
      env.PGPASSWORD = decodeURIComponent(dbUrl.password);
    }
    if (dbUrl.searchParams.get('sslmode')) {
      env.PGSSLMODE = dbUrl.searchParams.get('sslmode');
    }

    await execFileAsync(pgDumpCommand, args, { env, timeout: 300000, maxBuffer: 1024 * 1024 });
    return outputFile;
  } catch (error) {
    throw new Error(`pg_dump no está disponible o falló: ${error.message}`);
  }
};

const queryAllTablesJson = async (backupFolder, timestamp) => {
  const tablesResult = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  const allTables = {};

  for (const row of tablesResult) {
    const tableName = row.table_name || row.tablename || Object.values(row)[0];
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${String(tableName).replaceAll('"', '""')}"`);
      allTables[tableName] = rows;
    } catch (error) {
      allTables[tableName] = { error: error.message };
    }
  }

  const replacer = (_, value) => (typeof value === 'bigint' ? value.toString() : value);
  const filePath = path.join(backupFolder, `sistema_${timestamp}.json`);
  await fs.writeFile(filePath, JSON.stringify(allTables, replacer, 2), 'utf8');
  return filePath;
};

const generateProductsExcel = async (backupFolder, products, timestamp) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Productos');

  sheet.columns = [
    { header: 'ID', key: 'id_repuesto', width: 10 },
    { header: 'Nombre', key: 'nombre', width: 35 },
    { header: 'Descripción', key: 'descripcion', width: 50 },
    { header: 'Categoria', key: 'categoria', width: 25 },
    { header: 'Proveedor', key: 'proveedor', width: 30 },
    { header: 'Costo', key: 'costo_individual', width: 15 },
    { header: 'Stock', key: 'stock', width: 10 },
    { header: 'Activo', key: 'activo', width: 10 },
    { header: 'Descontinuado', key: 'descontinuada', width: 15 },
  ];

  products.forEach((product) => {
    sheet.addRow({
      id_repuesto: product.id_repuesto,
      nombre: product.nombre || '',
      descripcion: product.descripcion || '',
      categoria: product.categoria?.nombre_tipo || '',
      proveedor: product.proveedor?.nombre || '',
      costo_individual: product.costo_individual ? String(product.costo_individual) : '0',
      stock: product.stock_actual ?? 0,
      activo: product.activo ? 'SI' : 'NO',
      descontinuada: product.descontinuada ? 'SI' : 'NO',
    });
  });

  const filePath = path.join(backupFolder, `${PRODUCT_BACKUP_NAME}_${timestamp}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

const generateProductsPdf = async (backupFolder, products, timestamp) => {
  const filePath = path.join(backupFolder, `${PRODUCT_BACKUP_NAME}_${timestamp}.pdf`);
  const doc = new PDFDocument({ margin: 32, size: 'A4', layout: 'landscape' });
  const writeStream = createWriteStream(filePath);
  doc.pipe(writeStream);

  doc.fontSize(18).text('Backup de Productos - Repuestos', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('gray').text(`Fecha de backup: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(1);

  const columns = ['ID', 'Nombre', 'Categoria', 'Proveedor', 'Costo', 'Stock', 'Activo', 'Descontinuado'];
  const columnWidths = [40, 150, 100, 100, 60, 40, 40, 60];

  doc.font('Helvetica-Bold').fontSize(9);
  columns.forEach((column, index) => {
    doc.text(column, { continued: index !== columns.length - 1, width: columnWidths[index], underline: false });
  });
  doc.moveDown(0.3);
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(8);

  for (const product of products) {
    const row = [
      String(product.id_repuesto),
      product.nombre || '-',
      product.categoria?.nombre_tipo || '-',
      product.proveedor?.nombre || '-',
      product.costo_individual ? String(product.costo_individual) : '0',
      String(product.stock_actual ?? 0),
      product.activo ? 'SI' : 'NO',
      product.descontinuada ? 'SI' : 'NO',
    ];

    row.forEach((value, index) => {
      doc.text(value, { continued: index !== row.length - 1, width: columnWidths[index] });
    });
    doc.moveDown(0.4);

    if (doc.y > doc.page.height - 80) {
      doc.addPage();
      doc.font('Helvetica').fontSize(8);
    }
  }

  doc.end();

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    doc.on('error', reject);
  });

  return filePath;
};

const queryProducts = async () => {
  return prisma.repuestos.findMany({
    include: {
      categoria: true,
      proveedor: true,
    },
    orderBy: { id_repuesto: 'asc' },
  });
};

const createReportFile = async (backupFolder, fileName, lines) => {
  const filePath = path.join(backupFolder, fileName);
  await fs.writeFile(filePath, lines.join('\n'), 'utf8');
  return filePath;
};

const checksum = async (filePath) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
};

export const resolveBackupFile = async (month, file) => {
  validateBackupLocation(month, file);
  const root = await fs.realpath(BACKUP_ROOT);
  const monthPath = path.join(root, month);
  const location = path.join(monthPath, file);
  try {
    if ((await fs.lstat(monthPath)).isSymbolicLink() || (await fs.lstat(location)).isSymbolicLink()) fail(400, 'No se permiten enlaces en respaldos.');
    const real = await fs.realpath(location);
    if (!real.startsWith(`${root}${path.sep}`) || !(await fs.stat(real)).isFile()) fail(400, 'Archivo no válido.');
    return real;
  } catch (error) {
    if (error.code === 'ENOENT') fail(404, 'El archivo ya no está disponible.');
    throw error;
  }
};

const runBackup = async (user, origin = 'manual') => {
  const lock = new pg.Client({ connectionString: databaseConnection(), connectionTimeoutMillis: 10000 });
  let acquired = false;
  let scheduledAttempt = false, scheduleUpdated = false;
  try {
    await lock.connect();
    acquired = (await lock.query('SELECT pg_try_advisory_lock(734822) AS acquired')).rows[0].acquired;
    if (!acquired) fail(409, 'Ya hay un respaldo en ejecución. Espere a que termine.');
    if (origin === 'programado') {
      const settings = (await getBusinessSettings()).respaldos;
      const [state] = await prisma.$queryRaw`SELECT * FROM "EstadoRespaldos" WHERE id = 1`;
      // Se vuelve a comprobar bajo el bloqueo compartido entre procesos.
      if (!settings.habilitado || !state?.proxima_ejecucion || new Date(state.proxima_ejecucion) > new Date()) return null;
      scheduledAttempt = true;
    }
    await prisma.$executeRaw`UPDATE "EstadoRespaldos" SET ultimo_intento = now() WHERE id = 1`;
    const started = new Date(), timestamp = `${formatDate(started)}_${randomUUID().slice(0, 8)}`;
    const backupFolder = await createDirectory(getBackupMonthFolder(started));
    if ((await fs.lstat(backupFolder)).isSymbolicLink()) fail(400, 'No se permiten enlaces en respaldos.');
    const manifestName = `backup_meta_${timestamp}.json`;
    const job = { id: timestamp, month: path.basename(backupFolder), manifest: manifestName,
      inicio: started.toISOString(), fin: null, estado: 'EN_PROCESO', origen: origin,
      usuario: user?.username || 'Sistema', archivos: [], advertencias: [],
      fotos: 'La base conserva referencias. Las fotos de R2 y archivos locales requieren una copia aparte.',
      gestionado: true, integridad: null };
    const writeManifest = () => fs.writeFile(path.join(backupFolder, manifestName), JSON.stringify(job, null, 2), 'utf8');
    const addFile = async (filePath, type) => {
      const stat = await fs.stat(filePath);
      job.archivos.push({ nombre: path.basename(filePath), tipo: type, bytes: stat.size, sha256: await checksum(filePath) });
    };
    await writeManifest();
    try {
      const dump = path.join(backupFolder, `db_dump_${timestamp}.dump`);
      try {
        await runPgDump(dump);
        await addFile(dump, 'BASE_COMPLETA');
        job.estado = 'COMPLETO';
      } catch (error) {
        job.advertencias.push('No se pudo generar la copia restaurable de PostgreSQL. Se conserva una exportación parcial de tablas públicas.');
        const snapshot = await queryAllTablesJson(backupFolder, timestamp);
        await addFile(snapshot, 'TABLAS_JSON');
        job.estado = 'PARCIAL';
        console.error('[BackupService] Copia SQL fallida:', error.message);
      }
      const products = await queryProducts();
      await addFile(await generateProductsExcel(backupFolder, products, timestamp), 'INVENTARIO_EXCEL');
      await addFile(await generateProductsPdf(backupFolder, products, timestamp), 'INVENTARIO_PDF');
      const reportLines = [`Estado: ${job.estado}`, `Inicio: ${job.inicio}`, `Origen: ${origin}`,
        ...job.archivos.map((f) => `${f.nombre} | ${f.bytes} bytes | SHA256 ${f.sha256}`), ...job.advertencias, job.fotos];
      await addFile(await createReportFile(backupFolder, `backup_report_${timestamp}.txt`, reportLines), 'INFORME');
      job.fin = new Date().toISOString();
      await writeManifest();
      await recordAdminAction(user, 'Respaldos', `RESPALDO_${job.estado}`, null, { id: job.id, estado: job.estado }, `Respaldo ${origin}.`);
      if (job.estado === 'COMPLETO') {
        await prisma.$executeRaw`UPDATE "EstadoRespaldos" SET ultimo_exito = now() WHERE id = 1`;
        try { await pruneBackups((await getBusinessSettings()).respaldos.conservacion_dias); }
        catch (error) {
          console.error('[BackupService] Conservación:', error.message);
          job.advertencias.push('La copia se completó, pero no se pudieron retirar todas las copias antiguas.');
          await writeManifest();
        }
      }
      if (scheduledAttempt) { await finishScheduledAttempt(job.estado === 'COMPLETO'); scheduleUpdated = true; }
      return job;
    } catch (error) {
      job.estado = 'FALLIDO'; job.fin = new Date().toISOString();
      job.advertencias.push('No se pudo completar la generación de archivos. Revise la conexión y el almacenamiento.');
      await writeManifest();
      await recordAdminAction(user, 'Respaldos', 'RESPALDO_FALLIDO', null, { id: job.id, estado: job.estado }, 'Error al generar el respaldo.');
      throw error;
    }
  } finally {
    if (scheduledAttempt && !scheduleUpdated) await finishScheduledAttempt(false).catch((error) => console.error('[BackupService] Programación:', error.message));
    if (acquired) await lock.query('SELECT pg_advisory_unlock(734822)').catch(() => {});
    await lock.end();
  }
};

const listBackupFiles = async () => {
  await createDirectory(BACKUP_ROOT);
  const monthEntries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true });
  const months = [];

  for (const entry of monthEntries.filter((folder) => folder.isDirectory() && /^\d{4}-(0[1-9]|1[0-2])$/.test(folder.name))) {
    const monthPath = path.join(BACKUP_ROOT, entry.name);
    const fileEntries = await fs.readdir(monthPath, { withFileTypes: true });
    const files = fileEntries
      .filter((file) => file.isFile())
      .map((file) => file.name)
      .sort((a, b) => b.localeCompare(a));
    months.push({ month: entry.name, files, fileCount: files.length });
  }

  months.sort((a, b) => b.month.localeCompare(a.month));
  return months;
};

export const getBackupJobs = async () => {
  const jobs = [];
  for (const month of await listBackupFiles()) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month.month)) continue;
    for (const file of month.files.filter((name) => /^backup_meta_[a-zA-Z0-9_.-]+\.json$/.test(name))) {
      try {
        const job = JSON.parse(await fs.readFile(await resolveBackupFile(month.month, file), 'utf8'));
        if (job.gestionado && typeof job.inicio === 'string' && Array.isArray(job.archivos) && Array.isArray(job.advertencias)
          && job.archivos.every((f) => typeof f.nombre === 'string' && Number.isFinite(f.bytes) && typeof f.sha256 === 'string')) jobs.push({ ...job, month: month.month, manifest: file });
      } catch { /* Los archivos anteriores o dañados siguen disponibles en el listado, sin declararlos completos. */ }
    }
  }
  return jobs.sort((a, b) => b.inicio.localeCompare(a.inicio));
};

const pruneBackups = async (days) => {
  if (!days) return;
  const jobs = await getBackupJobs();
  const latest = jobs.find((job) => job.estado === 'COMPLETO');
  const cutoff = Date.now() - days * 86400000;
  for (const job of jobs) {
    if (job.estado !== 'COMPLETO' || job.id === latest?.id || Date.parse(job.fin) >= cutoff) continue;
    // Solo elimina archivos de copias gestionadas, con rutas comprobadas y manteniendo la última completa.
    for (const file of [...job.archivos.map((f) => f.nombre), job.manifest]) {
      try { await fs.unlink(await resolveBackupFile(job.month, file)); }
      catch (error) { if (error.status !== 404) throw error; }
    }
  }
};

export const synchronizeBackupSchedule = async (settings) => {
  const { conservacion_dias, ...schedule } = settings;
  const key = JSON.stringify(schedule);
  const next = nextBackupDate(settings);
  await prisma.$executeRaw`INSERT INTO "EstadoRespaldos" (id, configuracion, proxima_ejecucion)
    VALUES (1, ${key}, ${next}) ON CONFLICT (id) DO UPDATE
    SET configuracion = EXCLUDED.configuracion, proxima_ejecucion = EXCLUDED.proxima_ejecucion,
      reintentos = 0, ultimo_error = NULL
    WHERE "EstadoRespaldos".configuracion IS DISTINCT FROM EXCLUDED.configuracion`;
};
export const getBackupSummary = async () => {
  const settings = (await getBusinessSettings()).respaldos;
  await synchronizeBackupSchedule(settings);
  const [months, jobs, states] = await Promise.all([listBackupFiles(), getBackupJobs(), prisma.$queryRaw`SELECT * FROM "EstadoRespaldos" WHERE id = 1`]);
  return { root: BACKUP_DISPLAY_ROOT, months, jobs, schedule: settings, state: states[0],
    latestComplete: jobs.find((job) => job.estado === 'COMPLETO') || null,
    coverage: 'PostgreSQL completo cuando hay archivo .dump. Las fotografías requieren una copia independiente.' };
};
export const createBackupNow = async (user) => {
  const latestBackup = await runBackup(user);
  return { ...await getBackupSummary(), latestBackup };
};

export const verifyBackup = async (month, manifest, user) => {
  const location = await resolveBackupFile(month, manifest);
  if (!/^backup_meta_[a-zA-Z0-9_.-]+\.json$/.test(manifest)) fail(400, 'Seleccione el manifiesto de una copia.');
  const job = JSON.parse(await fs.readFile(location, 'utf8'));
  if (!job.gestionado || !Array.isArray(job.archivos) || !job.archivos.length) fail(400, 'Copia sin archivos comprobables.');
  try { for (const file of job.archivos) {
    const target = await resolveBackupFile(month, file.nombre);
    if (await checksum(target) !== file.sha256) fail(409, `La integridad de ${file.nombre} no coincide.`);
    if (file.tipo === 'BASE_COMPLETA') {
      await execFileAsync(await postgresTool('pg_restore'), ['--list', target], { timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
    }
  } } catch (error) {
    job.integridad = { verificada_en: new Date().toISOString(), resultado: 'ERROR' };
    await fs.writeFile(location, JSON.stringify(job, null, 2), 'utf8');
    await recordAdminAction(user, 'Respaldos', 'VERIFICACION_FALLIDA', null, { id: job.id }, 'No se pudo comprobar la integridad de todos los archivos.');
    throw error;
  }
  job.integridad = { verificada_en: new Date().toISOString(), resultado: 'ARCHIVOS_VALIDOS' };
  await fs.writeFile(location, JSON.stringify(job, null, 2), 'utf8');
  await recordAdminAction(user, 'Respaldos', 'VERIFICACION', null, { id: job.id }, 'Integridad de archivos y estructura PostgreSQL comprobadas; no se ha restaurado la base.');
  return { data: job, message: 'Integridad comprobada. Esta revisión no sustituye una prueba de restauración.' };
};

const finishScheduledAttempt = async (success) => {
  const settings = (await getBusinessSettings()).respaldos;
  await synchronizeBackupSchedule(settings);
  const [state] = await prisma.$queryRaw`SELECT reintentos FROM "EstadoRespaldos" WHERE id = 1`;
  const attempt = Number(state?.reintentos || 0) + 1;
  const next = !settings.habilitado ? null : success || attempt >= 3 ? nextBackupDate(settings) : new Date(Date.now() + 5 * 60000 * attempt);
  await prisma.$executeRaw`UPDATE "EstadoRespaldos" SET proxima_ejecucion = ${next}, reintentos = ${success || attempt >= 3 ? 0 : attempt},
    ultimo_error = ${success ? null : 'No se pudo completar la copia programada. Revise el historial.'} WHERE id = 1`;
};
export const runScheduledBackup = async () => {
  if (polling) return;
  polling = true;
  try {
    const settings = (await getBusinessSettings()).respaldos;
    await synchronizeBackupSchedule(settings);
    const [state] = await prisma.$queryRaw`SELECT * FROM "EstadoRespaldos" WHERE id = 1`;
    if (!settings.habilitado || !state?.proxima_ejecucion || new Date(state.proxima_ejecucion) > new Date()) return;
    try {
      await runBackup(null, 'programado');
    } catch (error) {
      if (error.status === 409) return;
      console.error('[BackupService] Respaldo programado fallido:', error.message);
    }
  } finally { polling = false; }
};
export const initializeBackupService = async () => {
  await createDirectory(BACKUP_ROOT);
  await synchronizeBackupSchedule((await getBusinessSettings()).respaldos);
  if (scheduler) clearInterval(scheduler);
  scheduler = setInterval(() => runScheduledBackup().catch((error) => console.error('[BackupService]', error.message)), 60000);
  scheduler.unref();
  await runScheduledBackup();
};
