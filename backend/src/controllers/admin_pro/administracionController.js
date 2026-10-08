import bcrypt from 'bcryptjs';
import prisma from '../../app/prismaClient.js';
import { getAdminSettings, getBusinessSettings, saveAdminSettings, recordAdminAction } from '../../services/adminSettingsService.js';
import { synchronizeBackupSchedule } from '../../services/backupService.js';
import { getRolePermissions, ROLE_PERMISSIONS } from '../../utils/permissions.js';
import { fail, redactAuditData, validateNewPassword } from '../../utils/adminPolicy.js';
import { dateRange, positiveId } from '../../utils/adminFilters.js';
import { withAuditUser } from '../../utils/auditContext.js';
import { ORDEN_ESTADOS, DIAGNOSTICO_ESTADOS } from '../../utils/domainValidation.js';
import { disconnectUserSessions } from '../../services/notifications.js';

export const adminError = (res, error, fallback = 'No se pudo completar la operación.') => {
  if (error.status || error.statusCode) return res.status(error.status || error.statusCode).json({ error: error.message });
  if (error.code === 'P2002') return res.status(409).json({ error: 'El nombre de usuario ya existe.' });
  if (error.code === 'P2025') return res.status(404).json({ error: 'Registro no encontrado.' });
  console.error('[Administración]', error.message);
  return res.status(500).json({ error: fallback });
};
const publicUser = (user) => ({
  id_usuario: user.id_usuario, nombre_usuario: user.nombre_usuario,
  correo_electronico: user.correo_electronico, rol: user.rol,
  fecha_creacion: user.fecha_creacion, activo: user.activo,
});
const confirmPassword = async (tx, id, password) => {
  const user = await tx.usuarios.findUnique({ where: { id_usuario: id } });
  if (!user || typeof password !== 'string' || !await bcrypt.compare(password, user.contrasena_hash)) fail(403, 'La contraseña actual no es correcta.');
  return user;
};
export const getMyAccount = async (req, res) => {
  try {
    const user = await prisma.usuarios.findUnique({ where: { id_usuario: req.user.id } });
    res.json({ data: publicUser(user), permisos: getRolePermissions(user.rol), password_minimo: (await getBusinessSettings()).reglas.password_minimo });
  } catch (error) { adminError(res, error); }
};
export const updateMyAccount = async (req, res) => {
  try {
    const { nombre_usuario, correo_electronico, password_actual } = req.body;
    if (typeof nombre_usuario !== 'string' || !nombre_usuario.trim() || nombre_usuario.length > 100) fail(400, 'Indique un nombre de usuario de hasta 100 caracteres.');
    if (typeof correo_electronico !== 'string' || correo_electronico.length > 254
      || (correo_electronico.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo_electronico.trim()))) fail(400, 'Correo inválido.');
    const user = await withAuditUser(req.user, async (tx) => {
      await confirmPassword(tx, req.user.id, password_actual);
      return tx.usuarios.update({ where: { id_usuario: req.user.id }, data: {
        nombre_usuario: nombre_usuario.trim(), correo_electronico: correo_electronico.trim() || null,
      } });
    });
    res.json({ data: publicUser(user), message: 'Datos de la cuenta actualizados.' });
  } catch (error) { adminError(res, error); }
};
export const changeMyPassword = async (req, res) => {
  try {
    const settings = await getBusinessSettings();
    const password = validateNewPassword(req.body.password, settings.reglas.password_minimo);
    if (password !== req.body.confirmacion) fail(400, 'La confirmación de contraseña no coincide.');
    await withAuditUser(req.user, async (tx) => {
      const user = await confirmPassword(tx, req.user.id, req.body.password_actual);
      if (await bcrypt.compare(password, user.contrasena_hash)) fail(400, 'Elija una contraseña diferente a la actual.');
      await tx.usuarios.update({ where: { id_usuario: req.user.id }, data: { contrasena_hash: await bcrypt.hash(password, 10) } });
      await tx.recuperacionPassword.deleteMany({ where: { usuario_id: req.user.id } });
      await tx.$executeRaw`UPDATE "Usuarios" SET sesion_version = sesion_version + 1 WHERE id_usuario = ${req.user.id}`;
      await recordAdminAction(req.user, 'Usuarios', 'CAMBIO_PASSWORD', null, { id_usuario: req.user.id }, 'Cambio de contraseña propia; sesiones invalidadas.', tx);
    });
    disconnectUserSessions(req.user.id);
    res.json({ message: 'Contraseña actualizada. Inicie sesión nuevamente.', cerrar_sesion: true });
  } catch (error) { adminError(res, error); }
};
export const revokeMySessions = async (req, res) => {
  try {
    await withAuditUser(req.user, async (tx) => {
      await confirmPassword(tx, req.user.id, req.body.password_actual);
      await tx.$executeRaw`UPDATE "Usuarios" SET sesion_version = sesion_version + 1 WHERE id_usuario = ${req.user.id}`;
      await recordAdminAction(req.user, 'Usuarios', 'CIERRE_SESIONES', null, { id_usuario: req.user.id }, 'Cierre de todas las sesiones de la cuenta.', tx);
    });
    disconnectUserSessions(req.user.id);
    res.json({ message: 'Sesiones cerradas.', cerrar_sesion: true });
  } catch (error) { adminError(res, error); }
};
export const getConfiguration = async (req, res) => {
  try { res.json({ data: await getAdminSettings() }); }
  catch (error) { adminError(res, error); }
};
export const updateConfiguration = async (req, res) => {
  try {
    const data = await saveAdminSettings(req.user, req.body.valores, req.body.revision, req.body.motivo);
    await synchronizeBackupSchedule(data.valores.respaldos);
    res.json({ data, message: 'Configuración guardada y cambio registrado en auditoría.' });
  } catch (error) { adminError(res, error); }
};
export const getBusinessRules = async (req, res) => {
  try {
    res.json({ data: {
      configuracion: await getAdminSettings(), permisos: ROLE_PERMISSIONS,
      modulos: [
        { id: 'recepcion', nombre: 'Recepción y equipos', ruta: '/admin/equipos', reglas: ['Cliente y equipo válidos.', 'Cargador y acceso según la familia del electrónico.', 'Las fotografías requieren revisión antes de ser visibles para el técnico.'] },
        { id: 'diagnosticos', nombre: 'Diagnósticos', ruta: '/admin/diagnosticos', estados: DIAGNOSTICO_ESTADOS, reglas: ['El informe PDF exige un diagnóstico finalizado y un informe técnico.', 'Los presupuestos NIO y USD se muestran y totalizan por separado.'] },
        { id: 'ordenes', nombre: 'Órdenes y entrega', ruta: '/admin/ordenes', estados: ORDEN_ESTADOS, reglas: ['Crear orden exige informe, presupuesto y monto autorizado positivo.', 'Una orden por diagnóstico.', 'Entregar exige finalización o irreparabilidad, factura, foto y receptor.', 'Cancelar exige motivo y cumplir las restricciones por estado y factura.', 'El técnico puede corregir o reabrir un cierre sin factura ni entrega y agregar fotos con motivo durante el plazo configurado; después se exige una excepción explícita si está habilitada.', 'Un informe facturado, entregado o irreparable conserva su versión original y admite aclaraciones con historial.'] },
        { id: 'inventario', nombre: 'Inventario y repuestos', ruta: '/admin/inventario', reglas: ['Aprobar reserva la pieza; entregarla es una acción posterior.', 'No se puede consumir stock inexistente.', 'Los cambios de margen se aplican a nuevos precios; las facturas emitidas conservan sus importes.'] },
        { id: 'garantias', nombre: 'Garantías', ruta: '/admin/garantias', reglas: ['Una garantía por factura.', 'La vigencia automática comienza con la entrega.', 'La duración predeterminada y las condiciones se aplican a nuevas garantías.'] },
        { id: 'usuarios', nombre: 'Cuentas y permisos', ruta: '/admin/usuarios', reglas: ['Una cuenta desactivada pierde acceso.', 'No se permite desactivar la cuenta propia ni retirar al último administrador activo.', 'Cambiar la contraseña invalida los tokens de sesión anteriores.'] },
      ],
    } });
  } catch (error) { adminError(res, error); }
};

