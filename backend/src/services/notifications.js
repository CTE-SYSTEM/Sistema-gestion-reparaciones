import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { normalizeRole } from '../utils/roles.js';
import { randomUUID } from 'node:crypto';
import prisma from '../app/prismaClient.js';
import { authenticatedUser } from '../middlewares/authMiddleware.js';

let io = null;

export const disconnectUserSessions = (id) => {
  io?.in(`user:${id}`).disconnectSockets(true);
};

export const initializeNotifications = (server, allowedOrigins) => {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token proporcionado'));

      const payload = jwt.verify(token, env.jwtSecret);
      const user = await authenticatedUser(payload);
      if (!user) return next(new Error('Usuario no disponible'));
      socket.user = {
        id: user.id_usuario,
        username: user.nombre_usuario,
        rol: user.rol,
      };
      socket.join(`role:${normalizeRole(user.rol)}`);
      socket.join(`user:${user.id_usuario}`);
      return next();
    } catch {
      return next(new Error('Token invalido'));
    }
  });

  io.on('connection', (socket) => {
    socket.emit('notificacion:conectado', {
      message: 'Notificaciones activas',
      timestamp: new Date().toISOString(),
    });
  });

  return io;
};

export const notificationRole = (role) => {
  const normalized = normalizeRole(role);
  return ['administrador', 'adminpro', 'admin'].includes(normalized) ? 'administrador' : normalized;
};

const technicalTitles = {
  diagnostico_asignado: 'Nuevo diagnóstico asignado', diagnostico_actualizado: 'Diagnóstico actualizado',
  orden_asignado: 'Nueva reparación asignada', prioridad_actualizada: 'Prioridad actualizada',
  trabajo_retirado: 'Trabajo reasignado', trabajo_reasignado: 'Trabajo asignado a tu cuenta',
  orden_cerrada: 'Finalización registrada', irreparable_revisado: 'Irreparabilidad revisada',
  repuesto_aprobar: 'Pieza aprobada', repuesto_rechazar: 'Pieza rechazada',
  repuesto_entregar: 'Pieza entregada', repuesto_corregir: 'Solicitud de pieza actualizada',
  'repuesto_retirar-aprobacion': 'Aprobación de pieza retirada', repuesto_reabrir: 'Solicitud de pieza en revisión',
  'repuesto_corregir-entrega': 'Entrega de pieza corregida', repuesto_devolver: 'Devolución de pieza registrada',
};

const technicalPayload = (payload) => {
  // El aviso guardado tiene el mismo contrato reservado que el aviso en vivo.
  const title = technicalTitles[payload.type] || 'Trabajo actualizado';
  const ref = payload.entity;
  const positive = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
  const entity = ref && ['diagnostico', 'orden', 'repuesto'].includes(ref.kind) ? {
    kind: ref.kind, ...(positive(ref.id) ? { id: Number(ref.id) } : {}),
    ...(positive(ref.orden_id) ? { orden_id: Number(ref.orden_id) } : {}),
  } : null;
  return {
    type: Object.hasOwn(technicalTitles, payload.type) ? payload.type : 'trabajo_actualizado',
    title, message: `${title}${entity?.orden_id || entity?.id ? ` · Referencia #${entity.orden_id || entity.id}` : ''}. Consulta el expediente técnico.`,
    severity: ['info', 'success', 'warning', 'error'].includes(payload.severity) ? payload.severity : 'info', entity,
  };
};

const deliver = async (role, payload, userId) => {
  const targetRole = notificationRole(role);
  const notification = {
    ...(targetRole === 'tecnico' ? technicalPayload(payload) : payload),
    id: randomUUID(), timestamp: new Date().toISOString(), destinatario_rol: targetRole,
  };
  try {
    const users = await prisma.usuarios.findMany({
      where: { activo: true, ...(userId ? { id_usuario: userId } : {}) },
      select: { id_usuario: true, rol: true },
    });
    const recipients = users.filter((u) => notificationRole(u.rol) === targetRole);
    if (!recipients.length) return notification;
    await prisma.notificaciones.createMany({ data: recipients.map((u) => ({
      id: notification.id, usuario_id: u.id_usuario, contenido: JSON.parse(JSON.stringify(notification)),
    })) });
    // Se guarda antes de emitir, incluso sin navegador ni Socket.IO conectados.
    io?.to(recipients.map((u) => `user:${u.id_usuario}`)).emit('notificacion', notification);
    return notification;
  } catch (error) {
    console.error('No se pudo guardar la notificación:', error.message);
    return null;
  }
};

export const notifyRole = (role, payload) => deliver(role, payload);
export const notifyJefeTecnico = (payload) => notifyRole('TecnicoJefe', payload);
export const notifyTecnico = (tecnico, payload) => {
  if (!Number.isSafeInteger(tecnico?.usuario_id) || tecnico.usuario_id < 1) return Promise.resolve(null);
  return deliver('Tecnico', payload, tecnico.usuario_id);
};
