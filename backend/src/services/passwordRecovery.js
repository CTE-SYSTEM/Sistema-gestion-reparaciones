import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../app/prismaClient.js';
import { env } from '../config/env.js';
import { getBusinessSettings, recordAdminAction } from './adminSettingsService.js';
import { fail, validateNewPassword } from '../utils/adminPolicy.js';
import { disconnectUserSessions } from './notifications.js';
import { isMailConfigured, mailConfiguration, sendTransactionalEmail } from './mailService.js';
import { passwordRecoveryEmail } from './mailTemplates.js';

const CODE_LIFETIME_MINUTES = 10;
const CODE_LIFETIME_MS = CODE_LIFETIME_MINUTES * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const GENERIC_MESSAGE = `Si el correo pertenece a una cuenta activa, enviaremos un código válido por ${CODE_LIFETIME_MINUTES} minutos.`;

export const normalizeRecoveryEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

export const hashRecoveryCode = (userId, code) => createHmac('sha256', env.jwtSecret)
  .update(`${userId}:${code}`).digest('hex');

const matchesCode = (expected, actual) => {
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(actual, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
};

const accountForEmail = async (email) => {
  const users = await prisma.usuarios.findMany({
    where: { correo_electronico: { equals: email, mode: 'insensitive' }, activo: true },
    select: { id_usuario: true, nombre_usuario: true }, take: 2,
  });
  return users.length === 1 ? users[0] : null;
};

export const requestPasswordRecovery = async (req, res) => {
  const email = normalizeRecoveryEmail(req.body?.correo_electronico);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Indique un correo electrónico válido.' });
  }
  if (!isMailConfigured()) {
    return res.status(503).json({ error: 'La recuperación por correo aún no está configurada.' });
  }
  try {
    const user = await accountForEmail(email);
    if (!user) return res.json({ message: GENERIC_MESSAGE });

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = hashRecoveryCode(user.id_usuario, code);
    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_usuario FROM "Usuarios" WHERE id_usuario = ${user.id_usuario} FOR UPDATE`;
      const previous = await tx.recuperacionPassword.findUnique({ where: { usuario_id: user.id_usuario } });
      if (previous && now.getTime() - previous.solicitado_en.getTime() < REQUEST_COOLDOWN_MS) return false;
      await tx.recuperacionPassword.upsert({
        where: { usuario_id: user.id_usuario },
        create: { usuario_id: user.id_usuario, codigo_hash: codeHash, expira_en: new Date(now.getTime() + CODE_LIFETIME_MS), solicitado_en: now },
        update: { codigo_hash: codeHash, expira_en: new Date(now.getTime() + CODE_LIFETIME_MS), solicitado_en: now, intentos: 0 },
      });
      return true;
    });
    if (!created) return res.json({ message: GENERIC_MESSAGE });
    try {
      await sendTransactionalEmail({ to: email, ...passwordRecoveryEmail({
        code, validMinutes: CODE_LIFETIME_MINUTES, senderName: mailConfiguration().senderName,
      }) });
    } catch (error) {
      await prisma.recuperacionPassword.deleteMany({ where: { usuario_id: user.id_usuario, codigo_hash: codeHash } });
      console.error('[Recuperación] No se pudo enviar el correo:', error.message);
      return res.status(502).json({ error: 'No se pudo enviar el código. Intente nuevamente más tarde.' });
    }
    return res.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error('[Recuperación] No se pudo solicitar el código:', error.message);
    return res.status(500).json({ error: 'No se pudo solicitar el código.' });
  }
};

export const resetPasswordWithCode = async (req, res) => {
  const email = normalizeRecoveryEmail(req.body?.correo_electronico);
  const code = req.body?.codigo;
  if (!email || email.length > 254 || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Indique el correo y el código de seis dígitos.' });
  }
  try {
    const minimum = (await getBusinessSettings()).reglas.password_minimo;
    const password = validateNewPassword(req.body?.password, minimum);
    if (password !== req.body?.confirmacion) fail(400, 'La confirmación de contraseña no coincide.');
    const user = await accountForEmail(email);
    if (!user) fail(400, 'Código inválido o vencido.');
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_usuario FROM "Usuarios" WHERE id_usuario = ${user.id_usuario} FOR UPDATE`;
      const recovery = await tx.recuperacionPassword.findUnique({ where: { usuario_id: user.id_usuario } });
      if (!recovery || recovery.expira_en.getTime() <= Date.now() || recovery.intentos >= MAX_ATTEMPTS) return 'invalid';
      if (!matchesCode(recovery.codigo_hash, hashRecoveryCode(user.id_usuario, code))) {
        await tx.recuperacionPassword.update({ where: { usuario_id: user.id_usuario }, data: { intentos: { increment: 1 } } });
        return 'invalid';
      }
      const current = await tx.usuarios.findUnique({ where: { id_usuario: user.id_usuario } });
      if (!current?.activo || normalizeRecoveryEmail(current.correo_electronico) !== email) return 'invalid';
      if (await bcrypt.compare(password, current.contrasena_hash)) return 'same';
      await tx.usuarios.update({ where: { id_usuario: user.id_usuario }, data: {
        contrasena_hash: await bcrypt.hash(password, 10), sesion_version: { increment: 1 },
      } });
      await tx.recuperacionPassword.delete({ where: { usuario_id: user.id_usuario } });
      await recordAdminAction({ id: user.id_usuario, username: user.nombre_usuario }, 'Usuarios', 'RECUPERACION_PASSWORD', null,
        { id_usuario: user.id_usuario }, 'Contraseña recuperada con código; sesiones invalidadas.', tx);
      return 'changed';
    });
    if (result === 'invalid') return res.status(400).json({ error: 'Código inválido o vencido.' });
    if (result === 'same') return res.status(400).json({ error: 'Elija una contraseña diferente a la actual.' });
    disconnectUserSessions(user.id_usuario);
    return res.json({ message: 'Contraseña actualizada. Ya puede iniciar sesión.' });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('[Recuperación] No se pudo restablecer la contraseña:', error.message);
    return res.status(500).json({ error: 'No se pudo restablecer la contraseña.' });
  }
};
