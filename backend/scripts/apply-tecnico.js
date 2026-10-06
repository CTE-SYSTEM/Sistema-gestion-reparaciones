import { readFile } from 'node:fs/promises';
import pg from 'pg';
const url = new URL(process.env.SQL_DATABASE_URL || process.env.DATABASE_URL);
if (!['db', 'localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Este ajuste está limitado a PostgreSQL local.');
const client = new pg.Client({ connectionString: url.href });
try {
  await client.connect();
  await client.query('BEGIN');
  for (const modulePath of ['./modules/Auditoria.sql', './modules/Tecnico/Trabajo.sql']) {
    await client.query(await readFile(new URL(modulePath, import.meta.url), 'utf8'));
  }
  await client.query('COMMIT');
  console.log('Utilidades de auditoría y reglas de bitácora y fotografías actualizadas.');
} catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
finally { await client.end(); }
