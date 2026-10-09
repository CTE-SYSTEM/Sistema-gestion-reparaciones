import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../src/app/prismaClient.js';
import { getR2Storage, r2EquipmentFolderFromKey } from '../src/services/archivos/fotoStorage.js';

const apply = process.argv.includes('--apply');
const migrateKey = (key) => {
  if (!r2EquipmentFolderFromKey(key) || key.startsWith('fotos/')) return null;
  const [type, equipment, stage, file] = key.split('/');
  return `fotos/equipos/${type}-${equipment}/${stage}/${file}`;
};
try {
  const files = await prisma.archivosServicio.findMany({ select: { id_archivo: true, ruta_archivo: true } });
  const candidates = files.map((row) => ({ ...row, destination: migrateKey(row.ruta_archivo) })).filter((row) => row.destination);
  if (!apply) { console.log(JSON.stringify({ modo: 'simulacion', fotos_por_mover: candidates.length, destino: 'fotos/equipos/' })); process.exitCode = 0; }
  else {
    const { client, bucket } = getR2Storage();
    let moved = 0;
    for (const row of candidates) {
      const source = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: row.ruta_archivo }));
      let destination;
      try { destination = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: row.destination })); }
      catch (error) { if (error.name !== 'NotFound' && error.$metadata?.httpStatusCode !== 404) throw error; }
      if (!destination) {
        await client.send(new CopyObjectCommand({ Bucket: bucket, Key: row.destination,
          CopySource: `${bucket}/${row.ruta_archivo.split('/').map(encodeURIComponent).join('/')}`,
          MetadataDirective: 'COPY' }));
        destination = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: row.destination }));
      }
      if (destination.ContentLength !== source.ContentLength) throw new Error(`No coincide el tamaño del archivo #${row.id_archivo}`);
      const changed = await prisma.archivosServicio.updateMany({ where: { id_archivo: row.id_archivo, ruta_archivo: row.ruta_archivo }, data: { ruta_archivo: row.destination } });
      if (changed.count !== 1) throw new Error(`El archivo #${row.id_archivo} cambió durante la migración`);
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.ruta_archivo }));
      moved += 1;
    }
    console.log(JSON.stringify({ modo: 'aplicado', fotos_movidas: moved, destino: 'fotos/equipos/' }));
  }
} finally { await prisma.$disconnect(); }
