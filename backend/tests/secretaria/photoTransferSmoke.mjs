import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import prisma from '../../src/app/prismaClient.js';

const base = 'http://localhost:5000/api/photo-transfer';
const [user] = await prisma.$queryRaw`SELECT id_usuario, sesion_version FROM "Usuarios" WHERE activo = true LIMIT 1`;
assert.ok(user, 'Se necesita un usuario activo para probar la sesión');
const auth = { Authorization: `Bearer ${jwt.sign({ id: user.id_usuario, sesion_version: user.sesion_version }, process.env.JWT_SECRET)}` };
const create = await fetch(base, { method: 'POST', headers: auth });
assert.equal(create.status, 201, await create.clone().text());
const { token } = await create.json();

try {
  const publicStatus = await fetch(`${base}/${token}`);
  assert.equal(publicStatus.status, 200);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');
  const upload = await fetch(`${base}/${token}/photos`, { method: 'POST', headers: { 'Content-Type': 'image/png', 'X-File-Name': 'prueba.png' }, body: png });
  assert.equal(upload.status, 201, await upload.clone().text());
  const { id } = await upload.json();
  const unauthorized = await fetch(`${base}/${token}/photos`);
  assert.equal(unauthorized.status, 401);
  const listing = await fetch(`${base}/${token}/photos`, { headers: auth });
  assert.equal(listing.status, 200);
  const { photos } = await listing.json();
  assert.equal(photos.length, 1);
  assert.equal(photos[0].name, 'prueba.png');
  const download = await fetch(`${base}/${token}/photos/${id}`, { headers: auth });
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
  process.stdout.write('Sesión temporal, envío, lectura autorizada y descarga: correcto.\n');
} finally {
  const close = await fetch(`${base}/${token}`, { method: 'DELETE', headers: auth });
  assert.equal(close.status, 204);
  const expired = await fetch(`${base}/${token}`);
  assert.equal(expired.status, 404);
  await prisma.$disconnect();
}
