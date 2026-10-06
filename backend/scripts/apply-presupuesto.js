import { readFile } from 'node:fs/promises';
import pg from 'pg';

const url = new URL(process.env.SQL_DATABASE_URL || process.env.DATABASE_URL);
if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['db', 'localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
  throw new Error('Este ajuste está limitado a PostgreSQL local.');
}
const client = new pg.Client({ connectionString: url.href });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(await readFile(new URL('./modules/Tecnico/Presupuesto.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log('Presupuestos NIO/USD y reportes separados por moneda habilitados.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
