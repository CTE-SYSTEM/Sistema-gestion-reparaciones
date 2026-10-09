export const precioVentaDetalle = (detalle) => {
  const costo = Number(detalle?.compra?.costo_unitario ?? detalle?.repuesto?.costo_individual ?? 0);
  const gananciaFija = Number(detalle?.repuesto?.ganancia_cordobas || 0);
  const porcentaje = Number(detalle?.repuesto?.porcentaje_de_ganacia || 0);
  const precio = costo + (gananciaFija > 0 ? gananciaFija : porcentaje > 0 ? costo * porcentaje / 100 : 0);
  return Math.round(precio * 100) / 100;
};

export const montoRepuestos = (detalles = []) => Math.round(detalles
  .filter((detalle) => String(detalle.estado_aprobacion || '').toUpperCase() === 'APROBADO')
  .reduce((total, detalle) => total + Number(detalle.cantidad_usada || 0)
    * Number(detalle.precio_unitario_facturado ?? precioVentaDetalle(detalle)), 0) * 100) / 100;
