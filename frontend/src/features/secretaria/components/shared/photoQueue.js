export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = Number(import.meta.env?.VITE_MAX_PHOTO_BYTES) || 5 * 1024 * 1024;
export const PHOTO_LIMIT_LABEL = `${Math.round(MAX_PHOTO_BYTES / (1024 * 1024))} MB`;

export const photoFingerprint = (file) =>
  JSON.stringify([file.name, file.size, file.type, file.lastModified]);

export const selectNewPhotos = (files, photos = []) => {
  const seen = new Set(photos.map((photo) => photoFingerprint(photo.file)));
  const accepted = [];
  const rejected = [];
  let duplicates = 0;

  for (const file of files) {
    let error = '';
    if (!PHOTO_MIME_TYPES.includes(file.type)) error = 'Use una imagen JPG, PNG o WebP.';
    else if (!file.size) error = 'El archivo está vacío.';
    else if (file.size > MAX_PHOTO_BYTES) error = `La imagen supera los ${PHOTO_LIMIT_LABEL} permitidos.`;

    if (error) {
      rejected.push({ name: file.name, error });
      continue;
    }

    const fingerprint = photoFingerprint(file);
    if (seen.has(fingerprint)) {
      duplicates += 1;
      continue;
    }
    seen.add(fingerprint);
    accepted.push(file);
  }

  return { accepted, rejected, duplicates };
};

export const formatPhotoSize = (bytes) => bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// Un fallo no interrumpe las demás fotos; las confirmadas se omiten al reintentar.
export const uploadPhotoBatch = async (photos, upload, onChange) => {
  const uploaded = [];
  const failed = [];
  const pending = photos.filter((photo) => photo.status !== 'uploaded');

  for (const photo of pending) {
    onChange(photo.id, { status: 'uploading', progress: 0, error: '' });
    try {
      await upload(photo, (progress) => onChange(photo.id, {
        progress: Math.min(100, Math.max(0, Math.round(progress))),
      }));
      onChange(photo.id, { status: 'uploaded', progress: 100, error: '' });
      uploaded.push(photo.id);
    } catch (error) {
      const reason = error?.response?.data?.error || error?.message || 'No se pudo guardar esta foto.';
      onChange(photo.id, { status: 'failed', error: reason });
      failed.push({ id: photo.id, name: photo.file.name, error: reason });
    }
  }

  return {
    uploaded,
    failed,
    totalUploaded: photos.filter((photo) => photo.status === 'uploaded').length + uploaded.length,
    totalPhotos: photos.length,
  };
};
