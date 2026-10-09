// frontend/src/features/secretaria/pages/Diagnostico.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, CheckCircle2, HelpCircle, LayoutList, Plus, X } from 'lucide-react';
import { DiagnosticoForm } from '../components/Diagnostico/DiagnosticoForm';
import { DiagnosticosTable } from '../components/Diagnostico/DiagnosticosTable';
import { GuidedTour, initialFormState, tourHighlightClass, tourSteps } from '../components/Diagnostico/constants';
import { normalizeDiagnosticos, sortClientesByName } from '../components/Diagnostico/helpers';
import { EstadoBadge, PrioridadBadge } from '../components/Diagnostico/badges';
import { getClientes } from '../services/clientesService';
import { getEquipos } from '../services/equiposService';
import { createDiagnostico, getDiagnosticos, updateDiagnostico } from '../services/diagnosticoService';
import { useInfiniteAreaList } from '../../shared/hooks/useInfiniteAreaList';
import { subirFotoServicio } from '../../shared/services/archivosServicioService';
import FotosServicio from '../../shared/components/FotosServicio';
import { getHistorialDiagnostico } from '../services/diagnosticoService';
import HistorialEstados from '../../shared/components/HistorialEstados';
import { accessAppliesToType, chargerAppliesToType } from '../components/Diagnostico/receptionRequirements';
import { usePhotoQueue } from '../../shared/hooks/usePhotoQueue';
import FotosPendientes from '../../shared/components/FotosPendientes';

export { EstadoBadge, PrioridadBadge };

const receptionFields = [
  'deja_cargador', 'enciende', 'usa_corriente_ac', 'estado_cargador',
  'estado_accesorios', 'estado_fisico', 'estado_encendido',
  'estado_alimentacion', 'estado_acceso', 'detalle_accesorios',
  'observaciones_recepcion',
];

const resetReception = (form) => {
  for (const field of receptionFields) form[field] = initialFormState[field];
};

