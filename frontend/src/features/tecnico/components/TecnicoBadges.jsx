import React from 'react';

export const estadosDiagnosticoCompletado = ['COMPLETADO', 'DIAGNOSTICADO', 'APROBADO', 'RECHAZADO'];
export const estadosOrdenCerrada = ['FINALIZADO', 'IRREPARABLE', 'ENTREGADO', 'CANCELADO'];

export const PrioridadBadge = ({ prioridad }) => {
  const key = String(prioridad || '').toUpperCase();
  const styles = {
    URGENTE: 'bg-red-100 text-red-700 border-red-200',
    ALTA: 'bg-orange-100 text-orange-700 border-orange-200',
    MEDIA: 'bg-blue-100 text-blue-700 border-blue-200',
    NORMAL: 'bg-blue-100 text-blue-700 border-blue-200',
    BAJA: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${styles[key] || styles.BAJA}`}>
      {prioridad || 'NORMAL'}
    </span>
  );
};

export const EstadoBadge = ({ estado }) => {
  const key = String(estado || '').toUpperCase();
  const styles = {
    PENDIENTE: 'bg-gray-100 text-gray-700 border-gray-200',
    ASIGNADO: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    EN_REVISION: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    EN_REPARACION: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    ESPERANDO_REPUESTO: 'bg-amber-100 text-amber-800 border-amber-200',
    ESPERANDO_PIEZA: 'bg-amber-100 text-amber-800 border-amber-200',
    FINALIZADO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    ENTREGADO: 'bg-slate-100 text-slate-800 border-slate-200',
    IRREPARABLE: 'bg-red-100 text-red-800 border-red-200',
    REVISION_JEFE: 'bg-amber-100 text-amber-800 border-amber-200',
    COMPLETADO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    DIAGNOSTICADO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    APROBADO: 'bg-green-100 text-green-800 border-green-200',
    RECHAZADO: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${styles[key] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
      {key === 'REVISION_JEFE' ? 'Revisión del jefe' : key || 'PENDIENTE'}
    </span>
  );
};

export const EstadoSolicitudBadge = ({ estado }) => {
  const key = String(estado || '').toUpperCase();
  const styles = {
    PENDIENTE: 'bg-yellow-100 text-yellow-800',
    APROBADO: 'bg-green-100 text-green-800',
    DENEGADO: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${styles[key] || 'bg-gray-100 text-gray-800'}`}>
      {key || 'PENDIENTE'}
    </span>
  );
};
