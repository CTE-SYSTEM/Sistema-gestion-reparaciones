import { normalizeRole } from './roles.js';

export const PERMISSIONS = {
  CLIENTES_GESTIONAR: 'clientes:gestionar',
  EQUIPOS_GESTIONAR: 'equipos:gestionar',
  DIAGNOSTICOS_GESTIONAR: 'diagnosticos:gestionar',
  ORDENES_GESTIONAR: 'ordenes:gestionar',
  FACTURAS_GESTIONAR: 'facturas:gestionar',
  FACTURAS_VER: 'facturas:ver',
  GARANTIAS_GESTIONAR: 'garantias:gestionar',
  GARANTIAS_VER: 'garantias:ver',
  CALIDAD_VER: 'calidad:ver',
  CALIDAD_REVISAR: 'calidad:revisar',
  RECLAMOS_VER: 'reclamos:ver',
  RECLAMOS_CREAR: 'reclamos:crear',
  RECLAMOS_ANALIZAR: 'reclamos:analizar',
  RECLAMOS_DECIDIR: 'reclamos:decidir',
  CONTABILIDAD_MOVIMIENTOS: 'contabilidad:movimientos',
  REPUESTOS_TRAZAR: 'repuestos:trazar',
  REPUESTOS_GESTIONAR: 'repuestos:gestionar',
  COMPRAS_GESTIONAR: 'compras:gestionar',
  PROVEEDORES_GESTIONAR: 'proveedores:gestionar',
  FLUJO_VER: 'flujo:ver',
  TECNICO_TRABAJO: 'tecnico:trabajo',
  JEFE_TECNICO_APROBAR: 'jefe-tecnico:aprobar',
  JEFE_TECNICO_VER: 'jefe-tecnico:ver',
  JEFE_TECNICO_ASIGNAR: 'jefe-tecnico:asignar',
  JEFE_TECNICO_PRIORIDAD: 'jefe-tecnico:prioridad',
  JEFE_TECNICO_EQUIPO: 'jefe-tecnico:equipo',
  JEFE_TECNICO_INTERVENIR: 'jefe-tecnico:intervenir',
  REPUESTOS_ENTREGAR: 'repuestos:entregar',
  ADMIN_USUARIOS: 'admin:usuarios',
  ADMIN_REPORTES: 'admin:reportes',
};

const secretariaPermissions = [
  PERMISSIONS.CLIENTES_GESTIONAR,
  PERMISSIONS.EQUIPOS_GESTIONAR,
  PERMISSIONS.DIAGNOSTICOS_GESTIONAR,
  PERMISSIONS.ORDENES_GESTIONAR,
  PERMISSIONS.FACTURAS_GESTIONAR,
  PERMISSIONS.FACTURAS_VER,
  PERMISSIONS.GARANTIAS_GESTIONAR,
  PERMISSIONS.GARANTIAS_VER,
  PERMISSIONS.CALIDAD_VER,
  PERMISSIONS.CALIDAD_REVISAR,
  PERMISSIONS.RECLAMOS_VER,
  PERMISSIONS.RECLAMOS_CREAR,
  PERMISSIONS.RECLAMOS_ANALIZAR,
  PERMISSIONS.RECLAMOS_DECIDIR,
  PERMISSIONS.CONTABILIDAD_MOVIMIENTOS,
  PERMISSIONS.REPUESTOS_TRAZAR,
  PERMISSIONS.REPUESTOS_GESTIONAR,
  PERMISSIONS.COMPRAS_GESTIONAR,
  PERMISSIONS.PROVEEDORES_GESTIONAR,
  PERMISSIONS.FLUJO_VER,
];

const tecnicoPermissions = [
  PERMISSIONS.TECNICO_TRABAJO,
];

const jefeTecnicoPermissions = [
  PERMISSIONS.FLUJO_VER,
  PERMISSIONS.JEFE_TECNICO_VER,
  PERMISSIONS.JEFE_TECNICO_ASIGNAR,
  PERMISSIONS.JEFE_TECNICO_PRIORIDAD,
  PERMISSIONS.JEFE_TECNICO_EQUIPO,
  PERMISSIONS.JEFE_TECNICO_INTERVENIR,
  PERMISSIONS.REPUESTOS_ENTREGAR,
  PERMISSIONS.JEFE_TECNICO_APROBAR,
];

const adminPermissions = [
  ...secretariaPermissions,
  ...tecnicoPermissions,
  ...jefeTecnicoPermissions,
  PERMISSIONS.ADMIN_USUARIOS,
  PERMISSIONS.ADMIN_REPORTES,
];

export const ROLE_PERMISSIONS = {
  admin: adminPermissions,
  secretaria: secretariaPermissions,
  recepcion: [PERMISSIONS.CLIENTES_GESTIONAR, PERMISSIONS.EQUIPOS_GESTIONAR,
    PERMISSIONS.DIAGNOSTICOS_GESTIONAR, PERMISSIONS.ORDENES_GESTIONAR,
    PERMISSIONS.FACTURAS_VER, PERMISSIONS.FLUJO_VER, PERMISSIONS.RECLAMOS_VER, PERMISSIONS.RECLAMOS_CREAR],
  bodega: [PERMISSIONS.REPUESTOS_GESTIONAR, PERMISSIONS.COMPRAS_GESTIONAR,
    PERMISSIONS.PROVEEDORES_GESTIONAR, PERMISSIONS.REPUESTOS_TRAZAR, PERMISSIONS.REPUESTOS_ENTREGAR],
  calidad: [PERMISSIONS.CALIDAD_VER, PERMISSIONS.CALIDAD_REVISAR],
  reclamos: [PERMISSIONS.RECLAMOS_VER, PERMISSIONS.RECLAMOS_CREAR, PERMISSIONS.RECLAMOS_ANALIZAR],
  garantias: [PERMISSIONS.GARANTIAS_GESTIONAR, PERMISSIONS.GARANTIAS_VER, PERMISSIONS.FACTURAS_VER, PERMISSIONS.RECLAMOS_VER, PERMISSIONS.RECLAMOS_DECIDIR],
  contabilidad: [PERMISSIONS.FACTURAS_GESTIONAR, PERMISSIONS.FACTURAS_VER, PERMISSIONS.GARANTIAS_VER, PERMISSIONS.CONTABILIDAD_MOVIMIENTOS, PERMISSIONS.RECLAMOS_VER],
  tecnico: tecnicoPermissions,
  tecnicojefe: jefeTecnicoPermissions,
  administrador: adminPermissions,
  adminpro: adminPermissions,
};

export const getRolePermissions = (role) => ROLE_PERMISSIONS[normalizeRole(role)] || [];

export const hasPermission = (role, permission) =>
  getRolePermissions(role).includes(permission);

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  if (!hasPermission(req.user.rol, permission)) {
    return res.status(403).json({ error: 'No autorizado para esta accion' });
  }

  return next();
};

export default {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getRolePermissions,
  hasPermission,
  requirePermission,
};
