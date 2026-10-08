export const sendTemporaryPhotoBatch = async (files, { count, maxPhotos, prepare, upload, onProgress, onSent }) => {
  let sent = 0;
  const failed = [];

  for (const file of files) {
    if (count + sent >= maxPhotos) {
      failed.push({ name: file.name, error: `La sesión ya tiene ${maxPhotos} fotos.` });
      continue;
    }
    try {
      onProgress(0);
      const prepared = await prepare(file);
      const result = await upload(prepared, onProgress);
      sent += 1;
      onSent(result);
    } catch (error) {
      failed.push({ name: file.name, error: error.response?.data?.error || error.message || 'No se pudo enviar esta foto.' });
    }
  }

  return { sent, failed };
};
