// Coincide con los roles que gestionan órdenes y facturas en el servidor.
export const facturacionAccess = (role) => {
  const normalized = String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]/g, '').toLowerCase();
  const canManage = ['administrador', 'adminpro', 'admin', 'secretaria', 'serviciocliente'].includes(normalized);
  return { canDeliver: canManage, canInvoice: canManage };
};
