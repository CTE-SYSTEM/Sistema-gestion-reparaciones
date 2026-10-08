import { normalizeRole } from './roles.js';

export const isAdminRole = (role) => ['administrador', 'adminpro', 'admin'].includes(normalizeRole(role));
export const ADMIN_ROLES = ['Administrador', 'admin_pro', 'Admin'];
export const ASSIGNABLE_ROLES = ['Recepcion', 'Bodega', 'Calidad', 'Reclamos', 'Garantias', 'Contabilidad', 'TecnicoJefe', 'Tecnico'];
export const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export const DEFAULT_ADMIN_SETTINGS = {
  negocio: {
    nombre: 'Centro Técnico Electrónico', correo: '', telefono: '', direccion: '',
    garantia_meses: 3,
    garantia_condiciones: 'Cubre fallas relacionadas con la reparación y los repuestos instalados. No cubre golpes, humedad, variaciones eléctricas, mala manipulación ni intervenciones de terceros.',
    margen_repuesto_porcentaje: 0,
  },
  reglas: {
    garantia_aviso_dias: 30, orden_atrasada_dias: 7,
    correccion_cierre_horas: 24, correccion_excepcional_habilitada: true,
    tarifas_diagnostico: [], tarifas_mano_obra: [],
    stock_minimo_predeterminado: 1,
    rentabilidad_alerta_porcentaje: 30, margen_orden_alerta_porcentaje: 20,
    password_minimo: 8,
  },
  respaldos: {
    habilitado: true, frecuencia: 'mensual', hora: '02:00', dia_semana: 1,
    dia_mes: 1, zona_horaria: 'America/Managua', conservacion_dias: 0,
  },
};

const integer = (value, min, max, label) => {
  if (!Number.isInteger(value) || value < min || value > max) fail(400, `${label}: indique un entero entre ${min} y ${max}.`);
  return value;
};
const percentage = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000) fail(400, `${label}: indique un porcentaje entre 0 y 1000.`);
  return value;
};
export const validateSettings = (input, previous = DEFAULT_ADMIN_SETTINGS) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Configuración inválida.');
  const result = structuredClone(previous);
  for (const [section, fields] of Object.entries(input)) {
    if (!Object.hasOwn(DEFAULT_ADMIN_SETTINGS, section) || !fields || typeof fields !== 'object' || Array.isArray(fields)) fail(400, 'Sección de configuración no reconocida.');
    for (const [key, value] of Object.entries(fields)) {
      if (!Object.hasOwn(DEFAULT_ADMIN_SETTINGS[section], key)) fail(400, `Parámetro no reconocido: ${key}.`);
      result[section][key] = value;
    }
  }
  const b = result.negocio, r = result.reglas, s = result.respaldos;
  for (const key of ['nombre', 'correo', 'telefono', 'direccion', 'garantia_condiciones']) {
    if (typeof b[key] !== 'string' || b[key].length > (key === 'garantia_condiciones' ? 2000 : 300)) fail(400, `Valor inválido: ${key}.`);
    b[key] = b[key].trim();
  }
  if (!b.nombre || !b.garantia_condiciones) fail(400, 'El nombre del negocio y las condiciones de garantía son obligatorios.');
  if (b.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.correo)) fail(400, 'Correo del negocio inválido.');
  integer(b.garantia_meses, 1, 36, 'Duración de garantía');
  percentage(b.margen_repuesto_porcentaje, 'Margen de repuestos');
  integer(r.garantia_aviso_dias, 1, 365, 'Aviso de garantías');
  integer(r.orden_atrasada_dias, 1, 365, 'Plazo de órdenes');
  integer(r.correccion_cierre_horas, 1, 168, 'Plazo de corrección del cierre');
  integer(r.stock_minimo_predeterminado, 0, 100000, 'Stock mínimo predeterminado');
  for (const key of ['tarifas_diagnostico', 'tarifas_mano_obra']) {
    const tarifas = r[key];
    if (!Array.isArray(tarifas) || tarifas.length > 30) fail(400, 'La lista de tarifas no es válida.');
    const nombres = new Set();
    r[key] = tarifas.map((tarifa) => {
      const nombre = typeof tarifa?.nombre === 'string' ? tarifa.nombre.trim() : '';
      const monto = tarifa?.monto;
      if (!nombre || nombre.length > 100 || typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0 || monto > 10000000 || Number(monto.toFixed(2)) !== monto) fail(400, 'Cada tarifa necesita un nombre y un monto positivo con hasta dos decimales.');
      if (nombres.has(nombre.toLocaleLowerCase('es'))) fail(400, 'No repita nombres de tarifas en la misma lista.');
      nombres.add(nombre.toLocaleLowerCase('es'));
      return { nombre, monto };
    });
  }
  if (typeof r.correccion_excepcional_habilitada !== 'boolean') fail(400, 'La regla de corrección excepcional debe ser verdadera o falsa.');
  integer(r.password_minimo, 8, 64, 'Longitud mínima de contraseña');
  for (const key of ['rentabilidad_alerta_porcentaje', 'margen_orden_alerta_porcentaje']) integer(r[key], 0, 100, 'Umbral de margen');
  if (typeof s.habilitado !== 'boolean') fail(400, 'El estado de programación debe ser verdadero o falso.');
  if (!['diaria', 'semanal', 'mensual'].includes(s.frecuencia)) fail(400, 'Frecuencia no válida.');
  if (typeof s.hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.hora)) fail(400, 'Hora inválida.');
  integer(s.dia_semana, 0, 6, 'Día de la semana');
  integer(s.dia_mes, 1, 28, 'Día del mes');
  integer(s.conservacion_dias, 0, 3650, 'Conservación de copias');
  if (s.zona_horaria !== 'America/Managua') fail(400, 'La programación utiliza la hora de Nicaragua.');
  return result;
};

// La auditoría antigua puede contener hashes: se filtran también al leerla.
export const redactAuditData = (value) => {
  if (Array.isArray(value)) return value.map(redactAuditData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(password|contrasena|contraseña|token|secret|clave_acceso)/i.test(key))
    .map(([key, item]) => [key, redactAuditData(item)]));
  return value;
};

export const validateNewPassword = (password, minimum = 8) => {
  if (typeof password !== 'string' || !password.trim() || password.length < minimum || Buffer.byteLength(password, 'utf8') > 72) {
    fail(400, `La contraseña debe tener al menos ${minimum} caracteres y como máximo 72 bytes.`);
  }
  return password;
};
