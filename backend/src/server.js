import 'dotenv/config';
import http from 'http';
import app from './app/app.js';
import { env } from './config/env.js';
import { initializeNotifications } from './services/notifications.js';
import { initializeBackupService } from './services/backupService.js';
import { initializeAdministrationStorage } from './services/adminSettingsService.js';

await initializeAdministrationStorage();

const server = http.createServer(app);
initializeNotifications(server, env.allowedOrigins);
initializeBackupService().catch((error) => {
  console.error('Error al inicializar el servicio de backup:', error);
});

server.listen(env.port, '0.0.0.0', () => {
  console.log('\n ==========================================');
  console.log(`   SERVIDOR CORRIENDO EN: http://localhost:${env.port}`);
  console.log(`   MODO: ${env.nodeEnv}`);
  console.log('   SISTEMA: Centro Tecnico Electronico');
  console.log('   ==========================================\n');
});
