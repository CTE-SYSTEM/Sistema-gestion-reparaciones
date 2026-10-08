export const mergeNotifications = (incoming, previous = [], limit = 25) =>
  [...new Map([...previous, ...incoming].map((item) => [item.id, item])).values()]
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, limit);

export const reconcileNotifications = (history, arrivals, readIds = new Set(), limit = 25) =>
  mergeNotifications([...history, ...arrivals].filter((item) => !readIds.has(item.id)), [], limit);

export const notificationActionLabel = (item) => {
  if (item?.entity?.kind === 'factura') return 'Ver factura';
  if (item?.entity?.kind === 'compra') return 'Ver compra';
  if (item?.entity?.kind === 'garantia') return 'Ver garantía';
  if (['diagnostico_creado', 'orden_creada'].includes(item?.type)) return 'Asignar técnico';
  if (item?.type === 'repuesto_solicitado') return 'Revisar solicitud';
  if (item?.type === 'orden_irreparable_pendiente') return 'Revisar irreparabilidad';
  return item?.entity?.kind === 'diagnostico'
    ? 'Ver diagnóstico' : item?.entity?.kind === 'repuesto' ? 'Ver solicitud' : 'Ver orden';
};
