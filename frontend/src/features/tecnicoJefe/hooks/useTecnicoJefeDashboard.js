import { useEffect, useMemo, useState } from 'react';
import { useRealtimeNotifications } from '../../../hooks/useRealtimeNotifications';
import { repuestosJefeService } from '../services/repuestosService';
import { ordenesJefeService } from '../services/ordenesService';
import { diagnosticoService } from '../services/diagnosticoService';
import {
  buildAsignacionColumns,
  buildCorreccionesColumns,
  buildIrreparablesColumns,
  buildRepuestosColumns,
} from '../components/columns';
import {
  TAB_CORRECCIONES,
  TAB_DIAGNOSTICOS,
  TAB_IRREPARABLES,
  TAB_ORDENES,
  TAB_REPUESTOS,
} from '../utils/constants';
import {
  getCorreccionId,
  getCorreccionTipo,
  getData,
  getEquipo,
  getMinutosDesdeUltimoAvance,
  getRowKey,
  getTecnicoId,
} from '../utils/helpers';

export const useTecnicoJefeDashboard = (user) => {
  const [diagnosticosPendientes, setDiagnosticosPendientes] = useState([]);
  const [ordenesAprobadas, setOrdenesAprobadas] = useState([]);
  const [repuestosPendientes, setRepuestosPendientes] = useState([]);
  const [correcciones, setCorrecciones] = useState({ diagnosticos: [], ordenes: [], repuestos: [] });
  const [repuestosCatalogo, setRepuestosCatalogo] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_DIAGNOSTICOS);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [tecnicosSeleccionados, setTecnicosSeleccionados] = useState({});
  const [asignacionError, setAsignacionError] = useState('');
  const [asignacionOk, setAsignacionOk] = useState('');
  const [repuestoDecisionError, setRepuestoDecisionError] = useState('');
  const [repuestoDecisionOk, setRepuestoDecisionOk] = useState('');
  const [irreparableDecisionError, setIrreparableDecisionError] = useState('');
  const [irreparableDecisionOk, setIrreparableDecisionOk] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState('');
  const [detalles, setDetalles] = useState(null);
  const [loadingDetalles, setLoadingDetalles] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelp] = useState(false);
  const [searchTermCorrecciones, setSearchTermCorrecciones] = useState('');

  const rolNormalizado = String(user?.rol || '').toLowerCase();
  const esJefeTecnico = rolNormalizado.includes('jefe');

  const fetchData = async () => {
    setLoading(true);
    try {
      const requests = await Promise.allSettled([
        diagnosticoService.getPendientes(),
        ordenesJefeService.getAprobadas(),
        repuestosJefeService.getPendientesAprobacion(),
        diagnosticoService.getTecnicos(),
        diagnosticoService.getCorrecciones(),
        diagnosticoService.getRepuestos(),
      ]);
      const [diagRes, ordenesRes, repuestosRes, tecRes, correccionesRes, repuestosCatalogoRes] = requests.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        console.error('Error en la carga de datos del jefe tecnico:', index, result.reason);
        return null;
      });

      setDiagnosticosPendientes(getData(diagRes));
      setOrdenesAprobadas(getData(ordenesRes));
      setRepuestosPendientes(getData(repuestosRes));
      setTecnicos(getData(tecRes));
      setCorrecciones(correccionesRes?.data?.data || { diagnosticos: [], ordenes: [], repuestos: [] });
      setRepuestosCatalogo(getData(repuestosCatalogoRes));
    } catch (error) {
      console.error('Error en la carga de datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const {
    notifications,
    connected: socketConnected,
    clearNotifications,
  } = useRealtimeNotifications({
    enabled: Boolean(user?.username) && esJefeTecnico,
    onNotification: () => setShowNotifications(true),
    onRefresh: () => fetchData(),
    refreshIntervalMs: 0,
  });

  const fetchDetalles = async (item) => {
    setLoadingDetalles(true);
    try {
      const response = item.id_orden
        ? await diagnosticoService.getOrdenById(item.id_orden)
        : await diagnosticoService.getById(item.id_diagnostico);

      setDetalles(response.data?.data);
    } catch (error) {
      console.error('Error al cargar detalles:', error);
    } finally {
      setLoadingDetalles(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedItem || selectedItem.id_detalle_repuesto) return;

    const id = selectedItem.id_diagnostico || selectedItem.id_orden;
    if (id) fetchDetalles(selectedItem);
  }, [selectedItem]);

  useEffect(() => {
    if (!asignacionError && !asignacionOk) return undefined;
    const timeoutId = window.setTimeout(() => {
      setAsignacionError('');
      setAsignacionOk('');
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [asignacionError, asignacionOk]);

  useEffect(() => {
    if (!repuestoDecisionError && !repuestoDecisionOk) return undefined;
    const timeoutId = window.setTimeout(() => {
      setRepuestoDecisionError('');
      setRepuestoDecisionOk('');
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [repuestoDecisionError, repuestoDecisionOk]);

  useEffect(() => {
    if (!irreparableDecisionError && !irreparableDecisionOk) return undefined;
    const timeoutId = window.setTimeout(() => {
      setIrreparableDecisionError('');
      setIrreparableDecisionOk('');
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [irreparableDecisionError, irreparableDecisionOk]);

  const correccionesData = useMemo(() => [
    ...(correcciones.diagnosticos || []).map((item) => ({ ...item, __tipo: 'diagnostico' })),
    ...(correcciones.ordenes || []).map((item) => ({ ...item, __tipo: 'orden' })),
    ...(correcciones.repuestos || []).map((item) => ({ ...item, __tipo: 'repuesto' })),
  ], [correcciones]);

  const esIrreparablePendiente = (row) => String(row.irreparable_estado || '').toUpperCase() === 'PENDIENTE';

  const correccionesFiltradas = useMemo(() => {
    const limiteMinutos = 60;

    return correccionesData.filter((row) => {
      if (getCorreccionTipo(row) === 'orden' && esIrreparablePendiente(row)) return false;
      if (!getTecnicoId(row)) return false;

      const minutosTranscurridos = getMinutosDesdeUltimoAvance(row);
      if (minutosTranscurridos !== null && minutosTranscurridos >= limiteMinutos) return false;
      if (!searchTermCorrecciones) return true;

      const term = searchTermCorrecciones.toLowerCase();
      const tipo = getCorreccionTipo(row);
      const id = String(getCorreccionId(row));
      const tecnicoNombre = (row.tecnico?.nombre || row.orden?.tecnico?.nombre || row.diagnostico?.tecnico?.nombre || '').toLowerCase();
      const infoEquipo = getEquipo(row);
      const equipoNombre = (infoEquipo?.descripcion || infoEquipo?.marca || '').toLowerCase();

      return id.includes(term) || tipo.toLowerCase().includes(term) || tecnicoNombre.includes(term) || equipoNombre.includes(term);
    });
  }, [correccionesData, searchTermCorrecciones]);

  const irreparablesPendientes = useMemo(() => (
    correccionesData.filter((row) => getCorreccionTipo(row) === 'orden' && esIrreparablePendiente(row))
  ), [correccionesData]);

  const irreparablesFiltrados = useMemo(() => {
    if (!searchTermCorrecciones) return irreparablesPendientes;

    const term = searchTermCorrecciones.toLowerCase();
    return irreparablesPendientes.filter((row) => {
      const id = String(row.id_orden || '');
      const tecnicoNombre = (row.tecnico?.nombre || row.diagnostico?.tecnico?.nombre || '').toLowerCase();
      const infoEquipo = getEquipo(row);
      const equipoNombre = (infoEquipo?.descripcion || infoEquipo?.marca || '').toLowerCase();
      const hallazgo = String(row.justificacion_irreparable || row.observacion_final || row.diagnostico_real || row.falla_reportada || '').toLowerCase();
      const estado = String(row.irreparable_estado || '').toLowerCase();

      return id.includes(term) || tecnicoNombre.includes(term) || equipoNombre.includes(term) || hallazgo.includes(term) || estado.includes(term);
    });
  }, [irreparablesPendientes, searchTermCorrecciones]);

  const puedeEditar = (row) => {
    if (!getTecnicoId(row)) return true;
    const minutos = getMinutosDesdeUltimoAvance(row);
    return minutos === null || minutos < 60;
  };

  const getTecnicoDisplay = (id) => {
    const tecnico = tecnicos.find((t) => String(t.id_tecnico) === String(id));
    if (!tecnico) return 'Seleccionar tecnico...';
    return `${tecnico.nombre} - ${tecnico.especialidad || 'GENERAL'}`;
  };

  const getTecnicoNombre = (id) => {
    const tecnico = tecnicos.find((t) => String(t.id_tecnico) === String(id));
    return tecnico?.nombre || 'el tecnico seleccionado';
  };

  const removeAsignacionPendiente = (row) => {
    const id = row.id_diagnostico || row.id_orden;
    if (row.id_diagnostico) {
      setDiagnosticosPendientes((prev) => prev.filter((item) => String(item.id_diagnostico) !== String(id)));
    } else {
      setOrdenesAprobadas((prev) => prev.filter((item) => String(item.id_orden) !== String(id)));
    }
  };

  const removeRepuestoPendiente = (id) => {
    setRepuestosPendientes((prev) => prev.filter((item) => String(item.id_detalle_repuesto) !== String(id)));
  };

  const removeIrreparablePendiente = (id) => {
    setCorrecciones((prev) => ({
      ...prev,
      ordenes: (prev.ordenes || []).filter((item) => String(item.id_orden) !== String(id)),
    }));
  };

  const handleTecnicoChange = (row, value) => {
    setAsignacionError('');
    setAsignacionOk('');
    setTecnicosSeleccionados((prev) => ({
      ...prev,
      [getRowKey(row)]: value,
    }));
  };

  const handleSaveAsignacion = async (row) => {
    const id = row.id_diagnostico || row.id_orden;
    const idTecnico = tecnicosSeleccionados[getRowKey(row)] || getTecnicoId(row);
    if (!id || !idTecnico || savingId) return;

    const tipo = row.id_orden ? 'orden' : 'diagnostico';
    const tecnicoNombre = getTecnicoNombre(idTecnico);
    const yaAsignado = Boolean(getTecnicoId(row));
    const mensaje = yaAsignado
      ? `Esta ${tipo} ya tiene un tecnico asignado. Deseas cambiarla a ${tecnicoNombre}?`
      : `Deseas asignar esta ${tipo} a ${tecnicoNombre}?`;

    if (!window.confirm(mensaje)) return;

    setSavingId(getRowKey(row));
    setAsignacionError('');
    setAsignacionOk('');
    try {
      if (row.id_diagnostico) {
        await diagnosticoService.asignar(row.id_diagnostico, idTecnico);
      } else {
        await ordenesJefeService.asignarOrden(row.id_orden, idTecnico);
      }

      removeAsignacionPendiente(row);
      await fetchData();
      setTecnicosSeleccionados((prev) => {
        const siguiente = { ...prev };
        delete siguiente[getRowKey(row)];
        return siguiente;
      });
      setAsignacionOk(`${tipo === 'orden' ? 'La orden' : 'El diagnostico'} #${id} quedo asignado a ${tecnicoNombre}.`);
    } catch (error) {
      console.error('Error al guardar asignacion:', error);
      setAsignacionError(
        error?.response?.data?.error
        || error?.response?.data?.details
        || 'No se pudo guardar la asignacion. Revisa el tecnico seleccionado y vuelve a intentarlo.',
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleDecisionRepuesto = async (solicitud, accion) => {
    const id = solicitud.id_detalle_repuesto;
    if (!id || savingId) return;

    const texto = accion === 'aprobar' ? 'aprobar' : 'rechazar';
    const repuesto = solicitud.repuesto?.nombre || solicitud.pieza_solicitada || 'pieza solicitada';
    const cantidad = solicitud.cantidad_usada || 1;
    if (!window.confirm(`Deseas ${texto} ${cantidad} unidad(es) de ${repuesto} para la solicitud #${id}?`)) return;
    const motivoRechazo = accion === 'rechazar' ? window.prompt('Motivo del rechazo de la pieza:')?.trim() : null;
    if (accion === 'rechazar' && !motivoRechazo) return;

    setSavingId(`repuesto-${id}`);
    setRepuestoDecisionError('');
    setRepuestoDecisionOk('');
    try {
      if (accion === 'aprobar') {
        await repuestosJefeService.aprobar(id);
      } else {
        await repuestosJefeService.rechazar(id, motivoRechazo);
      }
      removeRepuestoPendiente(id);
      await fetchData();
      setRepuestoDecisionOk(`La solicitud de repuesto #${id} fue ${accion === 'aprobar' ? 'aprobada' : 'rechazada'} correctamente.`);
    } catch (error) {
      console.error(`Error al ${texto} repuesto:`, error);
      setRepuestoDecisionError(
        error?.response?.data?.error
        || error?.response?.data?.details
        || `No se pudo ${texto} el repuesto.`,
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleDecisionIrreparable = async (orden, accion) => {
    const id = orden.id_orden;
    if (!id || savingId) return;

    const accionTexto = accion === 'aprobar' ? 'aprobar' : 'rechazar';
    const mensaje = accion === 'aprobar'
      ? `Deseas aprobar la irreparabilidad de la orden #${id}? La orden saldra de activas y pasara a completadas.`
      : `Deseas rechazar la irreparabilidad de la orden #${id}? Volvera a EN_REPARACION para que el tecnico continue.`;

    if (!window.confirm(mensaje)) return;

    setSavingId(`irreparable-${id}`);
    setIrreparableDecisionError('');
    setIrreparableDecisionOk('');

    try {
      if (accion === 'aprobar') {
        await diagnosticoService.aprobarIrreparableOrden(id);
      } else {
        await diagnosticoService.rechazarIrreparableOrden(id);
      }

      removeIrreparablePendiente(id);
      await fetchData();
      setIrreparableDecisionOk(`La orden #${id} fue ${accion === 'aprobar' ? 'aprobada como irreparable' : 'devuelta a reparacion'} correctamente.`);
    } catch (error) {
      console.error(`Error al ${accionTexto} la irreparabilidad:`, error);
      setIrreparableDecisionError(
        error?.response?.data?.error
        || error?.response?.data?.details
        || `No se pudo ${accionTexto} la irreparabilidad.`,
      );
    } finally {
      setSavingId(null);
    }
  };

  const openEditModal = (row) => {
    const tipo = getCorreccionTipo(row);
    setEditItem(row);
    setEditError('');

    if (tipo === 'diagnostico') {
      setEditForm({
        tecnico_id: getTecnicoId(row) || '',
        prioridad: row.prioridad || 'Normal',
      });
    } else if (tipo === 'orden') {
      setEditForm({
        tecnico_id: getTecnicoId(row) || '',
        prioridad: row.prioridad || row.diagnostico?.prioridad || 'Normal',
      });
    } else {
      setEditForm({
        repuesto_id: row.repuesto_id || '',
        pieza_solicitada: row.pieza_solicitada || '',
        cantidad_usada: row.cantidad_usada || 1,
        estado_aprobacion: row.estado_aprobacion || 'APROBADO',
        motivo_rechazo: row.motivo_rechazo || '',
      });
    }

    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditItem(null);
    setEditForm({});
    setEditError('');
  };

  const handleSaveCorreccion = async () => {
    if (!editItem || savingId) return;

    const tipo = getCorreccionTipo(editItem);
    const id = getCorreccionId(editItem);
    setSavingId(`correccion-${tipo}-${id}`);
    setEditError('');

    if (tipo === 'repuesto' && String(editForm.estado_aprobacion || '').toUpperCase() === 'APROBADO') {
      const tieneRepuesto = Boolean(editForm.repuesto_id || editItem.repuesto_id);
      if (!tieneRepuesto) {
        setEditError('Debe registrar la pieza en inventario antes de aprobar la solicitud.');
        setSavingId(null);
        return;
      }
    }
    if (tipo === 'repuesto' && String(editForm.estado_aprobacion || '').toUpperCase() === 'DENEGADO' && !String(editForm.motivo_rechazo || '').trim()) {
      setEditError('Indique el motivo de rechazo del repuesto.');
      setSavingId(null);
      return;
    }

    try {
      if (tipo === 'diagnostico') {
        await diagnosticoService.corregirDiagnostico(id, editForm);
      } else if (tipo === 'orden') {
        await diagnosticoService.corregirOrden(id, editForm);
      } else {
        await diagnosticoService.corregirRepuesto(id, editForm);
      }

      await fetchData();
      closeEditModal();
    } catch (error) {
      setEditError(error?.response?.data?.error || 'No se pudo guardar la correccion.');
    } finally {
      setSavingId(null);
    }
  };

  const alertasRetraso = useMemo(() => {
    const items = [...diagnosticosPendientes, ...ordenesAprobadas];
    return items.filter((item) => {
      const estado = String(item.estado_del_diagnostico || item.estado || '').toUpperCase();
      const minutos = getMinutosDesdeUltimoAvance(item);
      return minutos !== null && minutos > 4320 && !['COMPLETADO', 'FINALIZADO', 'RECHAZADO'].includes(estado);
    });
  }, [diagnosticosPendientes, ordenesAprobadas]);

  const asignacionesRecientes = useMemo(() => {
    const diagnosticos = diagnosticosPendientes.filter((d) => getTecnicoId(d) && puedeEditar(d));
    const ordenes = ordenesAprobadas.filter((o) => getTecnicoId(o) && puedeEditar(o));
    return [...diagnosticos, ...ordenes];
  }, [diagnosticosPendientes, ordenesAprobadas]);

  const asignacionColumns = useMemo(() => buildAsignacionColumns({
    tecnicos,
    savingId,
    tecnicosSeleccionados,
    puedeEditar,
    getTecnicoDisplay,
    onTecnicoChange: handleTecnicoChange,
    onSaveAsignacion: handleSaveAsignacion,
    onEdit: openEditModal,
    onView: (row) => {
      setSelectedItem(row);
      setShowModal(true);
    },
  }), [savingId, tecnicos, tecnicosSeleccionados]);

  const repuestosColumns = useMemo(() => buildRepuestosColumns({
    savingId,
    onDecisionRepuesto: handleDecisionRepuesto,
    onEdit: openEditModal,
    onViewDetalle: (row) => {
      setSelectedItem(row);
      setDetalles(row);
      setShowModal(true);
    },
  }), [savingId]);

  const irreparablesColumns = useMemo(() => buildIrreparablesColumns({
    savingId,
    onDecisionIrreparable: handleDecisionIrreparable,
    onViewDetalle: (row) => {
      setSelectedItem(row);
      setDetalles(null);
      setShowModal(true);
    },
  }), [savingId]);

  const correccionesColumns = useMemo(() => buildCorreccionesColumns({
    onEdit: openEditModal,
  }), []);

  const mainData =
    activeTab === TAB_DIAGNOSTICOS
      ? diagnosticosPendientes
      : activeTab === TAB_ORDENES
        ? ordenesAprobadas
        : activeTab === TAB_REPUESTOS
          ? repuestosPendientes
          : activeTab === TAB_IRREPARABLES
            ? irreparablesFiltrados
            : activeTab === TAB_CORRECCIONES
              ? correccionesFiltradas
              : alertasRetraso;

  const mainColumns = activeTab === TAB_REPUESTOS
    ? repuestosColumns
    : activeTab === TAB_IRREPARABLES
      ? irreparablesColumns
      : activeTab === TAB_CORRECCIONES
        ? correccionesColumns
        : asignacionColumns;

  return {
    esJefeTecnico,
    header: {
      notifications,
      socketConnected,
      showNotifications,
      toggleNotifications: () => setShowNotifications((value) => !value),
      clearNotifications: () => {
        clearNotifications();
        setShowNotifications(false);
      },
      closeNotifications: () => setShowNotifications(false),
    },
    layout: {
      showHelp,
      activeTab,
      setActiveTab,
      loading,
      searchTermCorrecciones,
      setSearchTermCorrecciones,
      mainColumns,
      mainData,
    },
    data: {
      diagnosticosPendientes,
      ordenesAprobadas,
      repuestosPendientes,
      alertasRetraso,
      asignacionesRecientes,
      asignacionColumns,
      correccionesFiltradas,
      irreparablesFiltrados,
    },
    messages: {
      asignacionError,
      asignacionOk,
      repuestoDecisionError,
      repuestoDecisionOk,
      irreparableDecisionError,
      irreparableDecisionOk,
      dismissAsignacion: () => {
        setAsignacionError('');
        setAsignacionOk('');
      },
      dismissRepuesto: () => {
        setRepuestoDecisionError('');
        setRepuestoDecisionOk('');
      },
      dismissIrreparable: () => {
        setIrreparableDecisionError('');
        setIrreparableDecisionOk('');
      },
    },
    modals: {
      showModal,
      detalles,
      loadingDetalles,
      closeDetail: () => {
        setShowModal(false);
        setDetalles(null);
        setSelectedItem(null);
      },
      showEditModal,
      editItem,
      editForm,
      editError,
      tecnicos,
      repuestosCatalogo,
      savingId,
      closeEdit: closeEditModal,
      changeEditField: (field, value) => setEditForm((prev) => ({ ...prev, [field]: value })),
      saveCorreccion: handleSaveCorreccion,
    },
  };
};

export default useTecnicoJefeDashboard;
