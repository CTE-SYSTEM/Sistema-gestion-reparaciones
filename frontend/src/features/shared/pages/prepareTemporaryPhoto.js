import { MAX_PHOTO_BYTES, PHOTO_MIME_TYPES } from '../components/photoQueue';

export const MAX_TEMPORARY_PHOTO_BYTES = Math.min(MAX_PHOTO_BYTES, 4 * 1024 * 1024);
export const TEMPORARY_PHOTO_LIMIT_LABEL = `${Math.round(MAX_TEMPORARY_PHOTO_BYTES / (1024 * 1024))} MB`;

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la imagen.')); };
  image.src = url;
});

const toJpeg = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

export const prepareTemporaryPhoto = async (file) => {
  if (!PHOTO_MIME_TYPES.includes(file.type) || !file.size) {
    throw new Error('Use una foto JPG, PNG o WebP.');
  }
  if (file.size <= MAX_TEMPORARY_PHOTO_BYTES) return file;
  if (file.size > 25 * 1024 * 1024) throw new Error('La foto es demasiado grande para prepararla en el teléfono.');

  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El teléfono no pudo preparar la imagen.');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await toJpeg(canvas, Math.max(0.55, 0.85 - attempt * 0.08));
    if (blob && blob.size <= MAX_TEMPORARY_PHOTO_BYTES) {
      const name = `${file.name.replace(/\.[^/.]+$/, '')}.jpg`;
      return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
    }
    canvas.width = Math.max(1, Math.round(canvas.width * 0.75));
    canvas.height = Math.max(1, Math.round(canvas.height * 0.75));
  }
  throw new Error(`No se pudo reducir la foto a ${TEMPORARY_PHOTO_LIMIT_LABEL}.`);
};
