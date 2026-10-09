import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatoPresupuesto, montoAutorizadoInicial } from '../../../utils/monedaPresupuesto';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Loader2, Search, CheckCircle, XCircle, User, Monitor, HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { GuidedTour, tourHighlightClass } from '../../shared/components/GuidedTour';
import { cancelarOrden, createOrden, getDiagnosticosListosParaOrden, getHistorialOrden, getOrdenes } from '../services/ordenesService';
import { actualizarContacto, descargarDocumentoDiagnostico, getHistorialDiagnostico, registrarRetiro } from '../services/contactoService';
import FotosServicio from '../../shared/components/FotosServicio';
import HistorialEstados from '../../shared/components/HistorialEstados';
import OrdenDirectaForm from '../components/OrdenDirectaForm';
import { useInfiniteAreaList } from '../../shared/hooks/useInfiniteAreaList';
import { prepararAprobacionOrden } from '../utils/aprobacionOrden';

const tourSteps = [
  { target: 'header', title: '1. Órdenes pendientes', text: 'Aquí aparecen diagnósticos listos que todavía no tienen una orden asociada.' },
  { target: 'search', title: '2. Buscar rápido', text: 'Filtra por cliente, equipo, falla, informe o ID antes de aprobar.' },
  { target: 'cards', title: '3. Revisar datos', text: 'Confirma equipo, cliente, informe técnico y presupuesto antes de crear la orden.' },
  { target: 'actions', title: '4. Respuesta del cliente', text: 'Descarga el informe, registra el contacto y crea la orden cuando el cliente apruebe.' },
];