const Diagnostico = () => {
  const location = useLocation();
  const formRef = useRef(null);
  const photoSectionRef = useRef(null);
  const photoSummaryRef = useRef(null);
  const submittingRef = useRef(false);
  const [clientes, setClientes] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTecnico, setFilterTecnico] = useState('TODOS');
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const photoQueue = usePhotoQueue();
  const [savedPhotoDiagnosisId, setSavedPhotoDiagnosisId] = useState(null);
  const [photoReceiptContext, setPhotoReceiptContext] = useState('');
  const [selectedPhotosId, setSelectedPhotosId] = useState(null);
  const [photosVersion, setPhotosVersion] = useState(0);
  const [historial, setHistorial] = useState([]);
  const [historialId, setHistorialId] = useState(null);
  const [detalleRecepcion, setDetalleRecepcion] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  // Mantener el formulario oculto al entrar; se abre automáticamente
  // cuando la navegación trae un cliente o equipo preseleccionado.
  const [isFormOpen, setIsFormOpen] = useState(Boolean(location.state?.clienteId || location.state?.equipoId));

  const preselectedClienteId = location.state?.clienteId ? String(location.state.clienteId) : '';
  const preselectedEquipoId = location.state?.equipoId ? String(location.state.equipoId) : '';
  const activeTourTarget = showHelp ? tourSteps[tourStep].target : '';
  const diagnosticosQuery = useInfiniteAreaList({
    queryKey: ['recepcion', 'diagnosticos'],
    queryFn: getDiagnosticos,
    search: searchTerm,
    extraParams: { filterTecnico },
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resC, resE] = await Promise.all([
        getClientes({ page: 1, pageSize: 100 }),
        getEquipos({ page: 1, pageSize: 100 }),
      ]);
      const clientesData = sortClientesByName(resC.data.data || []);
      const equiposData = resE.data.data || [];

      setClientes(clientesData);
      setEquipos(equiposData);
    } catch {
      setError('Error al sincronizar datos con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!showHelp || !activeTourTarget) return;
    const scrollTimer = window.setTimeout(() => {
      document.querySelector(`[data-tour-target="${activeTourTarget}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 80);

    return () => window.clearTimeout(scrollTimer);
  }, [activeTourTarget, showHelp]);

  useEffect(() => {
    if (!preselectedClienteId && !preselectedEquipoId) return;

    setFormData((prev) => ({
      ...prev,
      cliente_id: preselectedClienteId || prev.cliente_id,
      equipo_id: preselectedEquipoId || prev.equipo_id,
    }));
    window.history.replaceState({}, document.title);
  }, [preselectedClienteId, preselectedEquipoId]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!selectedPhotosId) return;
    window.requestAnimationFrame(() => photoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [selectedPhotosId, photosVersion]);

  useEffect(() => {
    if (!isFormOpen && savedPhotoDiagnosisId) {
      window.requestAnimationFrame(() => photoSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [isFormOpen, savedPhotoDiagnosisId]);

  const clienteSeleccionado = clientes.find((cliente) => String(cliente.id_cliente) === String(formData.cliente_id));
  const equiposDelCliente = formData.cliente_id ? equipos.filter((equipo) => Number(equipo.cliente_id) === Number(formData.cliente_id)) : [];
  const equipoSeleccionado = equipos.find((equipo) => String(equipo.id_equipo) === String(formData.equipo_id));
  const photoContextLabel = equipoSeleccionado
    ? `${[equipoSeleccionado.tipo, equipoSeleccionado.marca, equipoSeleccionado.modelo].filter(Boolean).join(' ')} · Equipo #${equipoSeleccionado.id_equipo}${equipoSeleccionado.numero_serie ? ` · S/N: ${equipoSeleccionado.numero_serie}` : ''}`
    : '';
  const diagnosticos = useMemo(
    () => normalizeDiagnosticos(diagnosticosQuery.rows, equipos, clientes),
    [diagnosticosQuery.rows, equipos, clientes],
  );
  const filteredDiagnosticos = diagnosticos;

  const closeTour = () => {
    setShowHelp(false);
    setTourStep(0);
  };

  const startTour = () => {
    if (loading || photoQueue.isBusy) return;
    setTourStep(0);
    setShowHelp(true);
    setIsFormOpen(true);
  };

  const openNewForm = () => {
    if (loading || photoQueue.isBusy) return;
    photoQueue.clearPhotos();
    setSavedPhotoDiagnosisId(null);
    setPhotoReceiptContext('');
    setDetalleRecepcion(null);
    setIsEditing(false);
    setCurrentId(null);
    setFormData({
      ...initialFormState,
      cliente_id: preselectedClienteId,
      equipo_id: preselectedEquipoId,
    });
    setIsFormOpen(true);
  };

  const handleChange = ({ target }) => {
    if (loading || photoQueue.isBusy || (savedPhotoDiagnosisId && isFormOpen)) return;
    const { name, value, type, checked } = target;
    if (['cliente_id', 'equipo_id'].includes(name) && String(value) !== String(formData[name]) && photoQueue.photos.length) {
      photoQueue.clearPhotos();
      setMessage('La selección de fotos se limpió al cambiar el cliente o equipo. Agregue las fotos del equipo seleccionado.');
    }
    setFormData((prev) => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'estado_cargador') next.deja_cargador = value === 'ENTREGADO';
      if (name === 'cliente_id') {
        next.equipo_id = '';
        resetReception(next);
      }
      if (name === 'equipo_id') {
        const equipoNuevo = equipos.find((item) => String(item.id_equipo) === String(value));
        resetReception(next);
        if (!equipoNuevo || !chargerAppliesToType(equipoNuevo.tipo)) {
          next.estado_cargador = equipoNuevo ? 'NO_INCLUIDO' : initialFormState.estado_cargador;
          next.deja_cargador = false;
        }
        if (!equipoNuevo || !accessAppliesToType(equipoNuevo.tipo)) {
          next.estado_acceso = equipoNuevo ? 'NO_REQUIERE' : initialFormState.estado_acceso;
        }
      }
      return next;
    });
  };

  const resetForm = ({ keepPhotos = false } = {}) => {
    if (!keepPhotos) {
      photoQueue.clearPhotos();
      setSavedPhotoDiagnosisId(null);
      setPhotoReceiptContext('');
    }
    setIsEditing(false);
    setCurrentId(null);
    setFormData(initialFormState);
    setIsFormOpen(false);
    setDetalleRecepcion(null);
  };

  const cancelEdit = () => {
    if (loading || photoQueue.isBusy) return;
    if (savedPhotoDiagnosisId) setMessage(`El diagnóstico #${savedPhotoDiagnosisId} permanece guardado. Se cerró la selección de fotos pendientes.`);
    resetForm();
  };

  const handleEdit = (diag) => {
    if (loading || photoQueue.isBusy) return;
    if (diag.tecnico_id || diag.id_tecnico) {
      window.alert('No se puede editar este registro porque ya cuenta con un tecnico asignado.');
      return;
    }

    photoQueue.clearPhotos();
    setSavedPhotoDiagnosisId(null);
    setPhotoReceiptContext('');
    setDetalleRecepcion(null);
    setIsEditing(true);
    setIsFormOpen(true);
    setCurrentId(diag.id_diagnostico);
    setFormData({
      cliente_id: String(diag.equipo?.cliente_id || diag.equipo?.cliente?.id_cliente || ''),
      equipo_id: String(diag.equipo_id || diag.equipo?.id_equipo || ''),
      falla_reportada: diag.falla_reportada || '',
      prioridad: diag.prioridad || 'Normal',
      estado: diag.estado_del_diagnostico || diag.estado || 'INGRESADO',
      deja_cargador: Boolean(diag.deja_cargador),
      enciende: Boolean(diag.enciende),
      usa_corriente_ac: Boolean(diag.usa_corriente_ac),
      estado_cargador: diag.estado_cargador || 'NO_VERIFICADO',
      estado_accesorios: diag.estado_accesorios || 'NO_VERIFICADOS',
      estado_fisico: diag.estado_fisico || 'NO_VERIFICADO',
      estado_encendido: diag.estado_encendido || 'NO_PROBADO',
      estado_alimentacion: diag.estado_alimentacion || 'NO_PROBADA',
      estado_acceso: diag.estado_acceso || 'NO_VERIFICADO',
      detalle_accesorios: diag.detalle_accesorios || '',
      observaciones_recepcion: diag.observaciones_recepcion || '',
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current || photoQueue.isBusy) return;
    if (!savedPhotoDiagnosisId && !formData.falla_reportada.trim()) {
      const msg = 'Debe escribir la falla reportada antes de guardar el diagnostico.';
      setError(msg);
      window.alert(msg);
      return;
    }

    const selectedEquipment = equipos.find((item) => String(item.id_equipo) === String(formData.equipo_id));
    const payload = { ...formData };
    if (selectedEquipment && !chargerAppliesToType(selectedEquipment.tipo)) {
      payload.estado_cargador = 'NO_INCLUIDO';
      payload.deja_cargador = false;
    }
    if (selectedEquipment && !accessAppliesToType(selectedEquipment.tipo)) payload.estado_acceso = 'NO_REQUIERE';
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    setMessage(null);
    let savedId = savedPhotoDiagnosisId || currentId;
    let diagnosisSaved = false;
    const resultLabel = savedPhotoDiagnosisId ? `Diagnóstico #${savedPhotoDiagnosisId}` : isEditing ? `Recepción del diagnóstico #${currentId} modificada` : 'Diagnóstico de ingreso generado';
    try {
      if (!savedPhotoDiagnosisId) {
        if (isEditing) {
          await updateDiagnostico(currentId, payload);
        } else {
          const response = await createDiagnostico(payload);
          savedId = response.data.data.id_diagnostico;
          setCurrentId(savedId);
          setIsEditing(true);
        }
      }
      diagnosisSaved = true;
      if (photoQueue.photos.length) {
        setSavedPhotoDiagnosisId(savedId);
        setPhotoReceiptContext(photoContextLabel);
        const result = await photoQueue.uploadPhotos((photo, onProgress) =>
          subirFotoServicio('diagnosticos', savedId, 'FOTO_RECEPCION', photo.file, { onProgress }));
        if (result.uploaded.length) setPhotosVersion((version) => version + 1);
        if (result.failed.length) {
          setError(`El diagnóstico #${savedId} está guardado. ${result.totalUploaded} de ${result.totalPhotos} fotos guardadas; ${result.failed.length} no se pudieron subir. Revise cada foto marcada y reintente las pendientes.`);
          await diagnosticosQuery.refetch().catch(() => {});
          return;
        }
        setMessage(`${resultLabel}; ${result.totalUploaded} foto${result.totalUploaded === 1 ? '' : 's'} guardada${result.totalUploaded === 1 ? '' : 's'}.`);
        resetForm({ keepPhotos: true });
      } else {
        setMessage(`${resultLabel} correctamente.`);
        resetForm();
      }
      await diagnosticosQuery.refetch();
    } catch (err) {
      const reason = err?.response?.data?.error || err?.message || 'No se pudo procesar la solicitud';
      setError(diagnosisSaved ? `El diagnóstico #${savedId} está guardado. ${reason}` : reason);
      if (diagnosisSaved) await diagnosticosQuery.refetch().catch(() => {});
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
  <div className="p-4 bg-gray-50 min-h-screen space-y-4">
    {showHelp && (
      <GuidedTour
        stepIndex={tourStep}
        onBack={() => setTourStep((step) => Math.max(step - 1, 0))}
        onClose={closeTour}
        onNext={() => (tourStep === tourSteps.length - 1 ? closeTour() : setTourStep((step) => step + 1))}
      />
    )}

    {/* Encabezado Principal */}
    <div data-tour-target="header" className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${tourHighlightClass(activeTourTarget === 'header')}`}>
      <div className="text-left">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Diagnóstico de Ingreso</h2>
        <p className="text-xs text-gray-500 font-medium mt-0.5">Gestión de recepción y revisión técnica inicial.</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={startTour}
          disabled={loading || photoQueue.isBusy}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-all"
          title="Iniciar tutorial guiado"
        >
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <span>Ayuda</span>
        </button>
        <button
          type="button"
          onClick={openNewForm}
          disabled={loading || photoQueue.isBusy}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          <span>Nuevo diagnóstico</span>
        </button>
        <LayoutList className="w-6 h-6 text-indigo-300" />
      </div>
    </div>

    {error && (
      <div className="p-2.5 bg-red-100 text-red-700 rounded-lg flex items-center gap-2 text-xs font-semibold border border-red-200 text-left">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{error}</span>
      </div>
    )}

    {message && (
      <div role="status" className="fixed right-4 top-20 z-50 flex max-w-md items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-left text-sm font-semibold text-emerald-800 shadow-lg animate-in fade-in slide-in-from-top-2">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>{message}</span>
      </div>
    )}

    {/* Formulario de Diagnóstico */}
    {isFormOpen && (
      <DiagnosticoForm
        activeTourTarget={activeTourTarget}
        clienteSeleccionado={clienteSeleccionado}
        clientes={clientes}
        currentId={currentId}
        equipoSeleccionado={equipoSeleccionado}
        equiposDelCliente={equiposDelCliente}
        formData={formData}
        formRef={formRef}
        isEditing={isEditing}
        loading={loading || diagnosticosQuery.isLoading}
        onCancelEdit={cancelEdit}
        onChange={handleChange}
        onSubmit={handleSubmit}
        photoQueue={photoQueue}
        savedPhotoDiagnosisId={savedPhotoDiagnosisId}
        photoContextLabel={photoContextLabel}
      />
    )}

    {!isFormOpen && savedPhotoDiagnosisId && photoQueue.photos.length > 0 && <div ref={photoSummaryRef} className="space-y-2 scroll-mt-6">
      <FotosPendientes photos={photoQueue.photos} readOnly title={`Fotos guardadas del diagnóstico #${savedPhotoDiagnosisId}`} contextLabel={photoReceiptContext} />
      <div className="flex justify-end gap-3 text-xs">
        <button type="button" onClick={() => setSelectedPhotosId(savedPhotoDiagnosisId)} className="font-medium text-indigo-700 underline">Ver todas las fotos del registro</button>
        <button type="button" onClick={() => { photoQueue.clearPhotos(); setSavedPhotoDiagnosisId(null); setPhotoReceiptContext(''); }} className="text-slate-600 underline">Cerrar resumen</button>
      </div>
    </div>}

    {/* Tabla de Diagnósticos */}
    <DiagnosticosTable
      activeTourTarget={activeTourTarget}
      diagnosticos={filteredDiagnosticos}
      filterTecnico={filterTecnico}
      loading={loading}
      onEdit={handleEdit}
      onPhotos={(id) => setSelectedPhotosId(selectedPhotosId === id ? null : id)}
      onHistory={async (id) => {
        try {
          const response = await getHistorialDiagnostico(id);
          setHistorial(response.data.data || []);
          setHistorialId(id);
        } catch { setError('No se pudo cargar el historial'); }
      }}
      onDetails={(diag) => setDetalleRecepcion(detalleRecepcion?.id_diagnostico === diag.id_diagnostico ? null : diag)}
      onFilterChange={setFilterTecnico}
      onSearchChange={setSearchTerm}
      searchTerm={searchTerm}
      onLoadMore={() => diagnosticosQuery.fetchNextPage()}
      hasMore={diagnosticosQuery.hasNextPage}
      isLoadingMore={diagnosticosQuery.isFetchingNextPage}
    />
    {detalleRecepcion && <section className="rounded-xl border bg-white p-4 text-left text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">Recepción del diagnóstico #{detalleRecepcion.id_diagnostico} · {detalleRecepcion.equipo?.tipo || 'Equipo'}</h3>
        <button
          type="button"
          onClick={() => setDetalleRecepcion(null)}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          aria-label="Cerrar detalles de recepción"
          title="Cerrar detalles de recepción"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Cargador', detalleRecepcion.estado_cargador, 'charger'],
          ['Accesorios', detalleRecepcion.estado_accesorios],
          ['Estado físico', detalleRecepcion.estado_fisico],
          ['Encendido', detalleRecepcion.estado_encendido],
          ['Alimentación eléctrica', detalleRecepcion.estado_alimentacion],
          ['Acceso para pruebas', detalleRecepcion.estado_acceso, 'access'],
        ].filter(([, value, capability]) => {
          if (capability === 'charger' && !chargerAppliesToType(detalleRecepcion.equipo?.tipo)) return value && value !== 'NO_INCLUIDO';
          if (capability === 'access' && !accessAppliesToType(detalleRecepcion.equipo?.tipo)) return value && value !== 'NO_REQUIERE';
          return true;
        }).map(([label, value, capability]) => {
          const legacy = (capability === 'charger' && !chargerAppliesToType(detalleRecepcion.equipo?.tipo))
            || (capability === 'access' && !accessAppliesToType(detalleRecepcion.equipo?.tipo));
          return <div key={label} className="rounded bg-slate-50 p-2"><strong>{label}{legacy ? ' (registro anterior)' : ''}:</strong> {value?.replaceAll('_', ' ').toLowerCase() || 'Sin registrar'}</div>;
        })}
      </div>
      <p className="mt-2"><strong>Detalle de accesorios:</strong> {detalleRecepcion.detalle_accesorios || 'Sin observaciones'}</p>
      <p className="mt-1"><strong>Observaciones de recepción:</strong> {detalleRecepcion.observaciones_recepcion || 'Sin observaciones'}</p>
      <p className="mt-1"><strong>Estado físico del equipo:</strong> {detalleRecepcion.estado_equipo?.replaceAll('_', ' ') || 'EN_TALLER'}</p>
    </section>}
    {selectedPhotosId && <div ref={photoSectionRef} className="scroll-mt-6"><FotosServicio key={`${selectedPhotosId}-${photosVersion}`} kind="diagnosticos" id={selectedPhotosId} /></div>}
    {historialId && <HistorialEstados rows={historial} />}
  </div>
);
};

export default Diagnostico;
