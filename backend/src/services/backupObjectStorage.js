import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Storage } from './archivos/fotoStorage.js';

export const remoteBackups = () => process.env.BACKUP_STORAGE !== 'local' && (process.env.BACKUP_STORAGE === 'r2' || process.env.VERCEL === '1'
  || Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY));
const prefix = 'documentos/respaldos/';
const legacyPrefix = 'backups/';
const objectKey = (month, name) => `${prefix}${month}/${name}`;
const legacyKey = (month, name) => `${legacyPrefix}${month}/${name}`;
const findKey = async (client, bucket, month, name) => {
  for (const key of [objectKey(month, name), legacyKey(month, name)]) {
    try { await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); return key; }
    catch (error) { if (error.name !== 'NotFound' && error.$metadata?.httpStatusCode !== 404) throw error; }
  }
  throw Object.assign(new Error('El archivo ya no está disponible.'), { status: 404 });
};

export const uploadBackupFile = async (month, filePath) => {
  if (!remoteBackups()) return;
  const { client, bucket } = getR2Storage();
  const stat = await fs.stat(filePath);
  await client.send(new PutObjectCommand({
    Bucket: bucket, Key: objectKey(month, path.basename(filePath)), Body: createReadStream(filePath),
    ContentLength: stat.size, ContentType: 'application/octet-stream',
  }));
};

export const fetchBackupFile = async (month, name, destination) => {
  const { client, bucket } = getR2Storage();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: await findKey(client, bucket, month, name) }));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await pipeline(response.Body, createWriteStream(destination));
  return destination;
};

export const listRemoteBackupFiles = async () => {
  const { client, bucket } = getR2Storage();
  const grouped = new Map();
  let continuationToken;
  for (const listPrefix of [prefix, legacyPrefix]) {
    continuationToken = undefined;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: listPrefix, ContinuationToken: continuationToken }));
      for (const object of page.Contents || []) {
        const key = object.Key?.slice(listPrefix.length);
        const match = key?.match(/^(\d{4}-(?:0[1-9]|1[0-2]))\/([a-zA-Z0-9_.-]+)$/);
        if (!match) continue;
        if (!grouped.has(match[1])) grouped.set(match[1], new Set());
        grouped.get(match[1]).add(match[2]);
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
  }
  return [...grouped].map(([month, names]) => { const files = [...names].sort((a, b) => b.localeCompare(a)); return { month, files, fileCount: files.length }; })
    .sort((a, b) => b.month.localeCompare(a.month));
};

export const deleteBackupFile = async (month, name) => {
  const { client, bucket } = getR2Storage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: await findKey(client, bucket, month, name) }));
};

export const signedBackupDownloadUrl = async (month, name) => {
  const { client, bucket } = getR2Storage();
  const key = await findKey(client, bucket, month, name);
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket, Key: key,
    ResponseContentDisposition: `attachment; filename="${name}"`,
  }), { expiresIn: 300 });
};
