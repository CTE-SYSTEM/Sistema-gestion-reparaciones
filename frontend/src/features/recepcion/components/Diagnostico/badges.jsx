export const PrioridadBadge = ({ prioridad }) => {
  const config = {
    Urgente: 'bg-red-100 text-red-800 border-red-200',
    Alta: 'bg-orange-100 text-orange-800 border-orange-200',
    Normal: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${config[prioridad] || 'bg-gray-100 text-gray-800'}`}>
      {prioridad}
    </span>
  );
};

export const EstadoBadge = ({ estado }) => {
  const config = {
    PENDIENTE: 'bg-yellow-100 text-yellow-800',
    REPARACION: 'bg-purple-100 text-purple-800',
    FINALIZADO: 'bg-emerald-100 text-emerald-800',
    INGRESADO: 'bg-blue-100 text-blue-800',
    ENTREGADO: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config[estado] || 'bg-gray-100 text-gray-800'}`}>
      {estado || 'PENDIENTE'}
    </span>
  );
};
