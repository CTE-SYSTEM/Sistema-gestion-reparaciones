const generalFinanceReports = new Set(['actividad_financiera', 'ganancias_resumen', 'resumen_contable']);

const slug = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

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

export const reportFilename = (report, _filters = {}, extension) => `${slug(report?.id || 'reporte')}.${extension}`;

// Los identificadores y períodos se imprimen dentro del documento, nunca en la descarga.
export const documentFilename = (filename, extension) => {
  const base = String(filename || 'reporte').split(/[\\/]/).pop().replace(/\.(pdf|csv|xls|xlsx)$/i, '')
    .replace(/\d{4}[-_]\d{2}[-_]\d{2}/g, '').replace(/\d+/g, '')
    .replace(/(?:generado|desde|hasta|anio)[_-]*/g, '');
  return `${slug(base) || 'reporte'}.${extension}`;
};
