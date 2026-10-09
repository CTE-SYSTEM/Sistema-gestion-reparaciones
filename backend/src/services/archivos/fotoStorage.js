import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomBytes } from 'node:crypto';

let client;

const r2Endpoint = (accountId) => {
  const defaultEndpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  if (!process.env.R2_ENDPOINT) return defaultEndpoint;
  let url;
  try { url = new URL(process.env.R2_ENDPOINT); }
  catch { url = null; }
  const allowedHosts = [
    `${accountId}.r2.cloudflarestorage.com`,
    ...['eu', 'us', 'fedramp'].map((jurisdiction) => `${accountId}.${jurisdiction}.r2.cloudflarestorage.com`),
  ];
  if (!url || url.protocol !== 'https:' || !allowedHosts.includes(url.hostname)
    || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    const error = new Error('R2_ENDPOINT debe ser el endpoint S3 de este R2_ACCOUNT_ID, sin ruta ni parámetros');
    error.statusCode = 503;
    throw error;
  }
  return url.origin;
};

export const r2Configured = () => {
  const values = [process.env.R2_ACCOUNT_ID, process.env.R2_BUCKET, process.env.R2_ACCESS_KEY_ID, process.env.R2_SECRET_ACCESS_KEY];
  if (values.every((value) => !value)) return false;
  if (values.every(Boolean)) return true;
  const error = new Error('Configure R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY para guardar fotografías');
  error.statusCode = 503;
  throw error;
};

export const getR2Storage = () => {
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!r2Configured()) {
    const error = new Error('Configure R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY para guardar fotografías');
    error.statusCode = 503;
    throw error;
  }
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: r2Endpoint(R2_ACCOUNT_ID),
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
  }
  return { client, bucket: R2_BUCKET };
};

export const PHOTO_STORAGE_STAGES = Object.freeze({
  FOTO_RECEPCION: { folder: 'recepcion', kind: 'diagnostico' },
  FOTO_DIAGNOSTICO: { folder: 'diagnostico', kind: 'diagnostico' },
  FOTO_REPARACION: { folder: 'reparacion', kind: 'orden' },
  FOTO_ENTREGA: { folder: 'entrega', kind: 'orden' },
  FOTO_SALIDA_SIN_REPARAR: { folder: 'retiro-sin-reparar', kind: 'diagnostico' },
});

const r2Folders = new Set(Object.values(PHOTO_STORAGE_STAGES).map(({ folder }) => folder));
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const photoFilenamePattern = /^(diagnostico|orden)-[1-9]\d*-(?:[0-9a-f-]{36}|\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}-[0-9a-f]{8}|\d{2}-\d{2}-\d{2}_\d{2}-\d{2}-[0-9a-f]{8})\.(jpg|png|webp)$/;
const photoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Managua',
  year: '2-digit', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

const photoTimestamp = (date) => {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('Fecha de subida inválida');
  const parts = Object.fromEntries(photoDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.day}-${parts.month}-${parts.year}_${parts.hour}-${parts.minute}`;
};

export const r2EquipmentFolderFromKey = (key, equipoId) => {
  if (typeof key !== 'string') return null;
  const parts = key.split('/');
  const organized = parts.length === 5 && parts[0] === 'fotos' && parts[1] === 'equipos';
  const legacy = parts.length === 4 && slugPattern.test(parts[0]);
  if ((!organized && !legacy) || !r2Folders.has(parts[organized ? 3 : 2])) return null;
  const equipmentMatch = parts[organized ? 2 : 1].match(/^[a-z0-9]+(?:-[a-z0-9]+)*-equipo-([1-9]\d*)$/);
  if (!equipmentMatch || (equipoId !== undefined && Number(equipmentMatch[1]) !== equipoId)) return null;
  if (!photoFilenamePattern.test(parts[organized ? 4 : 3])) return null;
  return organized ? parts.slice(0, 3).join('/') : `${parts[0]}/${parts[1]}`;
};

export const isR2Key = (key) => typeof key === 'string'
  && (key.startsWith('r2/servicios/') || (key.includes('/') && r2Folders.has(key.split('/')[0]))
    || r2EquipmentFolderFromKey(key) !== null);

const slug = (value, fallback) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .slice(0, 48)
  .replace(/^-+|-+$/g, '') || fallback;

export const r2ServiceKey = ({ kind, serviceId, equipo, tipoArchivo, ext, existingKey, uploadedAt = new Date() }) => {
  const stage = PHOTO_STORAGE_STAGES[tipoArchivo];
  if (!stage || stage.kind !== kind) throw new Error('Tipo de fotografía incompatible con el servicio');
  if (!Number.isSafeInteger(serviceId) || serviceId <= 0
    || !Number.isSafeInteger(equipo?.id_equipo) || equipo.id_equipo <= 0) {
    throw new Error('La fotografía requiere un servicio y un equipo válidos');
  }
  if (!['.jpg', '.png', '.webp'].includes(ext)) throw new Error('Extensión de fotografía inválida');
  const description = `${slug(equipo.marca, 'sin-marca')}-${slug(equipo.modelo, 'sin-modelo')}`;
  const previousFolder = r2EquipmentFolderFromKey(existingKey, equipo.id_equipo);
  const equipmentName = (previousFolder?.startsWith('fotos/equipos/') ? previousFolder.split('/').at(-1) : previousFolder?.replace('/', '-'))
    || `${slug(equipo.tipo, 'sin-tipo')}-${description}-equipo-${equipo.id_equipo}`;
  const equipmentFolder = `fotos/equipos/${equipmentName}`;
  return `${equipmentFolder}/${stage.folder}/${kind}-${serviceId}-${photoTimestamp(uploadedAt)}-${randomBytes(4).toString('hex')}${ext}`;
};

const storageError = (error) => {
  const messages = {
    SignatureDoesNotMatch: 'R2 rechazó la firma; revise que el Access Key ID y el Secret Access Key pertenezcan al mismo token',
    AccessDenied: 'R2 denegó el acceso; revise los permisos del token para este bucket',
    NoSuchBucket: 'R2 no encontró el bucket configurado',
  };
  if (!messages[error.name]) return error;
  const failure = new Error(messages[error.name]);
  failure.statusCode = 503;
  return failure;
};

export const guardarFoto = async (key, bytes, contentType) => {
  const { client: r2, bucket } = getR2Storage();
  try { await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType })); }
  catch (error) { throw storageError(error); }
};

export const leerFoto = async (key) => {
  const { client: r2, bucket } = getR2Storage();
  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return Buffer.from(await object.Body.transformToByteArray());
  } catch (error) { throw storageError(error); }
};

export const borrarFoto = async (key) => {
  const { client: r2, bucket } = getR2Storage();
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};
