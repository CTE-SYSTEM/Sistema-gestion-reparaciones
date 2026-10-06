import React from 'react';
import DiagnosticosActivosPage from './DiagnosticosActivosPage';
import DiagnosticosCompletadosPage from './DiagnosticosCompletadosPage';
import OrdenesActivasPage from './OrdenesActivasPage';
import OrdenesCompletadasPage from './OrdenesCompletadasPage';
import RepuestosTecnicoPage from './RepuestosTecnicoPage';

const TecnicoSectionRouter = ({
  activeTab,
  searches,
  loading,
  diagnosticosEnRevision,
  diagnosticosCompletados,
  ordenesActivas,
  ordenesCompletadas,
  solicitudesRepuestos,
  onSearch,
  onOpenDiagnostico,
  onIniciarDiagnostico,
  onEstadoChange,
  onSolicitarPieza,
}) => {
  if (activeTab === 'diagnosticos_completados') {
    return (
      <DiagnosticosCompletadosPage
        search={searches.diagnosticosCompletados}
        loading={loading}
        items={diagnosticosCompletados}
        onSearch={onSearch}
        onOpenDiagnostico={onOpenDiagnostico}
      />
    );
  }

  if (activeTab === 'ordenes') {
    return (
      <OrdenesActivasPage
        search={searches.ordenesActivas}
        loading={loading}
        items={ordenesActivas}
        onSearch={onSearch}
        onEstadoChange={onEstadoChange}
        onSolicitarPieza={onSolicitarPieza}
      />
    );
  }

  if (activeTab === 'ordenes_completadas') {
    return (
      <OrdenesCompletadasPage
        search={searches.ordenesCompletadas}
        loading={loading}
        items={ordenesCompletadas}
        onSearch={onSearch}
        onEstadoChange={onEstadoChange}
        onSolicitarPieza={onSolicitarPieza}
      />
    );
  }

  if (activeTab === 'repuestos') {
    return (
      <RepuestosTecnicoPage
        search={searches.repuestos}
        loading={loading}
        solicitudes={solicitudesRepuestos}
        onSearch={onSearch}
      />
    );
  }

  return (
    <DiagnosticosActivosPage
      search={searches.diagnosticosEnRevision}
      loading={loading}
      items={diagnosticosEnRevision}
      onSearch={onSearch}
      onOpenDiagnostico={onOpenDiagnostico}
      onIniciarDiagnostico={onIniciarDiagnostico}
    />
  );
};

export default TecnicoSectionRouter;
