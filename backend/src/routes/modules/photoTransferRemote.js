import express from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import authMiddleware from '../../middlewares/authMiddleware.js';
import { getR2Storage } from '../../services/Secretaria/fotoStorage.js';

const router = express.Router();
const SESSION_MS = 20 * 60 * 1000;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PHOTOS = 12;
const PREFIX = 'photo-transfer/';
const formats = {
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/webp': (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};
const sessionKey = (token) => `${PREFIX}${createHash('sha256').update(token).digest('hex')}/session.json`;
const photoKey = (token, id) => `${PREFIX}${createHash('sha256').update(token).digest('hex')}/${id}`;
const validToken = (token) => typeof token === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(token);
const missing = (error) => ['NoSuchKey', 'NotFound'].includes(error.name) || error.$metadata?.httpStatusCode === 404;

const readSession = async (token) => {
  if (!validToken(token)) return null;
  const { client, bucket } = getR2Storage();
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: sessionKey(token) }));
    const session = JSON.parse(await object.Body.transformToString());
    if (session.expiresAt <= Date.now()) return null;
    return session;
  } catch (error) { if (missing(error)) return null; throw error; }
};
const writeSession = async (token, session) => {
  const { client, bucket } = getR2Storage();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: sessionKey(token),
    Body: JSON.stringify(session), ContentType: 'application/json' }));
};
const listSessions = async () => {
  const { client, bucket } = getR2Storage();
  const sessions = [];
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX, ContinuationToken: token }));
    for (const item of page.Contents || []) {
      if (!item.Key?.endsWith('/session.json')) continue;
      try {
        const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: item.Key }));
        const session = JSON.parse(await object.Body.transformToString());
        if (session.expiresAt > Date.now()) sessions.push(session);
      } catch (error) { if (!missing(error)) throw error; }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return sessions;
};

export const cleanupExpiredPhotoTransfers = async () => {
  const { client, bucket } = getR2Storage();
  let token;
  let removed = 0;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX, ContinuationToken: token }));
    for (const item of page.Contents || []) {
      if (!item.Key?.endsWith('/session.json')) continue;
      try {
        const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: item.Key }));
        const session = JSON.parse(await object.Body.transformToString());
        if (session.expiresAt > Date.now()) continue;
        const folder = item.Key.slice(0, -'session.json'.length);
        await Promise.all((session.photos || []).map((photo) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: `${folder}${photo.id}` }))));
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: item.Key }));
        removed += 1;
      } catch (error) { if (!missing(error)) throw error; }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return removed;
};
const sendError = (res, error) => {
  console.error('[Transferencia de fotos]', error.message);
  return res.status(error.statusCode || 503).json({ error: 'No se pudo acceder al almacenamiento temporal de fotos.' });
};
const findSession = async (req, res, owner = false) => {
  const session = await readSession(req.params.token);
  if (!session) { res.status(404).json({ error: 'La sesión temporal venció o fue cerrada.' }); return null; }
  if (owner && session.ownerId !== req.user.id) { res.status(403).json({ error: 'Esta sesión pertenece a otro usuario.' }); return null; }
  return session;
};

router.post('/', authMiddleware, async (req, res) => {
  try {
    const sessions = await listSessions();
    if (sessions.length >= 10 || sessions.filter((session) => session.ownerId === req.user.id).length >= 3) {
      return res.status(429).json({ error: 'Cierre una sesión temporal anterior y vuelva a intentar.' });
    }
    const token = randomBytes(32).toString('base64url');
    const session = { ownerId: req.user.id, expiresAt: Date.now() + SESSION_MS, photos: [] };
    await writeSession(token, session);
    return res.status(201).json({ token, expiresAt: session.expiresAt });
  } catch (error) { return sendError(res, error); }
});

router.get('/:token', async (req, res) => {
  try {
    const session = await findSession(req, res);
    if (!session) return;
    res.set('Cache-Control', 'no-store');
    res.json({ expiresAt: session.expiresAt, count: session.photos.length, maxPhotos: MAX_PHOTOS });
  } catch (error) { sendError(res, error); }
});

router.post('/:token/photos', express.raw({ type: Object.keys(formats), limit: '4mb' }), async (req, res) => {
  try {
    const session = await findSession(req, res);
    if (!session) return;
    if (session.photos.length >= MAX_PHOTOS) return res.status(409).json({ error: 'La sesión ya tiene 12 fotos.' });
    const mime = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BYTES || !formats[mime]?.(bytes)) {
      return res.status(400).json({ error: 'Use una imagen JPG, PNG o WebP de hasta 4 MB.' });
    }
    let originalName = 'foto';
    try { originalName = decodeURIComponent(String(req.headers['x-file-name'] || 'foto')); } catch { /* Nombre predeterminado. */ }
    const name = originalName.replace(/[\\/\x00-\x1f]/g, '').trim().slice(0, 120) || 'foto';
    const photo = { id: randomUUID(), name, mime, size: bytes.length, createdAt: Date.now() };
    const { client, bucket } = getR2Storage();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: photoKey(req.params.token, photo.id), Body: bytes, ContentType: mime }));
    try { await writeSession(req.params.token, { ...session, photos: [...session.photos, photo] }); }
    catch (error) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: photoKey(req.params.token, photo.id) })).catch(() => {});
      throw error;
    }
    return res.status(201).json({ id: photo.id, name: photo.name, count: session.photos.length + 1 });
  } catch (error) { return sendError(res, error); }
});

router.get('/:token/photos', authMiddleware, async (req, res) => {
  try {
    const session = await findSession(req, res, true);
    if (!session) return;
    res.set('Cache-Control', 'no-store');
    res.json({ expiresAt: session.expiresAt, photos: session.photos });
  } catch (error) { sendError(res, error); }
});

router.get('/:token/photos/:photoId', authMiddleware, async (req, res) => {
  try {
    const session = await findSession(req, res, true);
    if (!session) return;
    const photo = session.photos.find(({ id }) => id === req.params.photoId);
    if (!photo) return res.status(404).json({ error: 'Foto temporal no encontrada.' });
    const { client, bucket } = getR2Storage();
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: photoKey(req.params.token, photo.id) }));
    res.type(photo.mime).set('Cache-Control', 'no-store').send(Buffer.from(await object.Body.transformToByteArray()));
  } catch (error) { sendError(res, error); }
});

router.delete('/:token', authMiddleware, async (req, res) => {
  try {
    const session = await findSession(req, res, true);
    if (!session) return;
    const { client, bucket } = getR2Storage();
    await Promise.all(session.photos.map((photo) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: photoKey(req.params.token, photo.id) }))));
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: sessionKey(req.params.token) }));
    res.status(204).end();
  } catch (error) { sendError(res, error); }
});

export default router;
