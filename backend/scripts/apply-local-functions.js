import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = fileURLToPath(new URL('../', import.meta.url));
const url = new URL(process.env.SQL_DATABASE_URL || process.env.DATABASE_URL);
if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]', 'db'].includes(url.hostname)) {
  throw new Error('La carga de funciones está limitada a PostgreSQL local.');
}

const expand = async (relative, ancestors = []) => {
  if (ancestors.includes(relative)) throw new Error(`Inclusión SQL circular: ${relative}`);
  const source = await readFile(path.join(root, relative), 'utf8');
  let sql = '';
  let position = 0;
  for (const match of source.matchAll(/^\\i[ \t]+(\S+)[ \t]*\r?$/gm)) {
    sql += source.slice(position, match.index);
    sql += await expand(match[1], [...ancestors, relative]);
    position = match.index + match[0].length;
  }
  return sql + source.slice(position);
};

const client = new pg.Client({ connectionString: url.href });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(await expand('scripts/load_functions.sql'));
  await client.query('COMMIT');
  console.log('Funciones SQL aplicadas en la base local.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