const formatearTelefono = (value) => {
  const original = String(value ?? '').trim();
  const digits = original.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('505')) {
    return `+505 ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return original;
};



const NuevaOrden = () => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [ordenDirectaAbierta, setOrdenDirectaAbierta] = useState(false);
  const [filter, setFilter] = useState('');
  const [ordenSearch, setOrdenSearch] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [aprobacionPendiente, setAprobacionPendiente] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [contactoEdits, setContactoEdits] = useState({});
  const [observaciones, setObservaciones] = useState({});
  const [montos, setMontos] = useState({});
  const [historialId, setHistorialId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialOrdenId, setHistorialOrdenId] = useState(null);
  const [historialOrden, setHistorialOrden] = useState([]);
  const [historialOrdenLoading, setHistorialOrdenLoading] = useState(false);
  const [fotosOrdenId, setFotosOrdenId] = useState(null);
  const [fotosDiagnosticoId, setFotosDiagnosticoId] = useState(null);
  const [detalleOrdenId, setDetalleOrdenId] = useState(null);
  const historialRequest = useRef(0);
  const historialOrdenRequest = useRef(0);

  const diagnosticosQuery = useInfiniteAreaList({
    queryKey: ['servicio-cliente', 'nueva-orden', 'diagnosticos'],
    queryFn: getDiagnosticosListosParaOrden,
    search: filter,
    pageSize: 20,
  });
  const ordenesQuery = useInfiniteAreaList({
    queryKey: ['servicio-cliente', 'nueva-orden', 'ordenes'],
    queryFn: getOrdenes,
    search: ordenSearch,
    pageSize: 20,
  });
  const diagnosticosFiltrados = diagnosticosQuery.rows;
  const ordenes = ordenesQuery.rows;
  const summary = diagnosticosQuery.data?.pages?.[0]?.meta;

  const loadDiagnosticos = useCallback(() => queryClient.invalidateQueries({
    queryKey: ['servicio-cliente', 'nueva-orden'],
  }), [queryClient]);

  useEffect(() => {
    const handleCustomerNotification = (event) => {
      const type = event.detail?.type;
      if (['diagnostico_completado', 'diagnostico_reabierto', 'orden_creada_servicio_cliente', 'orden_creada_secretaria'].includes(type)) {
        loadDiagnosticos();
      }
    };

    window.addEventListener('servicio-cliente:notificacion', handleCustomerNotification);
    return () => window.removeEventListener('servicio-cliente:notificacion', handleCustomerNotification);
  }, [loadDiagnosticos]);

  useEffect(() => {
    if (!error) return undefined;
    const timer = window.setTimeout(() => setError(null), 12000);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activeTourTarget = showHelp ? tourSteps[tourStep].target : '';

  useEffect(() => {
    if (!showHelp || !activeTourTarget) return;
    const scrollTimer = window.setTimeout(() => {
      document
        ?.querySelector(`[data-tour-target="${activeTourTarget}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 80);

    return () => window.clearTimeout(scrollTimer);
  }, [activeTourTarget, showHelp]);

  const startTour = () => {
    setTourStep(0);
    setShowHelp(true);
  };

  const closeTour = () => {
    setShowHelp(false);
    setTourStep(0);
  };

  const handleTourNext = () => {
    if (tourStep === tourSteps.length - 1) {
      closeTour();
      return;
    }
    setTourStep((step) => step + 1);
  };

  const handleAprobar = (diagnostico) => {
    const id = diagnostico?.id_diagnostico;
    const plan = prepararAprobacionOrden(diagnostico, {
      estadoContacto: contactoEdits[id],
      observacionRespuesta: observaciones[id],
      montoAutorizado: montos[id] ?? (diagnostico ? montoAutorizadoInicial(diagnostico) : 0),
    });
    if (plan.error) { setError(plan.error); return; }
    setAprobacionPendiente({ diagnostico, plan });
  };

  const confirmarAprobacion = async () => {
    if (!aprobacionPendiente || loading) return;
    const { diagnostico, plan } = aprobacionPendiente;
    setAprobacionPendiente(null);
    try {
      setLoading(true);
      setError(null);
      setNotice(null);
      if (plan.guardarContacto) await actualizarContacto(diagnostico.id_diagnostico, plan.contacto);
      const response = await createOrden(plan.orden);
      await loadDiagnosticos();
      setNotice(`Orden #${response.data.data.id_orden} creada correctamente.`);
    } catch (err) {
      const message = err?.response?.data?.error || 'Error al generar la orden';
      if (err?.response?.status === 409 && /ya tiene una orden|ya existe una orden/i.test(message)) {
        await loadDiagnosticos().catch(() => {});
        setNotice('Este diagnóstico ya tiene una orden. Revísala en «Órdenes registradas».');
      } else setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRechazar = async (id) => {
    if (!id) {
      setError('No se puede rechazar: diagnóstico inválido.');
      return;
    }

    if (!window.confirm('¿El cliente rechazó el presupuesto?')) return;
    try {
      setError(null);
      await actualizarContacto(id, { estado_contacto: 'RECHAZADO', observacion_respuesta: observaciones[id] || '' });
      await loadDiagnosticos();
    } catch {
      setError('Error al actualizar estado');
    }
  };

  const guardarContacto = async (diag) => {
    const id = diag.id_diagnostico;
    const estado_contacto = contactoEdits[id] ?? diag.estado_contacto ?? 'PENDIENTE_CONTACTAR';
    try {
      setLoading(true);
      setError(null);
      await actualizarContacto(id, { estado_contacto, observacion_respuesta: observaciones[id] ?? diag.observacion_respuesta ?? '' });
      await loadDiagnosticos();
      setContactoEdits((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setNotice('Seguimiento del cliente guardado.');
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar el seguimiento');
    } finally { setLoading(false); }
  };

  const descargarInforme = async (id) => {
    try {
      const response = await descargarDocumentoDiagnostico(id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `diagnostico-${id}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { setError('No se pudo descargar el informe. Verifica que esté finalizado.'); }
  };

  const retirarSinReparar = async (id) => {
    const persona_recibe_retiro = window.prompt('Nombre de la persona que retira el equipo:')?.trim();
    if (!persona_recibe_retiro) return;
    try {
      setLoading(true);
      await registrarRetiro(id, { persona_recibe_retiro });
      await loadDiagnosticos();
    } catch (err) { setError(err?.response?.data?.error || 'No se pudo registrar el retiro'); }
    finally { setLoading(false); }
  };

  const cancelarOrdenActual = async (id) => {
    const motivo = window.prompt('Motivo de cancelación de la orden:')?.trim();
    if (!motivo) return;
    if (!window.confirm(`¿Cancelar la orden #${id}? Esta acción quedará en el historial.`)) return;
    try {
      setLoading(true);
      setError(null);
      await cancelarOrden(id, motivo);
      await loadDiagnosticos();
    } catch (err) { setError(err?.response?.data?.error || 'No se pudo cancelar la orden'); }
    finally { setLoading(false); }
  };

  const mostrarHistorialOrden = async (id) => {
    const request = ++historialOrdenRequest.current;
    if (historialOrdenId === id) { setHistorialOrdenId(null); setHistorialOrdenLoading(false); return; }
    setHistorialOrdenId(id);
    setHistorialOrdenLoading(true);
    try {
      const response = await getHistorialOrden(id);
      if (request === historialOrdenRequest.current) setHistorialOrden(response.data?.data || []);
    } catch { if (request === historialOrdenRequest.current) { setHistorialOrdenId(null); setError('No se pudo cargar el historial de la orden'); } }
    finally { if (request === historialOrdenRequest.current) setHistorialOrdenLoading(false); }
  };

  const mostrarHistorialDiagnostico = async (id) => {
    const request = ++historialRequest.current;
    if (historialId === id) { setHistorialId(null); setHistorialLoading(false); return; }
    setHistorialId(id);
    setHistorialLoading(true);
    try {
      const response = await getHistorialDiagnostico(id);
      if (request === historialRequest.current) setHistorial(response.data?.data || []);
    } catch { if (request === historialRequest.current) { setHistorialId(null); setError('No se pudo cargar el historial'); } }
    finally { if (request === historialRequest.current) setHistorialLoading(false); }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
  <div className="p-4 bg-gray-50 min-h-screen space-y-4">
    {showHelp && (
      <GuidedTour
        steps={tourSteps}
        stepIndex={tourStep}
        onBack={() => setTourStep((step) => Math.max(step - 1, 0))}
        onClose={closeTour}
        onNext={handleTourNext}
      />
    )}

    <Dialog open={Boolean(aprobacionPendiente)} onClose={() => setAprobacionPendiente(null)} className="relative z-[100]">
      <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xl sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CheckCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-bold text-slate-900">Confirmar aprobación</DialogTitle>
              <p className="mt-1 text-sm leading-5 text-slate-600">¿El cliente aprobó el presupuesto? Se creará la orden de reparación.</p>
            </div>
            <button type="button" onClick={() => setAprobacionPendiente(null)} aria-label="Cerrar confirmación" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p><span className="text-slate-500">Cliente:</span> <span className="font-semibold text-slate-800">{aprobacionPendiente?.diagnostico?.equipo?.cliente?.nombre}</span></p>
            <p><span className="text-slate-500">Equipo:</span> <span className="font-semibold text-slate-800">{aprobacionPendiente?.diagnostico?.equipo?.marca} {aprobacionPendiente?.diagnostico?.equipo?.modelo}</span></p>
            <p><span className="text-slate-500">Monto autorizado:</span> <span className="font-semibold text-slate-800">{formatoPresupuesto(aprobacionPendiente?.plan?.orden?.monto_autorizado)}</span></p>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" autoFocus onClick={() => setAprobacionPendiente(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Volver</button>
            <button type="button" onClick={confirmarAprobacion} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
              <CheckCircle className="h-4 w-4" />
              Confirmar y crear orden
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>

    {/* Encabezado Principal */}
     <div data-tour-target="header" className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${tourHighlightClass(activeTourTarget === 'header')}`}>
      <div className="text-left">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Generar Órdenes</h2>
        <p className="text-xs text-gray-500 font-medium mt-0.5">Diagnósticos completados esperando respuesta del cliente.</p>
      </div>

       <div className="flex items-center gap-2">
         <button type="button" onClick={() => setOrdenDirectaAbierta((value) => !value)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">{ordenDirectaAbierta ? 'Cerrar orden directa' : 'Nueva orden directa'}</button>
         <button
          type="button"
          onClick={startTour}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-all"
          title="Iniciar tutorial guiado"
        >
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <span>Ayuda</span>
        </button>
      </div>
    </div>

    {ordenDirectaAbierta && <OrdenDirectaForm onCancel={() => setOrdenDirectaAbierta(false)} onCreated={async (orden) => { setOrdenDirectaAbierta(false); await loadDiagnosticos(); setNotice(`Orden directa #${orden.id_orden} creada correctamente.`); }} />}

    {(error || diagnosticosQuery.isError || ordenesQuery.isError) && (
      <div role="alert" className="flex items-start justify-between gap-2 p-2.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold border border-red-200 text-left">
        <span>{error || 'No se pudieron cargar los diagnósticos u órdenes.'}</span>
        {error && <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" className="rounded p-0.5 hover:bg-red-200"><X size={14} /></button>}
      </div>
    )}

    {/* Buscador */}
    <div data-tour-target="search" className={`${tourHighlightClass(activeTourTarget === 'search')}`}>
      <div className="relative max-w-xl">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar cliente, equipo o diagnóstico..."
          className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-xs outline-none transition-all"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
    </div>

    {/* Contenido Principal */}
    {loading || diagnosticosQuery.isLoading ? (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin w-8 h-8 text-indigo-600" />
      </div>
    ) : (
      <div data-tour-target="cards" className={`grid grid-cols-1 gap-3 text-left ${tourHighlightClass(activeTourTarget === 'cards')}`}>
        {diagnosticosFiltrados.length === 0 ? (
          <div className="bg-white rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-xs font-bold text-gray-500">No hay diagnósticos pendientes de aprobación por el cliente.</p>
            {summary && (
              <p className="mx-auto mt-2 max-w-2xl text-[11px] font-medium leading-relaxed text-gray-400">
                Listos para nueva orden: {summary.listosParaOrden || 0}. En revisión o pendientes: {summary.enRevision || 0}.
              </p>
            )}
          </div>
        ) : (
          diagnosticosFiltrados.map((diag) => {
            const canApprove = Boolean(diag.estado_del_diagnostico !== 'RECHAZADO' && diag.equipo?.cliente?.id_cliente && diag.equipo?.id_equipo && diag.diagnostico_real && Number(diag.presupuesto_estimado || 0) > 0);
            const isExpanded = expandedId === diag.id_diagnostico;
            const textoInforme = diag.diagnostico_real || 'Sin informe detallado';
            const limiteCaracteres = 90;
            const esLargo = textoInforme.length > limiteCaracteres;

            return (
              <div key={diag.id_diagnostico} className="bg-white p-3.5 rounded-lg shadow-xs border border-gray-200 flex flex-col gap-3 overflow-hidden hover:shadow-sm transition-shadow">
                <div className="flex gap-3 items-start w-full min-w-0">
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 shrink-0 mt-0.5">
                    <Monitor className="w-5 h-5" />
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-900 break-words text-sm">{diag.equipo?.marca} {diag.equipo?.modelo}</h3>
                    
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1 min-w-0">
                        <User className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                        <span className="truncate font-medium text-gray-700">{diag.equipo?.cliente?.nombre}</span>
                      </span>
                      
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${Number(diag.presupuesto_estimado || 0) > 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700'}`}>
                        Presupuesto: {formatoPresupuesto(diag.presupuesto_estimado, diag.moneda_presupuesto)}
                      </span>
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">Teléfono: {formatearTelefono(diag.equipo?.cliente?.telefono) || 'Sin número'}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Contacto: {(diag.estado_contacto || 'PENDIENTE_CONTACTAR').replaceAll('_', ' ')}</span>
                      
                      {!canApprove && (
                        <span className="bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                          Requiere revisión
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Detalles del diagnóstico</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 border border-slate-100">Se cobran solo las piezas utilizadas</span>
                      </div>
                      
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-md bg-white p-2 border border-slate-100">
                          <span className="block text-[9px] font-bold uppercase text-slate-400">Falla reportada</span>
                          <p className="mt-0.5 text-xs leading-normal text-slate-700">{diag.falla_reportada || 'Sin detalle de falla'}</p>
                        </div>
                        
                        <div className="rounded-md bg-white p-2 border border-slate-100">
                          <span className="block text-[9px] font-bold uppercase text-slate-400">Diagnóstico técnico</span>
                          <p className="mt-0.5 text-xs leading-normal text-slate-700">
                            {isExpanded || !esLargo
                              ? textoInforme
                              : `${textoInforme.substring(0, limiteCaracteres)}...`
                            }
                          </p>
                          {esLargo && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(diag.id_diagnostico)}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 focus:outline-none transition-colors"
                            >
                              {isExpanded ? (
                                <>
                                  <span>Ver menos</span>
                                  <ChevronUp className="w-3 h-3" />
                                </>
                              ) : (
                                <>
                                  <span>Ver diagnóstico completo</span>
                                  <ChevronDown className="w-3 h-3" />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <label className="text-xs font-semibold text-slate-700">Seguimiento del cliente
                          <select value={contactoEdits[diag.id_diagnostico] ?? diag.estado_contacto ?? 'PENDIENTE_CONTACTAR'} onChange={(e) => { setContactoEdits((prev) => ({ ...prev, [diag.id_diagnostico]: e.target.value })); setError(null); }} className="mt-1 w-full rounded border p-2 text-xs">
                            <option value="PENDIENTE_CONTACTAR">Pendiente de contactar</option>
                            <option value="DOCUMENTO_ENVIADO">Documento enviado</option>
                            <option value="ESPERANDO_RESPUESTA">Esperando respuesta</option>
                            <option value="SIN_RESPUESTA">Sin respuesta</option>
                            <option value="RECHAZADO">Rechazado</option>
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-slate-700">Observación de respuesta
                          <input value={observaciones[diag.id_diagnostico] ?? diag.observacion_respuesta ?? ''} onChange={(e) => setObservaciones((prev) => ({ ...prev, [diag.id_diagnostico]: e.target.value }))} className="mt-1 w-full rounded border p-2 text-xs" />
                        </label>
                        <label className="text-xs font-semibold text-slate-700">Monto autorizado (C$)
                          <input type="number" min="0.01" step="0.01" disabled={diag.estado_del_diagnostico === 'RECHAZADO'} value={montos[diag.id_diagnostico] ?? montoAutorizadoInicial(diag)} onChange={(e) => setMontos((prev) => ({ ...prev, [diag.id_diagnostico]: e.target.value }))} className="mt-1 w-full rounded border p-2 text-xs" />
                          {diag.moneda_presupuesto === 'USD' && <span className="mt-1 block font-normal text-slate-500">Presupuesto en dólares: indica aquí el importe acordado en córdobas.</span>}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div data-tour-target="actions" className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto shrink-0 ${tourHighlightClass(activeTourTarget === 'actions')}`}>
                  <button type="button" onClick={() => descargarInforme(diag.id_diagnostico)} className="rounded border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700">Descargar diagnóstico PDF</button>
                  <button type="button" aria-expanded={fotosDiagnosticoId === diag.id_diagnostico} onClick={() => setFotosDiagnosticoId(fotosDiagnosticoId === diag.id_diagnostico ? null : diag.id_diagnostico)} className="rounded border px-3 py-1.5 text-xs">{fotosDiagnosticoId === diag.id_diagnostico ? 'Ocultar fotos' : 'Ver/agregar fotos de recepción'}</button>
                  <button type="button" onClick={() => guardarContacto(diag)} className="rounded border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700">Guardar seguimiento</button>
                  <button type="button" aria-expanded={historialId === diag.id_diagnostico} onClick={() => mostrarHistorialDiagnostico(diag.id_diagnostico)} className="rounded border px-3 py-1.5 text-xs">{historialId === diag.id_diagnostico ? 'Ocultar historial' : 'Ver historial'}</button>
                  {diag.estado_del_diagnostico === 'RECHAZADO' ? (
                    <button type="button" onClick={() => retirarSinReparar(diag.id_diagnostico)} className="rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">Registrar retiro sin reparar</button>
                  ) : <>
                  <button
                    onClick={() => handleRechazar(diag.id_diagnostico)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-semibold text-xs whitespace-nowrap"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Rechazar</span>
                  </button>
                  <button
                    onClick={() => handleAprobar(diag)}
                    disabled={!canApprove}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 shadow-xs transition-all font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
                    title={canApprove ? 'Crear orden' : 'Complete informe y presupuesto antes de aprobar'}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Aprobar y Crear Orden</span>
                  </button>
                  </>}
                </div>
                {fotosDiagnosticoId === diag.id_diagnostico && <FotosServicio kind="diagnosticos" id={diag.id_diagnostico} tipoInicial="FOTO_RECEPCION" allowedTypes={['FOTO_RECEPCION']} title="Fotos de recepción" />}
                {historialId === diag.id_diagnostico && (historialLoading ? <p role="status" className="text-xs text-slate-500">Cargando historial…</p> : <HistorialEstados rows={historial} />)}
              </div>
            );
          })
        )}
      </div>
    )}
    {notice && <div role="status" className="flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-left text-xs font-semibold text-emerald-800"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Cerrar confirmación" className="rounded p-0.5 hover:bg-emerald-100"><X size={14} /></button></div>}
    {diagnosticosQuery.hasNextPage && <div className="text-center">
      <button type="button" disabled={diagnosticosQuery.isFetchingNextPage} onClick={() => diagnosticosQuery.fetchNextPage()} className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-50">
        {diagnosticosQuery.isFetchingNextPage ? 'Cargando...' : 'Cargar 20 diagnósticos más'}
      </button>
    </div>}
    <section className="rounded-xl border bg-white p-4 text-left">
      <h3 className="text-base font-semibold text-gray-900">Órdenes registradas</h3>
      <p className="mt-1 text-xs text-gray-500">Consulte el estado y las fotos registradas; cancele con motivo cuando corresponda.</p>
      <label className="relative mt-3 block max-w-xl"><span className="sr-only">Buscar órdenes</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={ordenSearch} onChange={(event) => setOrdenSearch(event.target.value)} placeholder="Buscar orden, cliente, tipo, marca o serie..." className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
      <div className="mt-3 space-y-3">
        {ordenesQuery.isLoading ? <p className="text-sm text-gray-500">Cargando órdenes...</p> : ordenes.length === 0 && <p className="text-sm text-gray-500">No hay órdenes para esta búsqueda.</p>}
        {ordenes.map((orden) => (
          <div key={orden.id_orden} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><strong>Orden #{orden.id_orden}</strong> · {orden.diagnostico?.equipo?.cliente?.nombre || 'Cliente sin nombre'} · {orden.estado?.replaceAll('_', ' ')}</div>
              <div className="flex gap-2">
                <button type="button" aria-expanded={detalleOrdenId === orden.id_orden} onClick={() => setDetalleOrdenId(detalleOrdenId === orden.id_orden ? null : orden.id_orden)} className="rounded border px-2 py-1 text-xs">{detalleOrdenId === orden.id_orden ? 'Ocultar detalle' : 'Ver detalle'}</button>
                <button type="button" aria-expanded={fotosOrdenId === orden.id_orden} onClick={() => setFotosOrdenId(fotosOrdenId === orden.id_orden ? null : orden.id_orden)} className="rounded border px-2 py-1 text-xs">{fotosOrdenId === orden.id_orden ? 'Ocultar fotos' : 'Ver fotos'}</button>
                <button type="button" aria-expanded={historialOrdenId === orden.id_orden} onClick={() => mostrarHistorialOrden(orden.id_orden)} className="rounded border px-2 py-1 text-xs">{historialOrdenId === orden.id_orden ? 'Ocultar historial' : 'Ver historial'}</button>
                {!['CANCELADO', 'ENTREGADO'].includes(orden.estado) && !orden.facturas?.length && <button type="button" onClick={() => cancelarOrdenActual(orden.id_orden)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700">Cancelar</button>}
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">Monto autorizado: C$ {Number(orden.monto_autorizado || 0).toFixed(2)} · Técnico: {orden.tecnico?.nombre || 'Sin asignar'}</p>
            {detalleOrdenId === orden.id_orden && <div className="mt-2 rounded bg-slate-50 p-2 text-xs">
              <p>Ingreso: {orden.fecha_ingreso ? new Date(orden.fecha_ingreso).toLocaleString() : '-'} · Inicio reparación: {orden.fecha_inicio_reparacion ? new Date(orden.fecha_inicio_reparacion).toLocaleString() : '-'}</p>
              <p>Finalización: {orden.fecha_finalizacion ? new Date(orden.fecha_finalizacion).toLocaleString() : '-'} · Entrega: {orden.fecha_entrega ? new Date(orden.fecha_entrega).toLocaleString() : '-'}</p>
              {orden.motivo_cancelacion && <p className="text-red-700">Cancelación: {orden.motivo_cancelacion}</p>}
              <strong className="mt-2 block">Repuestos solicitados</strong>
              {!orden.repuestos_usados?.length && <p>No hay repuestos registrados.</p>}
              {(orden.repuestos_usados || []).map((pieza) => <div key={pieza.id_detalle_repuesto} className="mt-1 rounded border bg-white p-2">
                {pieza.pieza_solicitada || pieza.repuesto?.nombre || 'Pieza'} · {pieza.cantidad_usada || 1} · {pieza.estado_aprobacion}
                <span className="ml-2 text-slate-500">Solicitó: {pieza.tecnico_solicitante?.nombre || 'Sin registrar'} · Revisó: {pieza.usuario_aprobador?.nombre_usuario || 'Pendiente'}</span>
                {pieza.motivo_rechazo && <p className="text-red-700">Motivo de rechazo: {pieza.motivo_rechazo}</p>}
              </div>)}
            </div>}
            {fotosOrdenId === orden.id_orden && <div className="mt-2"><FotosServicio kind="ordenes" id={orden.id_orden} tipoInicial="FOTO_REPARACION" readOnly title="Fotos de la orden" /></div>}
            {historialOrdenId === orden.id_orden && <div className="mt-2">{historialOrdenLoading ? <p role="status" className="text-xs text-slate-500">Cargando historial…</p> : <HistorialEstados rows={historialOrden} />}</div>}
          </div>
        ))}
      </div>
      {ordenesQuery.hasNextPage && <div className="mt-4 text-center">
        <button type="button" disabled={ordenesQuery.isFetchingNextPage} onClick={() => ordenesQuery.fetchNextPage()} className="rounded-lg border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-50">
          {ordenesQuery.isFetchingNextPage ? 'Cargando...' : 'Cargar 20 órdenes más'}
        </button>
      </div>}
    </section>
  </div>
);
};

export default NuevaOrden;
