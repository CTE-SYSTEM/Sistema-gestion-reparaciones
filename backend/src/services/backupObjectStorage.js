import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Storage } from './archivos/fotoStorage.js';

export const remoteBackups = () => process.env.BACKUP_STORAGE === 'r2' || process.env.VERCEL === '1';
const prefix = 'backups/';
const objectKey = (month, name) => `${prefix}${month}/${name}`;

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
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey(month, name) }));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await pipeline(response.Body, createWriteStream(destination));
  return destination;
};

export const listRemoteBackupFiles = async () => {
  const { client, bucket } = getR2Storage();
  const grouped = new Map();
  let continuationToken;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }));
    for (const object of page.Contents || []) {
      const match = object.Key?.match(/^backups\/(\d{4}-(?:0[1-9]|1[0-2]))\/([a-zA-Z0-9_.-]+)$/);
      if (!match) continue;
      if (!grouped.has(match[1])) grouped.set(match[1], []);
      grouped.get(match[1]).push(match[2]);
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return [...grouped].map(([month, files]) => ({ month, files: files.sort((a, b) => b.localeCompare(a)), fileCount: files.length }))
    .sort((a, b) => b.month.localeCompare(a.month));
};

export const deleteBackupFile = async (month, name) => {
  const { client, bucket } = getR2Storage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(month, name) }));
};

export const signedBackupDownloadUrl = async (month, name) => {
  const { client, bucket } = getR2Storage();
  try { await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey(month, name) })); }
  catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      throw Object.assign(new Error('El archivo ya no está disponible.'), { status: 404 });
    }
    throw error;
  }
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket, Key: objectKey(month, name),
    ResponseContentDisposition: `attachment; filename="${name}"`,
  }), { expiresIn: 300 });
};
