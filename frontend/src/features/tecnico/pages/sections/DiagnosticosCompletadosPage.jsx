import React from 'react';
import DiagnosticosTable from '../../components/DiagnosticosTable';
import SearchBox from '../../components/SearchBox';

const DiagnosticosCompletadosPage = ({ search, loading, items, onSearch, onOpenDiagnostico }) => (
  <section className="space-y-4">
    <h2 className="text-sm font-black uppercase text-slate-600 text-left">Diagnosticos completados</h2>
    <SearchBox
      value={search}
      onChange={(value) => onSearch('diagnosticosCompletados', value)}
      placeholder="Buscar por ID, equipo, falla..."
    />
    <DiagnosticosTable items={items} loading={loading} readOnly onOpenDiagnostico={onOpenDiagnostico} />
  </section>
);

export default DiagnosticosCompletadosPage;
