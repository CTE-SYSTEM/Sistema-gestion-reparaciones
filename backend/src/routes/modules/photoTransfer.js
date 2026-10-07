import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import authMiddleware from '../../middlewares/authMiddleware.js';

const router = express.Router();
const sessions = new Map();
const SESSION_MS = 20 * 60 * 1000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 12;
const MAX_SESSIONS_PER_USER = 3;
const MAX_SESSIONS = 10;
const MAX_TEMP_BYTES = 100 * 1024 * 1024;
const formats = {
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/webp': (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};

const prune = () => {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
};
const timer = setInterval(prune, 60_000);
timer.unref?.();

const findSession = (req, res) => {
  prune();
  const session = sessions.get(req.params.token);
  if (!session) res.status(404).json({ error: 'La sesión temporal venció o fue cerrada.' });
  return session;
};
const findOwnerSession = (req, res) => {
  const session = findSession(req, res);
  if (session && session.ownerId !== req.user.id) {
    res.status(403).json({ error: 'Esta sesión pertenece a otro usuario.' });
    return null;
  }
  return session;
};

router.post('/', authMiddleware, (req, res) => {
  prune();
  const owned = [...sessions.values()].filter((session) => session.ownerId === req.user.id).length;
  if (owned >= MAX_SESSIONS_PER_USER || sessions.size >= MAX_SESSIONS) {
    return res.status(429).json({ error: 'Cierre una sesión temporal anterior y vuelva a intentar.' });
  }
  const token = randomBytes(32).toString('base64url');
  const session = { ownerId: req.user.id, expiresAt: Date.now() + SESSION_MS, photos: [] };
  sessions.set(token, session);
  res.status(201).json({ token, expiresAt: session.expiresAt });
});

// The QR link is a short-lived capability. The phone never receives the user's login token.
router.get('/:token', (req, res) => {
  const session = findSession(req, res);
  if (!session) return;
  res.setHeader('Cache-Control', 'no-store');
  res.json({ expiresAt: session.expiresAt, count: session.photos.length, maxPhotos: MAX_PHOTOS });
});

router.post('/:token/photos', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), (req, res) => {
  const session = findSession(req, res);
  if (!session) return;
  if (session.photos.length >= MAX_PHOTOS) return res.status(409).json({ error: 'La sesión ya tiene 12 fotos.' });
  const mime = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BYTES || !formats[mime]?.(bytes)) {
    return res.status(400).json({ error: 'Use una imagen JPG, PNG o WebP de hasta 5 MB.' });
  }
  const usedBytes = [...sessions.values()].reduce((total, current) => total + current.photos.reduce((sum, photo) => sum + photo.bytes.length, 0), 0);
  if (usedBytes + bytes.length > MAX_TEMP_BYTES) return res.status(429).json({ error: 'El espacio temporal está lleno. Cierre sesiones anteriores y vuelva a intentar.' });
  let originalName = 'foto';
  try { originalName = decodeURIComponent(String(req.headers['x-file-name'] || 'foto')); } catch { /* Keep the safe default. */ }
  const name = originalName.replace(/[\\/\x00-\x1f]/g, '').trim().slice(0, 120) || 'foto';
  const photo = { id: randomUUID(), name, mime, bytes, createdAt: Date.now() };
  session.photos.push(photo);
  res.status(201).json({ id: photo.id, name: photo.name, count: session.photos.length });
});

router.get('/:token/photos', authMiddleware, (req, res) => {
  const session = findOwnerSession(req, res);
  if (!session) return;
  res.setHeader('Cache-Control', 'no-store');
  res.json({ expiresAt: session.expiresAt, photos: session.photos.map(({ id, name, mime, bytes, createdAt }) => ({ id, name, mime, size: bytes.length, createdAt })) });
});

router.get('/:token/photos/:photoId', authMiddleware, (req, res) => {
  const session = findOwnerSession(req, res);
  if (!session) return;
  const photo = session.photos.find(({ id }) => id === req.params.photoId);
  if (!photo) return res.status(404).json({ error: 'Foto temporal no encontrada.' });
  res.setHeader('Content-Type', photo.mime);
  res.setHeader('Cache-Control', 'no-store');
  res.send(photo.bytes);
});

router.delete('/:token', authMiddleware, (req, res) => {
  const session = findOwnerSession(req, res);
  if (!session) return;
  sessions.delete(req.params.token);
  res.status(204).end();
});

export default router;
