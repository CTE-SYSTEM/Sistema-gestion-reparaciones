import { useEffect, useState } from 'react';
import api from '../../../services/api';

const blank = { encendido: '', funcion_general: '', observacion: '' };

export default function CalidadPage() {
  const [ordenes, setOrdenes] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => { const { data } = await api.get('/calidad/ordenes'); setOrdenes(data.data || []); };
  useEffect(() => {
    let active = true;
    api.get('/calidad/ordenes').then(({ data }) => { if (active) setOrdenes(data.data || []); })
      .catch(() => { if (active) setError('No se pudieron cargar las pruebas de salida.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const setDraft = (id, field, value) => setDrafts((old) => ({ ...old, [id]: { ...(old[id] || blank), [field]: value } }));
  const review = async (id, decision) => {
    const draft = drafts[id] || blank;
    setBusy(true); setError(''); setMessage('');
    try {
      await api.post(`/calidad/ordenes/${id}/revision`, { decision, observacion: draft.observacion,
        pruebas: { encendido: draft.encendido, funcion_general: draft.funcion_general } });
      await load(); setMessage(decision === 'APROBADO' ? `Orden #${id} aprobada.` : `Orden #${id} devuelta al taller.`);
    } catch (err) { setError(err.response?.data?.error || 'No se pudo registrar la revisión.'); }
    finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-5xl space-y-5 p-4">
    <header><h1 className="text-2xl font-bold">Control de calidad</h1><p className="text-sm text-slate-600">Compruebe el equipo y registre pruebas independientes antes de facturar o entregar.</p></header>
    {message && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {loading && <p>Cargando órdenes…</p>}
    {!loading && ordenes.length === 0 && <p>No hay órdenes para revisar.</p>}
    <div className="grid gap-4">{ordenes.map((orden) => {
      const equipo = orden.diagnostico?.equipo;
      const draft = drafts[orden.id_orden] || blank;
      const ready = draft.encendido && draft.funcion_general && draft.observacion.trim().length >= 10;
      return <article key={orden.id_orden} className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">Orden #{orden.id_orden} · {orden.estado}</h2><span className="text-sm">Calidad: {orden.calidad_estado.replaceAll('_', ' ')}</span></div>
        <p className="text-sm">{[equipo?.tipo, equipo?.marca, equipo?.modelo].filter(Boolean).join(' ')} · Serie: {equipo?.numero_serie || 'Sin registrar'}{orden.es_garantia ? ' · Garantía' : ''}</p>
        <p className="mt-2 text-sm">Resultado técnico: {orden.resultado_final || 'Sin registrar'} · Encendido: {orden.enciende_salida == null ? 'Sin prueba' : orden.enciende_salida ? 'Sí' : 'No'} · Alimentación AC: {orden.usa_corriente_ac_salida == null ? 'Sin prueba' : orden.usa_corriente_ac_salida ? 'Sí' : 'No'}</p>
        {orden.observacion_final && <p className="text-sm">Observación técnica: {orden.observacion_final}</p>}
        {orden.pruebas_salida && <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(orden.pruebas_salida, null, 2)}</pre>}
        {orden.calidad_estado === 'PENDIENTE' && <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
          {['encendido', 'funcion_general'].map((field) => <label key={field} className="text-sm">{field === 'encendido' ? 'Encendido independiente' : 'Funcionamiento general'}<select required value={draft[field]} onChange={(e) => setDraft(orden.id_orden, field, e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Seleccione</option><option value="CORRECTO">Correcto</option><option value="FALLA">Falla</option><option value="NO_APLICA">No aplica</option></select></label>)}
          <label className="text-sm sm:col-span-2">Observación de calidad<textarea required minLength={10} maxLength={4000} value={draft.observacion} onChange={(e) => setDraft(orden.id_orden, 'observacion', e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
          <div className="flex gap-2 sm:col-span-2"><button type="button" disabled={busy || !ready || [draft.encendido, draft.funcion_general].includes('FALLA')} onClick={() => review(orden.id_orden, 'APROBADO')} className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50">Aprobar</button><button type="button" disabled={busy || !ready} onClick={() => review(orden.id_orden, 'RECHAZADO')} className="rounded bg-amber-700 px-4 py-2 text-white disabled:opacity-50">Devolver al taller</button></div>
        </div>}
        {orden.revisiones_calidad?.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer">Historial de revisiones</summary><ul className="mt-2 space-y-1">{orden.revisiones_calidad.map((revision) => <li key={revision.id_revision}>{new Date(revision.fecha_revision).toLocaleString('es-NI')} · {revision.decision} · {revision.usuario?.nombre_usuario}: {revision.observacion}</li>)}</ul></details>}
      </article>;
    })}</div>
  </section>;
}
