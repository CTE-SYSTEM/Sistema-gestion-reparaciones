import bcrypt from 'bcryptjs';
import prisma from '../../app/prismaClient.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { ADMIN_ROLES, ASSIGNABLE_ROLES, isAdminRole, fail, validateNewPassword } from '../../utils/adminPolicy.js';
import { positiveId } from '../../utils/adminFilters.js';
import { getBusinessSettings, recordAdminAction } from '../../services/adminSettingsService.js';
import { adminError } from './administracionController.js';
import { disconnectUserSessions } from '../../services/notifications.js';

const publicUser = ({ contrasena_hash, sesion_version, ...user }) => user;
const profile = (body) => {
  const data = {};
  if (body.nombre_usuario !== undefined) {
    if (typeof body.nombre_usuario !== 'string' || !body.nombre_usuario.trim() || body.nombre_usuario.length > 100) fail(400, 'Nombre de usuario inválido.');
    data.nombre_usuario = body.nombre_usuario.trim();
  }
  if (body.correo_electronico !== undefined) {
    if (body.correo_electronico != null && (typeof body.correo_electronico !== 'string' || body.correo_electronico.length > 254 || (body.correo_electronico.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.correo_electronico.trim())))) fail(400, 'Correo inválido.');
    data.correo_electronico = body.correo_electronico?.trim() || null;
  }
  if (body.activo !== undefined) {
    if (typeof body.activo !== 'boolean') fail(400, 'Estado de cuenta inválido.');
    data.activo = body.activo;
  }
  return data;
};
const guardAccess = async (tx, actor, current, data) => {
  const nextRole = data.rol ?? current.rol, nextActive = data.activo ?? current.activo;
  if (actor.id === current.id_usuario && (!nextActive || nextRole !== current.rol)) fail(409, 'No puede desactivar ni cambiar el rol de su propia cuenta.');
  if (current.activo && isAdminRole(current.rol) && (!nextActive || !isAdminRole(nextRole))) {
    const count = await tx.usuarios.count({ where: { activo: true, rol: { in: ADMIN_ROLES } } });
    if (count <= 1) fail(409, 'Debe conservar al menos un administrador activo.');
  }
};
export const getUsuarios = async (req, res) => {
  try {
    const users = await prisma.usuarios.findMany({ select: {
      id_usuario: true, nombre_usuario: true, correo_electronico: true, rol: true,
      activo: true, fecha_creacion: true, tecnico: true,
    }, orderBy: { id_usuario: 'asc' } });
    res.json({ data: users, password_minimo: (await getBusinessSettings()).reglas.password_minimo });
  } catch (error) { adminError(res, error, 'No se pudieron cargar los usuarios.'); }
};
export const createUsuario = async (req, res) => {
  try {
    const data = profile(req.body);
    if (!data.nombre_usuario) fail(400, 'El nombre de usuario es obligatorio.');
    if (!ASSIGNABLE_ROLES.includes(req.body.rol)) fail(400, 'Seleccione Secretaría, Técnico o Jefe técnico.');
    const minimum = (await getBusinessSettings()).reglas.password_minimo;
    const hash = await bcrypt.hash(validateNewPassword(req.body.password, minimum), 10);
    const result = await withAuditUser(req.user, async (tx) => {
      const user = await tx.usuarios.create({ data: { ...data, rol: req.body.rol, contrasena_hash: hash } });
      let tecnico = null;
      if (user.rol === 'Tecnico') tecnico = await tx.tecnicos.create({ data: {
        usuario_id: user.id_usuario, nombre: user.nombre_usuario, activo: user.activo,
        especialidad: req.body.especialidad?.trim() || null, horario: req.body.horario?.trim() || null,
        contacto: req.body.contacto?.trim() || user.correo_electronico,
      } });
      return { data: publicUser(user), usuario: publicUser(user), tecnico };
    });
    res.status(201).json(result);
  } catch (error) { adminError(res, error, 'No se pudo crear la cuenta.'); }
};
export const updateUsuario = async (req, res) => {
  try {
    const id = positiveId(req.params.id, 'Usuario', false), data = profile(req.body);
    let accessChanged = false;
    const user = await withAuditUser(req.user, async (tx) => {
      // Serializa cambios de acceso para proteger al último administrador frente a solicitudes simultáneas.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(734821)::text AS lock`;
      const current = await tx.usuarios.findUnique({ where: { id_usuario: id } });
      if (!current) fail(404, 'Usuario no encontrado.');
      if (req.body.rol !== undefined) {
        if (req.body.rol !== current.rol && !ASSIGNABLE_ROLES.includes(req.body.rol)) fail(400, 'No se permite elevar una cuenta a administrador desde Usuarios.');
        data.rol = req.body.rol;
      }
      await guardAccess(tx, req.user, current, data);
      const updated = await tx.usuarios.update({ where: { id_usuario: id }, data });
      if (updated.rol === 'Tecnico') {
        await tx.tecnicos.upsert({ where: { usuario_id: id },
          update: { nombre: updated.nombre_usuario, activo: updated.activo },
          create: { usuario_id: id, nombre: updated.nombre_usuario, activo: updated.activo } });
      } else if (current.rol === 'Tecnico') {
        await tx.tecnicos.updateMany({ where: { usuario_id: id }, data: { activo: false } });
      }
      if (updated.rol !== current.rol || updated.activo !== current.activo || updated.nombre_usuario !== current.nombre_usuario) {
        accessChanged = true;
        await tx.$executeRaw`UPDATE "Usuarios" SET sesion_version = sesion_version + 1 WHERE id_usuario = ${id}`;
      }
      return updated;
    });
    if (accessChanged) disconnectUserSessions(id);
    res.json({ data: publicUser(user) });
  } catch (error) { adminError(res, error, 'No se pudo actualizar la cuenta.'); }
};
export const updateUsuarioPassword = async (req, res) => {
  try {
    const id = positiveId(req.params.id, 'Usuario', false);
    if (id === req.user.id) fail(400, 'Cambie su contraseña desde Mi cuenta.');
    const minimum = (await getBusinessSettings()).reglas.password_minimo;
    const password = validateNewPassword(req.body.password, minimum);
    await withAuditUser(req.user, async (tx) => {
      const actor = await tx.usuarios.findUnique({ where: { id_usuario: req.user.id } });
      if (typeof req.body.admin_password !== 'string' || !await bcrypt.compare(req.body.admin_password, actor.contrasena_hash)) fail(403, 'La contraseña del administrador no es correcta.');
      await tx.usuarios.update({ where: { id_usuario: id }, data: { contrasena_hash: await bcrypt.hash(password, 10) } });
      await tx.$executeRaw`UPDATE "Usuarios" SET sesion_version = sesion_version + 1 WHERE id_usuario = ${id}`;
      await recordAdminAction(req.user, 'Usuarios', 'CAMBIO_PASSWORD', null, { id_usuario: id }, 'Cambio administrativo de contraseña; sesiones invalidadas.', tx);
    });
    disconnectUserSessions(id);
    res.json({ message: 'Contraseña actualizada y sesiones anteriores cerradas.' });
  } catch (error) { adminError(res, error, 'No se pudo cambiar la contraseña.'); }
};
export const deleteUsuario = async (req, res) => {
  req.body = { activo: false };
  return updateUsuario(req, res);
};
