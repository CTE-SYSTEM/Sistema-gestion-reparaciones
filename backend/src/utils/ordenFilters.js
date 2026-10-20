import { ORDEN_ESTADOS, assertInList } from './domainValidation.js';

const fail = (message) => { throw Object.assign(new Error(message), { statusCode: 400 }); };

const parseDate = (value) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('La fecha debe tener formato AAAA-MM-DD');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail('La fecha no es válida');
  // El día de ingreso se interpreta en la zona horaria del taller (Managua).
  return new Date(`${value}T00:00:00-06:00`);
};

export const buildOrdenFilters = (query = {}) => {
  const scope = assertInList(query.scope, ['activas', 'historial'], 'Vista de órdenes');
  const estado = assertInList(query.estado, ORDEN_ESTADOS, 'Estado de la orden');
  const desde = parseDate(query.desde);
  const hasta = parseDate(query.hasta);
  if (desde && hasta && desde > hasta) fail('La fecha inicial debe ser anterior o igual a la final');
  const filters = [];
  if (scope) filters.push({ estado: { [scope === 'activas' ? 'notIn' : 'in']: ['ENTREGADO', 'CANCELADO'] } });
  if (estado) filters.push({ estado });
  if (desde || hasta) filters.push({ fecha_ingreso: {
    ...(desde ? { gte: desde } : {}),
    ...(hasta ? { lt: new Date(hasta.getTime() + 86400000) } : {}),
  } });
  return filters;
};
