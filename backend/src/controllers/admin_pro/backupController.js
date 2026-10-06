import { createBackupNow, getBackupSummary, resolveBackupFile, verifyBackup } from '../../services/backupService.js';

const backupError = (res, error) => {
  console.error('[Respaldos]', error.message);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo completar la operación de respaldo.' });
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
      ? 'Copia de PostgreSQL e inventario generada.'
      : 'Copia parcial: no se pudo generar el respaldo restaurable de PostgreSQL. Revise las advertencias.' });
  } catch (error) {
    backupError(res, error);
  }
};

export const downloadBackupFile = async (req, res) => {
  try {
    const target = await resolveBackupFile(req.params.month, req.params.file);
    res.download(target, req.params.file, (error) => { if (error && !res.headersSent) backupError(res, error); });
  } catch (error) { backupError(res, error); }
};
export const verifyBackupFiles = async (req, res) => {
  try { res.json(await verifyBackup(req.params.month, req.params.file, req.user)); }
  catch (error) { backupError(res, error); }
};
