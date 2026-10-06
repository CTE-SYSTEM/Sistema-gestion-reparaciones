import React from 'react';
import OrdenesGrid from '../../components/OrdenesGrid';
import SearchBox from '../../components/SearchBox';

const OrdenesCompletadasPage = ({ search, loading, items, onSearch, onEstadoChange, onSolicitarPieza }) => (
  <section className="space-y-4">
    <h2 className="text-sm font-black uppercase text-slate-600 text-left">Ordenes de reparacion finalizadas</h2>
    <SearchBox
      value={search}
      onChange={(value) => onSearch('ordenesCompletadas', value)}
      placeholder="Buscar por orden, equipo..."
    />
    <OrdenesGrid items={items} loading={loading} completed onEstadoChange={onEstadoChange} onSolicitarPieza={onSolicitarPieza} />
  </section>
);

export default OrdenesCompletadasPage;
