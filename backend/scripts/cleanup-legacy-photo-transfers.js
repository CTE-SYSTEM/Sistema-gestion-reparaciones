import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getR2Storage } from '../src/services/archivos/fotoStorage.js';

const apply = process.argv.includes('--apply');
const { client, bucket } = getR2Storage();
const groups = new Map();
let cursor;
do {
  const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'photo-transfer/', ContinuationToken: cursor }));
  for (const object of page.Contents || []) {
    const folder = object.Key?.split('/').slice(0, 2).join('/');
    if (!folder) continue;
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(object);
  }
  cursor = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (cursor);
let expired = 0, active = 0, removed = 0;
for (const [folder, objects] of groups) {
  const session = objects.find((object) => object.Key === `${folder}/session.json`);
  let expiresAt = 0;
  if (session) {
    try { const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: session.Key })); expiresAt = Number(JSON.parse(await response.Body.transformToString()).expiresAt || 0); }
    catch { expiresAt = 0; }
  }
  const staleOrphan = !session && objects.every((object) => Date.now() - new Date(object.LastModified).getTime() > 86400000);
  if ((expiresAt && expiresAt < Date.now()) || staleOrphan) {
    expired += objects.length;
    if (apply) for (const object of objects) { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key })); removed += 1; }
  } else active += objects.length;
}
console.log(JSON.stringify({ modo: apply ? 'aplicado' : 'simulacion', temporales_vencidos: expired, temporales_activos: active, eliminados: removed }));