export const auditWhere = (query) => {
  const { where: date } = dateRange(query);
  const where = {};
  if (Object.keys(date).length) where.fecha_movimiento = date;
  if (query.tabla) where.tabla = String(query.tabla).slice(0, 100);
  if (query.operacion) where.operacion = String(query.operacion).slice(0, 100);
  const userId = positiveId(query.usuario_id, 'Usuario');
  if (userId) where.usuario_id = userId;
  if (query.buscar) {
    const search = String(query.buscar).trim().slice(0, 100);
    where.OR = ['usuario_nombre', 'observacion', 'tabla'].map((key) => ({ [key]: { contains: search, mode: 'insensitive' } }));
  }
  return where;
};
export const getAudit = async (req, res) => {
  try {
    const page = positiveId(req.query.page || 1, 'Página', false);
    const limit = Math.min(positiveId(req.query.limit || 20, 'Límite', false), 100);
    const where = auditWhere(req.query);
    const [rows, total, tables] = await Promise.all([
      prisma.auditoria_Movimientos.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ fecha_movimiento: 'desc' }, { id_auditoria: 'desc' }] }),
      prisma.auditoria_Movimientos.count({ where }),
      prisma.auditoria_Movimientos.findMany({ distinct: ['tabla'], select: { tabla: true }, orderBy: { tabla: 'asc' } }),
    ]);
    res.json({ data: rows.map((row) => ({ ...row, id_auditoria: String(row.id_auditoria), datos_anteriores: redactAuditData(row.datos_anteriores), datos_nuevos: redactAuditData(row.datos_nuevos) })),
      meta: { page, limit, total, pages: Math.ceil(total / limit) }, tablas: tables.map((row) => row.tabla) });
  } catch (error) { adminError(res, error); }
};
