import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';

const pruebasLegibles = (values, prefix = '') =>
  Object.entries(values || {}).flatMap(([key, value]) => {
    const label = `${prefix}${key.replaceAll('_', ' ')}`;
    return value && typeof value === 'object'
      ? pruebasLegibles(value, `${label}: `)
      : [
          [
            label,
            typeof value === 'boolean'
              ? value
                ? 'Sí'
                : 'No'
              : value == null
                ? 'Sin registrar'
                : String(value).replaceAll('_', ' '),
          ],
        ];
  });

const blank = { encendido: '', funcion_general: '', observacion: '', parte: '' };
const canReviewOrder = (orden) =>
  orden.estado === 'FINALIZADO' &&
  ['PENDIENTE', 'NO_REQUERIDO'].includes(orden.calidad_estado) &&
  !orden.facturas?.length;

export default function CalidadPage() {
  const [ordenes, setOrdenes] = useState([]);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [tab, setTab] = useState('pendientes');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({});
  const [summary, setSummary] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fetchData = useCallback(() => {
    const params = { vista: tab, search, page, pageSize: 10 };
    return Promise.all([
      api.get('/calidad/ordenes', { params }),
      api.get('/calidad/diagnosticos', { params }),
      api.get('/calidad/resumen'),
    ]);
  }, [tab, search, page]);
  const applyData = ([orders, diagnoses, totals]) => {
    setOrdenes(orders.data.data || []);
    setDiagnosticos(diagnoses.data.data || []);
    const orderTotal = orders.data.meta?.total || 0;
    const diagnosisTotal = diagnoses.data.meta?.total || 0;
    setMeta({ orderTotal, diagnosisTotal, pages: Math.max(1, Math.ceil(Math.max(orderTotal, diagnosisTotal) / 10)), hasNextPage: orders.data.meta?.hasNextPage || diagnoses.data.meta?.hasNextPage });
    setSummary(totals.data.data || {});
  };
  const load = async () => applyData(await fetchData());
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setExpandedId(null);
    const timer = setTimeout(
      () =>
        fetchData()
          .then((data) => {
            if (active) applyData(data);
          })
          .catch(() => {
            if (active) setError('No se pudieron cargar las pruebas de salida.');
          })
          .finally(() => {
            if (active) setLoading(false);
          }),
      250,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchData]);
  const setDraft = (id, field, value) =>
    setDrafts((old) => ({ ...old, [id]: { ...(old[id] || blank), [field]: value } }));
  const review = async (id, decision) => {
    const draft = drafts[id] || blank;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.post(`/calidad/ordenes/${id}/revision`, {
        decision,
        observacion: draft.observacion,
        pruebas: {
          encendido: draft.encendido,
          funcion_general: draft.funcion_general,
          parte: draft.parte,
        },
      });
      await load();
      setExpandedId(null);
      setMessage(
        decision === 'APROBADO' ? `Orden #${id} aprobada.` : `Orden #${id} devuelta al taller.`,
      );
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la revisión.');
    } finally {
      setBusy(false);
    }
  };
  const reviewDiagnosis = async (id, decision) => {
    const draft = drafts[`d-${id}`] || blank;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.post(`/calidad/diagnosticos/${id}/revision`, {
        decision,
        observacion: draft.observacion,
        parte: draft.parte,
      });
      await load();
      setExpandedId(null);
      setMessage(
        decision === 'SIN_ERRORES'
          ? `Diagnóstico #${id} revisado sin errores.`
          : `Error del diagnóstico #${id} registrado y comunicado al técnico.`,
      );
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la revisión.');
    } finally {
      setBusy(false);
    }
  };
  const pendingOrders = ordenes.filter(canReviewOrder);
  const pendingDiagnoses = diagnosticos.filter(
    (diagnostico) => diagnostico.calidad_estado === 'PENDIENTE',
  );
  const visibleOrders = loading ? [] : tab === 'pendientes' ? pendingOrders : ordenes;
  const visibleDiagnoses = loading ? [] : tab === 'pendientes' ? pendingDiagnoses : diagnosticos;
  return (
    <section className="mx-auto max-w-6xl space-y-5 p-4">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
          Revisión técnica
        </p>
        <h1 className="m-0 mt-1 text-2xl font-bold text-slate-900">Control de calidad</h1>
        <p className="mt-1 text-sm text-slate-500">
          Revise diagnósticos y reparaciones antes de enviarlos a Servicio al Cliente o facturación.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-3xl font-black">{summary.diagnosticos_pendientes ?? 0}</p>
          <p className="text-sm text-slate-600">Diagnósticos pendientes</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-3xl font-black">{summary.ordenes_pendientes ?? 0}</p>
          <p className="text-sm text-slate-600">Órdenes pendientes</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-3xl font-black">{summary.revisados ?? 0}</p>
          <p className="text-sm text-slate-600">Servicios con revisión</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={tab === 'pendientes'}
          onClick={() => {
            setTab('pendientes');
            setPage(1);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'pendientes' ? 'bg-indigo-600 text-white' : 'border bg-white'}`}
        >
          Pendientes
        </button>
        <button
          type="button"
          aria-pressed={tab === 'historial'}
          onClick={() => {
            setTab('historial');
            setPage(1);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'historial' ? 'bg-indigo-600 text-white' : 'border bg-white'}`}
        >
          Historial de revisiones
        </button>
      </div>
      {message && (
        <p role="status" className="rounded bg-green-50 p-3 text-green-800">
          {message}
        </p>
      )}
      <label className="block rounded-2xl border bg-white p-4 text-sm font-semibold">
        Buscar orden, diagnóstico, cliente, equipo o serie
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Escriba nombre, equipo o número…"
          className="mt-2 block w-full rounded-lg border p-2 font-normal"
        />
      </label>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {loading && <p>Cargando órdenes…</p>}
      {!loading && !visibleOrders.length && !visibleDiagnoses.length && (
        <p>No hay servicios para esta vista.</p>
      )}
      <h2 className="text-lg font-bold">{tab === 'pendientes' ? 'Diagnósticos por revisar' : 'Diagnósticos revisados'} · {meta.diagnosisTotal || 0}</h2>
      <div className="grid gap-4">
        {visibleDiagnoses.map((diagnostico) => {
          const draft = drafts[`d-${diagnostico.id_diagnostico}`] || blank;
          const review = diagnostico.intervenciones?.[0];
          const equipo = diagnostico.equipo;
          return (
            <article
              key={`d-${diagnostico.id_diagnostico}`}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-bold">
                  Diagnóstico #{diagnostico.id_diagnostico} · {equipo?.cliente?.nombre || 'Cliente'}
                </h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${diagnostico.calidad_estado === 'RECHAZADO' ? 'bg-red-100 text-red-800' : diagnostico.calidad_estado === 'APROBADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                >
                  {diagnostico.calidad_estado === 'RECHAZADO'
                    ? 'Devuelto'
                    : diagnostico.calidad_estado === 'APROBADO'
                      ? 'Aprobado'
                      : 'Pendiente de revisión'}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {[equipo?.tipo, equipo?.marca, equipo?.modelo].filter(Boolean).join(' ')} · Serie:{' '}
                {equipo?.numero_serie || 'Sin registrar'} · Técnico:{' '}
                <strong>{diagnostico.tecnico?.nombre || 'Sin asignar'}</strong>
              </p>
              <button
                type="button"
                data-keyboard-id={`calidad-d-${diagnostico.id_diagnostico}`}
                aria-expanded={expandedId === `d-${diagnostico.id_diagnostico}`}
                aria-controls={`calidad-d-${diagnostico.id_diagnostico}`}
                onClick={() =>
                  setExpandedId((value) =>
                    value === `d-${diagnostico.id_diagnostico}`
                      ? null
                      : `d-${diagnostico.id_diagnostico}`,
                  )
                }
                className="mt-3 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700"
              >
                {expandedId === `d-${diagnostico.id_diagnostico}`
                  ? 'Cerrar detalle'
                  : diagnostico.calidad_estado === 'PENDIENTE'
                    ? 'Revisar diagnóstico'
                    : 'Ver detalle'}
              </button>
              <div
                id={`calidad-d-${diagnostico.id_diagnostico}`}
                data-keyboard-form
                hidden={expandedId !== `d-${diagnostico.id_diagnostico}`}
                className="mt-3 border-t border-slate-100 pt-3"
              >
                <p className="mt-2 text-sm">
                  Diagnóstico: {diagnostico.diagnostico_real || 'Sin detalle'} · Solución:{' '}
                  {diagnostico.solucion_propuesta || 'Sin detalle'}
                </p>
                {review && (
                  <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                    Última revisión:{' '}
                    {review.datos_nuevos?.parte ? `${review.datos_nuevos.parte} · ` : ''}
                    {review.motivo} · {review.usuario?.nombre_usuario}
                  </p>
                )}
                {diagnostico.calidad_estado === 'PENDIENTE' && (
                  <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
                    <p className="text-sm text-slate-600 sm:col-span-2">
                      Escriba al menos 10 caracteres de evidencia. Para devolverlo, indique también
                      la parte con error.
                    </p>
                    <label className="text-sm">
                      Parte con error (si aplica)
                      <input
                        maxLength={150}
                        value={draft.parte}
                        onChange={(e) =>
                          setDraft(`d-${diagnostico.id_diagnostico}`, 'parte', e.target.value)
                        }
                        className="mt-1 w-full rounded border p-2"
                        placeholder="Ej.: placa, pantalla, diagnóstico"
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      Resultado y evidencia
                      <textarea
                        minLength={10}
                        maxLength={4000}
                        value={draft.observacion}
                        onChange={(e) =>
                          setDraft(`d-${diagnostico.id_diagnostico}`, 'observacion', e.target.value)
                        }
                        className="mt-1 w-full rounded border p-2"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button
                        type="button"
                        data-keyboard-primary
                        disabled={busy || draft.observacion.trim().length < 10}
                        onClick={() => reviewDiagnosis(diagnostico.id_diagnostico, 'SIN_ERRORES')}
                        className="rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Aprobar y enviar a Servicio al Cliente
                      </button>
                      <button
                        type="button"
                        data-keyboard-primary
                        disabled={
                          busy ||
                          draft.observacion.trim().length < 10 ||
                          draft.parte.trim().length < 3
                        }
                        onClick={() => reviewDiagnosis(diagnostico.id_diagnostico, 'CON_ERRORES')}
                        className="rounded bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Devolver al técnico
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <h2 className="text-lg font-bold">{tab === 'pendientes' ? 'Órdenes finalizadas por revisar' : 'Órdenes con revisión registrada'} · {meta.orderTotal || 0}</h2>
      <div className="grid gap-4">
        {visibleOrders.map((orden) => {
          const equipo = orden.diagnostico?.equipo;
          const draft = drafts[orden.id_orden] || blank;
          const ready =
            draft.encendido && draft.funcion_general && draft.observacion.trim().length >= 10;
          return (
            <article key={orden.id_orden} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="text-sm font-bold">
                  Orden #{orden.id_orden} · {orden.estado?.replaceAll('_', ' ')}
                </h3>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  Calidad:{' '}
                  {canReviewOrder(orden)
                    ? 'Pendiente de revisión'
                    : orden.calidad_estado.replaceAll('_', ' ')}
                </span>
              </div>
              <p className="text-sm">
                {[equipo?.tipo, equipo?.marca, equipo?.modelo].filter(Boolean).join(' ')} · Serie:{' '}
                {equipo?.numero_serie || 'Sin registrar'} · Técnico:{' '}
                <strong>{orden.tecnico?.nombre || 'Sin asignar'}</strong>
                {orden.es_garantia ? ' · Garantía' : ''}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {equipo?.cliente?.nombre || 'Cliente sin nombre'}
              </p>
              <button
                type="button"
                data-keyboard-id={`calidad-o-${orden.id_orden}`}
                aria-expanded={expandedId === `o-${orden.id_orden}`}
                aria-controls={`calidad-o-${orden.id_orden}`}
                onClick={() =>
                  setExpandedId((value) =>
                    value === `o-${orden.id_orden}` ? null : `o-${orden.id_orden}`,
                  )
                }
                className="mt-3 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700"
              >
                {expandedId === `o-${orden.id_orden}`
                  ? 'Cerrar detalle'
                  : canReviewOrder(orden)
                    ? 'Revisar orden'
                    : 'Ver detalle'}
              </button>
              <div
                id={`calidad-o-${orden.id_orden}`}
                data-keyboard-form
                hidden={expandedId !== `o-${orden.id_orden}`}
                className="mt-3 border-t border-slate-100 pt-3"
              >
                <p className="mt-2 text-sm">
                  Resultado técnico: {orden.resultado_final || 'Sin registrar'} · Encendido:{' '}
                  {orden.enciende_salida == null
                    ? 'Sin prueba'
                    : orden.enciende_salida
                      ? 'Sí'
                      : 'No'}{' '}
                  · Alimentación AC:{' '}
                  {orden.usa_corriente_ac_salida == null
                    ? 'Sin prueba'
                    : orden.usa_corriente_ac_salida
                      ? 'Sí'
                      : 'No'}
                </p>
                {orden.observacion_final && (
                  <p className="text-sm">Observación técnica: {orden.observacion_final}</p>
                )}
                {orden.pruebas_salida && (
                  <dl className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-2">
                    {pruebasLegibles(orden.pruebas_salida).map(([label, value]) => (
                      <div key={label}>
                        <dt className="capitalize text-slate-500">{label}</dt>
                        <dd className="mt-0.5 font-semibold text-slate-700">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {canReviewOrder(orden) && (
                  <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
                    <p className="text-sm text-slate-600 sm:col-span-2">
                      Registre ambas pruebas y una observación de al menos 10 caracteres. Si
                      devuelve la orden, indique la parte con error.
                    </p>
                    {['encendido', 'funcion_general'].map((field) => (
                      <label key={field} className="text-sm">
                        {field === 'encendido'
                          ? 'Encendido independiente'
                          : 'Funcionamiento general'}
                        <select
                          required
                          value={draft[field]}
                          onChange={(e) => setDraft(orden.id_orden, field, e.target.value)}
                          className="mt-1 w-full rounded border p-2"
                        >
                          <option value="">Seleccione</option>
                          <option value="CORRECTO">Correcto</option>
                          <option value="FALLA">Falla</option>
                          <option value="NO_APLICA">No aplica</option>
                        </select>
                      </label>
                    ))}
                    <label className="text-sm sm:col-span-2">
                      Observación de calidad
                      <textarea
                        required
                        minLength={10}
                        maxLength={4000}
                        value={draft.observacion}
                        onChange={(e) => setDraft(orden.id_orden, 'observacion', e.target.value)}
                        className="mt-1 w-full rounded border p-2"
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      Parte con error (si aplica)
                      <input
                        maxLength={150}
                        value={draft.parte}
                        onChange={(e) => setDraft(orden.id_orden, 'parte', e.target.value)}
                        className="mt-1 w-full rounded border p-2"
                        placeholder="Ej.: encendido, pantalla, montaje"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button
                        type="button"
                        data-keyboard-primary
                        disabled={
                          busy ||
                          !ready ||
                          [draft.encendido, draft.funcion_general].includes('FALLA')
                        }
                        onClick={() => review(orden.id_orden, 'APROBADO')}
                        className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
                      >
                        Aprobar y habilitar facturación
                      </button>
                      <button
                        type="button"
                        data-keyboard-primary
                        disabled={busy || !ready || draft.parte.trim().length < 3}
                        onClick={() => review(orden.id_orden, 'RECHAZADO')}
                        className="rounded bg-amber-700 px-4 py-2 text-white disabled:opacity-50"
                      >
                        Devolver al técnico
                      </button>
                    </div>
                  </div>
                )}
                {orden.revisiones_calidad?.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer">Historial de revisiones</summary>
                    <ul className="mt-2 space-y-1">
                      {orden.revisiones_calidad.map((revision) => (
                        <li key={revision.id_revision}>
                          {new Date(revision.fecha_revision).toLocaleString('es-NI')} ·{' '}
                          {revision.decision} · {revision.usuario?.nombre_usuario}:{' '}
                          {revision.observacion}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <nav aria-label="Paginación de calidad" className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={loading || page === 1}
          onClick={() => setPage((value) => value - 1)}
          className="rounded-lg border bg-white px-4 py-2 disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm">Página {page} de {meta.pages || 1} · {meta.orderTotal || 0} órdenes y {meta.diagnosisTotal || 0} diagnósticos · 10 por lista</span>
        <button
          type="button"
          disabled={loading || !meta.hasNextPage}
          onClick={() => setPage((value) => value + 1)}
          className="rounded-lg border bg-white px-4 py-2 disabled:opacity-50"
        >
          Siguiente
        </button>
      </nav>
    </section>
  );
}
