import prisma from '../app/prismaClient.js';

// El ajuste es local a la transaccion: no se filtra a otras conexiones del pool.
export const withAuditUser = (user, callback) => prisma.$transaction(async (tx) => {
  if (user?.id) {
    await tx.$queryRaw`SELECT set_config('app.usuario_id', ${String(user.id)}, true)`;
    await tx.$queryRaw`SELECT set_config('app.usuario_nombre', ${String(user.username || '')}, true)`;
  }
  return callback(tx);
});
