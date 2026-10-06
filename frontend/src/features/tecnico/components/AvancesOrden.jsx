import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const fecha = (value) => new Date(value).toLocaleString('es-NI', { timeZone: 'America/Managua' });

export default function AvancesOrden({ orden, editable, username }) {
  const [nota, setNota] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [registroAbierto, setRegistroAbierto] = useState(false);
  const client = useQueryClient();
  const key = ['tecnico', username, 'expediente', 'orden', orden.id];
  const avances = useQuery({
    queryKey: key,
    enabled: mostrar,
    queryFn: async ({ signal }) => (await api.get(`/tecnicos/ordenes/${orden.id}`, { signal })).data.data,
    select: (detail) => detail.avances,
  });
  const guardar = useMutation({
    mutationFn: () => api.post(`/tecnicos/ordenes/${orden.id}/avances`, { observacion: nota.trim() }),
    onSuccess: () => {
      setNota('');
      setMostrar(true);
      setRegistroAbierto(false);
      client.invalidateQueries({ queryKey: ['tecnico', username] });
    },
  });

  return <section className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-semibold">Avances de la orden</h3><p className="text-xs text-slate-500">Última actividad: {orden.ultimo_avance ? fecha(orden.ultimo_avance) : 'Sin registro'}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setMostrar((value) => !value)} aria-expanded={mostrar} aria-label={`${mostrar ? 'Ocultar' : 'Ver'} avances de la orden ${orden.id}`} className="rounded border bg-white px-3 py-2 text-xs font-semibold text-indigo-700">{mostrar ? 'Ocultar avances' : 'Ver avances'}</button>
        {editable && <button type="button" onClick={() => { setRegistroAbierto((value) => !value); guardar.reset(); }} aria-expanded={registroAbierto} className="rounded border bg-white px-3 py-2 text-xs font-semibold text-indigo-700">{registroAbierto ? 'Cancelar registro' : 'Registrar avance'}</button>}</div>
    </div>
    {editable && registroAbierto && <form onSubmit={(event) => { event.preventDefault(); if (nota.trim()) guardar.mutate(); }} className="mt-3 space-y-2">
      <label className="block text-sm font-medium">Registrar avance
        <textarea value={nota} onChange={(event) => { setNota(event.target.value); guardar.reset(); }} disabled={guardar.isPending} required maxLength={2000} rows={2} className="mt-1 w-full rounded border bg-white p-2 font-normal" placeholder="Trabajo realizado, pruebas o motivo técnico de espera" />
      </label>
      <button type="submit" disabled={guardar.isPending || !nota.trim()} className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{guardar.isPending ? 'Guardando…' : 'Guardar avance'}</button>
      {guardar.error && <p role="alert" className="text-xs text-red-700">{guardar.error.response?.data?.error || 'No se pudo guardar el avance.'}</p>}
    </form>}
    {guardar.isSuccess && <p role="status" className="mt-2 text-xs text-emerald-700">Avance guardado en esta orden.</p>}
    {mostrar && <div className="mt-3 border-t pt-3" aria-label={`Bitácora de la orden ${orden.id}`}>
      {avances.isPending && <p role="status" className="text-xs text-slate-500">Cargando avances…</p>}
      {avances.error && <p role="alert" className="text-xs text-red-700">{avances.error.response?.data?.error || 'No se pudieron cargar los avances.'} <button type="button" onClick={() => avances.refetch()} className="underline">Reintentar</button></p>}
      {avances.data?.length === 0 && <p className="text-xs text-slate-500">Esta orden aún no tiene avances registrados.</p>}
      {avances.data?.map((avance) => <article key={avance.id_avance} className="mb-2 border-l-2 border-indigo-300 pl-3"><p className="whitespace-pre-wrap text-sm">{avance.observacion}</p><small className="text-slate-500">{fecha(avance.fecha_hora)} · {avance.usuario?.nombre_usuario || 'Técnico'}</small></article>)}
    </div>}
  </section>;
}
