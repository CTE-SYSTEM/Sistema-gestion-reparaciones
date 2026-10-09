import prisma from '../src/app/prismaClient.js';
import { createBackupNow, verifyBackup } from '../src/services/backupService.js';
import { remoteBackups } from '../src/services/backupObjectStorage.js';

try {
  if (!remoteBackups()) throw new Error('R2 no está configurado para los respaldos');
  const user = await prisma.usuarios.findFirst({ where: { activo: true, rol: { in: ['Administrador', 'admin_pro', 'Admin'] } }, select: { id_usuario: true, nombre_usuario: true, rol: true } });
  if (!user) throw new Error('No hay un administrador activo');
  const actor = { id: user.id_usuario, username: user.nombre_usuario, rol: user.rol };
  const result = await createBackupNow(actor);
  const job = result.latestBackup;
  if (job.estado !== 'COMPLETO') throw new Error(`Respaldo incompleto: ${job.estado}`);
  const verified = await verifyBackup(job.month, job.manifest, actor);
  console.log(JSON.stringify({ estado: job.estado, destino: 'R2', carpeta: `documentos/respaldos/${job.month}`,
    archivos: job.archivos.map((file) => ({ tipo: file.tipo, nombre: file.nombre })),
    integridad: verified.data.integridad.resultado, programacion: result.schedule, cobertura: result.coverage }));
} finally { await prisma.$disconnect(); }
