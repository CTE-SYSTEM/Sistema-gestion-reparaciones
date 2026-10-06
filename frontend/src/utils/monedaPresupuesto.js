export const formatoPresupuesto = (value, moneda = 'NIO') => `${moneda === 'USD' ? 'US$' : 'C$'} ${Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const montoAutorizadoInicial = (diagnostico) => diagnostico.moneda_presupuesto === 'USD' ? '' : diagnostico.presupuesto_estimado ?? '';
