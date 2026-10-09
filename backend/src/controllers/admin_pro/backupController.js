import { createBackupNow, getBackupDownloadUrl, getBackupSummary, resolveBackupFile, verifyBackup } from '../../services/backupService.js';
import { restoreBackup } from '../../services/backupRestoreService.js';

const backupError = (res, error) => {
  console.error('[Respaldos]', error.message);
  const message = error.status ? error.message : 'No se pudo completar la operación de respaldo.';
  const safety = error.safetyBackupId ? ` La copia previa quedó guardada como ${error.safetyBackupId}. Revise el estado antes de reintentar.` : '';
  res.status(error.status || 500).json({ error: `${message}${safety}` });
};

export const getBackups = async (req, res) => {
  try {
    const data = await getBackupSummary();
    res.json({ data });
  } catch (error) {
    backupError(res, error);
  }
};

export const triggerBackupNow = async (req, res) => {
  try {
    const data = await createBackupNow(req.user);
    res.json({ data, message: data.latestBackup.estado === 'COMPLETO'
      ? 'Copia de la base e inventario generada.'
      : 'Copia parcial: no se pudo generar el respaldo restaurable de PostgreSQL. Revise las advertencias.' });
  } catch (error) {
    backupError(res, error);
  }
};

export const downloadBackupFile = async (req, res) => {
  try {
    const url = await getBackupDownloadUrl(req.params.month, req.params.file);
    if (url) return res.json({ data: { url } });
    const target = await resolveBackupFile(req.params.month, req.params.file);
    res.download(target, req.params.file, (error) => { if (error && !res.headersSent) backupError(res, error); });
  } catch (error) { backupError(res, error); }
};
export const verifyBackupFiles = async (req, res) => {
  try { res.json(await verifyBackup(req.params.month, req.params.file, req.user)); }
  catch (error) { backupError(res, error); }
};
export const restoreBackupVersion = async (req, res) => {
  try { res.json(await restoreBackup(req.params.month, req.params.file, req.body, req.user)); }
  catch (error) { backupError(res, error); }
};
