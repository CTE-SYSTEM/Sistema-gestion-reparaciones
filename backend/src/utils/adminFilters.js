import { fail } from './adminPolicy.js';

export const positiveId = (value, label = 'Identificador', optional = true) => {
  if (optional && (value == null || value === '')) return null;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) fail(400, `${label} inválido.`);
  return Number(value);
};
export const dateRange = (query) => {
  const parse = (value) => {
    if (value == null || value === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
      || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) fail(400, 'Fecha inválida.');
    return value;
  };
  const start = parse(query.fecha_inicio), end = parse(query.fecha_fin);
  if (start && end && start > end) fail(400, 'La fecha inicial debe ser anterior o igual a la final.');
  return {
    start, end,
    where: { ...(start ? { gte: new Date(`${start}T00:00:00-06:00`) } : {}),
      ...(end ? { lt: new Date(new Date(`${end}T00:00:00-06:00`).getTime() + 86400000) } : {}) },
  };
};
