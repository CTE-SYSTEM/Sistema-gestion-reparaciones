import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { runScheduledBackup } from '../services/backupService.js';
import { cleanupExpiredPhotoTransfers } from './modules/photoTransferRemote.js';

const router = Router();

router.get('/backup-schedule', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const secret = process.env.CRON_SECRET;
  const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(secret || '');
  if (!secret || suppliedBytes.length !== expectedBytes.length
    || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    await Promise.all([runScheduledBackup(), cleanupExpiredPhotoTransfers()]);
    return res.json({ ok: true });
  } catch (error) {
    console.error('[BackupCron]', error);
    return res.status(500).json({ error: 'No se pudo ejecutar el respaldo programado.' });
  }
});

export default router;
