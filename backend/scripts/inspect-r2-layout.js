import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import prisma from '../src/app/prismaClient.js';
import { getR2Storage } from '../src/services/archivos/fotoStorage.js';

try {
  const { client, bucket } = getR2Storage();
  const roots = {};
  let cursor;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: cursor }));
    for (const object of page.Contents || []) { const root = object.Key?.split('/')[0] || '(raíz)'; roots[root] = (roots[root] || 0) + 1; }
    cursor = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (cursor);
  const [service, purchase] = await Promise.all([
    prisma.archivosServicio.findMany({ select: { ruta_archivo: true } }),
    prisma.archivosCompra.findMany({ select: { ruta_archivo: true } }),
  ]);
  console.log(JSON.stringify({ roots, fotos_antiguas: service.filter((row) => !row.ruta_archivo.startsWith('fotos/')).length,
    comprobantes_antiguos: purchase.filter((row) => row.ruta_archivo.startsWith('compras/')).length }));
} finally { await prisma.$disconnect(); }
