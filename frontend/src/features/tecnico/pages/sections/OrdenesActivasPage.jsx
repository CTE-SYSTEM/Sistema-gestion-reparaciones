import React from 'react';
import OrdenesGrid from '../../components/OrdenesGrid';
import SearchBox from '../../components/SearchBox';

const OrdenesActivasPage = ({ search, loading, items, onSearch, onEstadoChange, onSolicitarPieza }) => (
  <section className="space-y-4">
    <h2 className="text-sm font-black uppercase text-slate-600 text-left">Ordenes de reparacion activas</h2>
    <SearchBox
      value={search}
      onChange={(value) => onSearch('ordenesActivas', value)}
      placeholder="Buscar por orden, equipo..."
    />
    <OrdenesGrid items={items} loading={loading} onEstadoChange={onEstadoChange} onSolicitarPieza={onSolicitarPieza} />
  </section>
);

export default OrdenesActivasPage;
