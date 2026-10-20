import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Solo inicializa una instalación nueva; nunca borra la instalación existente.
const prisma = new PrismaClient();
try {
  const username = String(process.env.INIT_ADMIN_USERNAME || '').trim();
  const password = process.env.INIT_ADMIN_PASSWORD || '';
  if (!username || password.length < 12) throw new Error('Configure INIT_ADMIN_USERNAME e INIT_ADMIN_PASSWORD (mínimo 12 caracteres).');
  const hash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    const counts = await Promise.all([
      tx.usuarios.count(), tx.clientes.count(), tx.equipos.count(), tx.repuestos.count(), tx.ordenes.count(), tx.diagnosticos.count(),
      tx.proveedores.count(), tx.categorias_Repuestos.count(),
    ]);
    if (counts.some(Boolean)) throw new Error('La base contiene datos. Use una base nueva para entregar una instalación limpia.');
    await tx.usuarios.create({ data: { nombre_usuario: username, contrasena_hash: hash, rol: 'Administrador', activo: true } });
  }, { isolationLevel: 'Serializable' });
  console.log('Instalación inicializada con el administrador. Los datos y catálogos se agregan desde los módulos.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
