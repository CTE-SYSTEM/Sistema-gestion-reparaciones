const generalFinanceReports = new Set(['actividad_financiera', 'ganancias_resumen', 'resumen_contable']);

const slug = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const localDate = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const reportIdentity = (report = {}) => ({
  area: report.categoria || 'Reportes',
  type: report.categoria === 'Finanzas'
    ? generalFinanceReports.has(report.id) ? 'General' : 'Especializado'
    : report.id === 'resumen' ? 'General' : '',
});

export const reportPeriod = (filters = {}) => {
  if (filters.fecha_inicio || filters.fecha_fin) return `Período: ${filters.fecha_inicio || 'sin fecha inicial'} al ${filters.fecha_fin || 'sin fecha final'}`;
  if (filters.year) return `Año: ${filters.year}`;
  return '';
};

export const reportFilename = (report, filters = {}, extension, generatedAt = new Date()) => {
  const { area, type } = reportIdentity(report);
  const period = filters.fecha_inicio || filters.fecha_fin
    ? `desde_${filters.fecha_inicio || 'inicio'}_hasta_${filters.fecha_fin || 'fin'}`
    : filters.year ? `anio_${filters.year}` : '';
  return [slug(area), slug(type), slug(report?.id || report?.nombre || 'reporte'), period,
    `generado_${localDate(generatedAt)}`].filter(Boolean).join('_') + `.${extension}`;
};
