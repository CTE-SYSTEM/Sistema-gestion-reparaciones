import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid@invalid/invalid');
if (process.env.NODE_ENV === 'production' || process.env.LOCAL_DEMO_PROFILES !== '1'
  || !['localhost', '127.0.0.1', 'db'].includes(url.hostname)) {
  throw new Error('Los perfiles con clave 1234 solo se pueden crear en la base local con LOCAL_DEMO_PROFILES=1.');
}

const profiles = [
  ['recepcion_demo', 'Recepcion', '/recepcion/clientes'],
  ['bodega_demo', 'Bodega', '/bodega/repuestos'],
  ['calidad_demo', 'Calidad', '/calidad'],
  ['reclamos_demo', 'Reclamos', '/reclamos'],
  ['garantias_demo', 'Garantias', '/garantias'],
  ['contabilidad_demo', 'Contabilidad', '/contabilidad/facturacion'],
];

const prisma = new PrismaClient();
try {
  const password = '1234';
  const hash = await bcrypt.hash(password, 10);
  for (const [nombre_usuario, rol] of profiles) {
    await prisma.usuarios.upsert({
      where: { nombre_usuario },
      create: { nombre_usuario, rol, contrasena_hash: hash, activo: true },
      update: { rol, contrasena_hash: hash, activo: true, sesion_version: { increment: 1 } },
    });
  }
  const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));
  const outputDir = join(backendDir, 'tmp');
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'perfiles-locales.md'), [
    '# Perfiles de prueba locales', '',
    'Solo para la base de datos local. Cambia la clave antes de usar cualquier cuenta fuera de este entorno.', '',
    '| Usuario | Rol | Página inicial | Clave |', '| --- | --- | --- | --- |',
    ...profiles.map(([username, role, path]) => `| ${username} | ${role} | ${path} | ${password} |`), '',
  ].join('\n'), { encoding: 'utf8', mode: 0o600 });
  console.log(`Perfiles locales creados. Lista: ${join(outputDir, 'perfiles-locales.md')}`);
} finally {
  await prisma.$disconnect();
}
