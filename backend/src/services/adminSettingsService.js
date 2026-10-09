import { readFile } from 'node:fs/promises';
import pg from 'pg';
import prisma from '../app/prismaClient.js';
import { DEFAULT_ADMIN_SETTINGS, fail, validateSettings } from '../utils/adminPolicy.js';
import { withAuditUser } from '../utils/auditContext.js';

export const databaseConnection = () => {
  const url = new URL(process.env.SQL_DATABASE_URL || process.env.DATABASE_URL);
  url.searchParams.delete('schema');
  return url.href;
};
export const initializeAdministrationStorage = async () => {
  const client = new pg.Client({ connectionString: databaseConnection(), connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query(await readFile(new URL('../../scripts/modules/admin_pro/02_administracion.sql', import.meta.url), 'utf8'));
    await client.query(await readFile(new URL('../../scripts/modules/Auditoria.sql', import.meta.url), 'utf8'));
  } finally { await client.end(); }
  await prisma.$executeRaw`INSERT INTO "ConfiguracionAdministracion" (id, valores)
    VALUES (1, CAST(${JSON.stringify(DEFAULT_ADMIN_SETTINGS)} AS JSONB)) ON CONFLICT (id) DO NOTHING`;
  // Migra únicamente la programación inicial anterior; respeta cambios hechos por el administrador.
  await prisma.$executeRaw`UPDATE "ConfiguracionAdministracion"
    SET valores = jsonb_set(jsonb_set(valores, '{respaldos,frecuencia}', '"semanal"'::jsonb), '{respaldos,conservacion_dias}', '28'::jsonb),
      revision = revision + 1, actualizado_en = now()
    WHERE id = 1 AND revision = 0 AND valores #>> '{respaldos,frecuencia}' = 'mensual'
      AND valores #>> '{respaldos,conservacion_dias}' = '0'
      AND valores #>> '{respaldos,hora}' = '02:00'
      AND valores #>> '{respaldos,dia_mes}' = '1'`;
};
export const getAdminSettings = async () => {
  const [row] = await prisma.$queryRaw`SELECT valores, revision, actualizado_por, actualizado_en
    FROM "ConfiguracionAdministracion" WHERE id = 1`;
  if (!row) return { valores: structuredClone(DEFAULT_ADMIN_SETTINGS), revision: 0, actualizado_en: null };
  return { ...row, valores: validateSettings(row.valores) };
};
export const getBusinessSettings = async () => (await getAdminSettings()).valores;

export const recordAdminAction = async (user, table, action, before, after, reason, tx = prisma) => {
  await tx.$executeRaw`INSERT INTO "Auditoria_Movimientos"
    (tabla, operacion, usuario_id, usuario_nombre, datos_anteriores, datos_nuevos, observacion, origen)
    VALUES (${table}, ${action}, ${user?.id || null}, ${user?.username || 'Sistema'},
      CAST(${before == null ? null : JSON.stringify(before)} AS JSONB),
      CAST(${after == null ? null : JSON.stringify(after)} AS JSONB), ${reason}, 'administracion')`;
};

export const saveAdminSettings = async (user, input, revision, reason) => {
  if (!Number.isInteger(revision) || revision < 0) fail(400, 'Revisión de configuración inválida.');
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 1000) fail(400, 'Indique un motivo de entre 5 y 1000 caracteres.');
  return withAuditUser(user, async (tx) => {
    const [row] = await tx.$queryRaw`SELECT * FROM "ConfiguracionAdministracion" WHERE id = 1 FOR UPDATE`;
    if (!row || row.revision !== revision) fail(409, 'La configuración cambió. Recargue antes de guardar.');
    const values = validateSettings(input, validateSettings(row.valores));
    await tx.$executeRaw`UPDATE "ConfiguracionAdministracion" SET valores = CAST(${JSON.stringify(values)} AS JSONB),
      revision = revision + 1, actualizado_por = ${user.id}, actualizado_en = now() WHERE id = 1`;
    await recordAdminAction(user, 'ConfiguracionAdministracion', 'CONFIGURACION', row.valores, values, reason.trim(), tx);
    return { valores: values, revision: revision + 1, actualizado_por: user.id, actualizado_en: new Date() };
  });
};
