import prisma from '../src/app/prismaClient.js';
import { getAdminSettings, saveAdminSettings } from '../src/services/adminSettingsService.js';
import { synchronizeBackupSchedule, getBackupSummary } from '../src/services/backupService.js';

try {
  const user = await prisma.usuarios.findFirst({ where: { activo: true, rol: { in: ['Administrador', 'admin_pro', 'Admin'] } }, select: { id_usuario: true, nombre_usuario: true, rol: true } });
  if (!user) throw new Error('No hay administrador activo');
  const configuration = await getAdminSettings();
  const schedule = { habilitado: true, frecuencia: 'semanal', hora: '02:00', dia_semana: 1, conservacion_dias: 28 };
  const saved = await saveAdminSettings({ id: user.id_usuario, username: user.nombre_usuario, rol: user.rol }, { respaldos: schedule }, configuration.revision,
    'Solicitud del negocio: respaldo semanal modificable, cada lunes, conservando cuatro semanas');
  await synchronizeBackupSchedule(saved.valores.respaldos);
  const summary = await getBackupSummary();
  console.log(JSON.stringify({ programacion: summary.schedule, proxima_ejecucion: summary.state.proxima_ejecucion }));
} finally { await prisma.$disconnect(); }
