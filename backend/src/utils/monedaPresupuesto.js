export const monedaPresupuesto = (value, fallback = 'NIO') => {
  const moneda = value === undefined ? fallback : String(value).trim().toUpperCase();
  if (!['NIO', 'USD'].includes(moneda)) throw Object.assign(new Error('La moneda del presupuesto debe ser NIO o USD'), { statusCode: 400 });
  return moneda;
};
export const formatoPresupuesto = (value, moneda = 'NIO') => `${moneda === 'USD' ? 'US$' : 'C$'} ${Number(value || 0).toFixed(2)}`;
