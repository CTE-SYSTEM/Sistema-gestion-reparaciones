export const mergeNotifications = (incoming, previous = [], limit = 25) =>
  [...new Map([...previous, ...incoming].map((item) => [item.id, item])).values()]
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, limit);

export const reconcileNotifications = (history, arrivals, readIds = new Set(), limit = 25) =>
  mergeNotifications([...history, ...arrivals].filter((item) => !readIds.has(item.id)), [], limit);

const areaNames = {
  recepcion: 'Recepción', serviciocliente: 'Servicio al cliente', bodega: 'Bodega',
  calidad: 'Calidad', reclamos: 'Reclamos', garantias: 'Garantías', contabilidad: 'Contabilidad',
};

export const notificationAreaNames = (item) => [...new Set(item?.areas_origen || [])]
  .map((area) => areaNames[area]).filter(Boolean);

export const secretaryNotificationTarget = (item) => {
  const type = item?.type || '';
  const kind = item?.entity?.kind;
  const areas = item?.areas_origen || [];
  if (type === 'reclamo_proveedor') return '/bodega/inventario';
  if (type.startsWith('reclamo_') || kind === 'reclamo') return '/reclamos';
  if (type.startsWith('repuesto_')) return '/bodega/entregas';
  if (type === 'compra_registrada' || kind === 'compra') return '/secretaria/compras';
  if (type === 'orden_finalizada' || type === 'orden_cierre_corregido') return '/calidad';
  if (type === 'calidad_diagnostico_aprobada') return '/secretaria/flujo-atencion';
  if (type === 'calidad_aprobada' || type === 'irreparable_confirmado' || type === 'factura_creada') return '/secretaria/facturacion';
  if (type === 'equipo_entregado') return '/garantias';
  if (type === 'diagnostico_completado') return '/secretaria/nueva-orden';
  if (type === 'orden_creada_servicio_cliente') return '/secretaria/flujo-atencion';
  if (type === 'equipo_recibido') return '/secretaria/diagnostico';
  if (areas.includes('calidad')) return '/calidad';
  if (areas.includes('bodega')) return '/bodega/inventario';
  if (areas.includes('garantias')) return '/garantias';
  if (areas.includes('contabilidad')) return '/contabilidad/movimientos';
  if (areas.includes('serviciocliente')) return '/secretaria/flujo-atencion';
  if (areas.includes('recepcion')) return '/secretaria/diagnostico';
  return '/secretaria';
};

export const notificationActionLabel = (item) => {
  if (item?.type === 'reclamo_proveedor') return 'Revisar pieza';
  if (item?.entity?.kind === 'reclamo') return 'Ver reclamo';
  if (item?.entity?.kind === 'factura') return 'Ver factura';
  if (item?.entity?.kind === 'compra') return 'Ver compra';
  if (item?.entity?.kind === 'garantia') return 'Ver garantía';
  if (['diagnostico_creado', 'orden_creada'].includes(item?.type)) return 'Asignar técnico';
  if (item?.type === 'repuesto_solicitado') return 'Revisar solicitud';
  if (item?.type === 'orden_irreparable_pendiente') return 'Revisar irreparabilidad';
  return item?.entity?.kind === 'diagnostico'
    ? 'Ver diagnóstico' : item?.entity?.kind === 'repuesto' ? 'Ver solicitud' : 'Ver orden';
};
