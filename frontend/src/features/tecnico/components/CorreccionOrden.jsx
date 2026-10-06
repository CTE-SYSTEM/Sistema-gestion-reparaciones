import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import FotosServicio from '../../secretaria/components/shared/FotosServicio';
import { pruebasSalidaPorTipo } from '../utils/pruebasSalida';

const pruebas = [
  ['encendido', 'Encendido'], ['alimentacion', 'Alimentación'],
  ['funcion_principal', 'Función principal'], ['carga', 'Carga'],
  ['pantalla', 'Pantalla'], ['conectividad', 'Conectividad'],
];
const fecha = (value) => new Date(value).toLocaleString('es-NI', { timeZone: 'America/Managua' });

export default function CorreccionOrden({ orden, username }) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState(orden.correccion_cierre?.puede_editar_informe ? 'CORREGIR' : 'ACLARAR');
  const [motivo, setMotivo] = useState('');
  const [aclaracion, setAclaracion] = useState('');
  const [excepcion, setExcepcion] = useState(false);
  const [observacion, setObservacion] = useState(orden.observacion_final || '');
  const [enciende, setEnciende] = useState(orden.enciende_salida == null ? '' : String(orden.enciende_salida));
  const [corriente, setCorriente] = useState(orden.usa_corriente_ac_salida == null ? '' : String(orden.usa_corriente_ac_salida));
  const [resultados, setResultados] = useState(orden.pruebas_salida || {});
  const client = useQueryClient();
  const meta = orden.correccion_cierre;
  const puedeGuardar = meta && (!meta.requiere_excepcion || meta.permite_excepcion);
  useEffect(() => {
    setObservacion(orden.observacion_final || '');
    setEnciende(orden.enciende_salida == null ? '' : String(orden.enciende_salida));
    setCorriente(orden.usa_corriente_ac_salida == null ? '' : String(orden.usa_corriente_ac_salida));
    setResultados(orden.pruebas_salida || {});
    if (!orden.correccion_cierre?.puede_editar_informe) setTipo('ACLARAR');
  }, [orden.observacion_final, orden.enciende_salida, orden.usa_corriente_ac_salida, orden.pruebas_salida, orden.correccion_cierre?.puede_editar_informe]);
  const guardar = useMutation({
    mutationFn: (body) => api.patch(`/tecnicos/ordenes/${orden.id}/correccion-cierre`, body),
    onSuccess: () => { setAclaracion(''); setMotivo(''); setExcepcion(false); client.invalidateQueries({ queryKey: ['tecnico', username] }); },
  });
  if (!meta) return null;
  const requiredTests = pruebasSalidaPorTipo(orden.equipoTipo);
  const submit = (event) => {
    event.preventDefault();
    guardar.mutate({ tipo, motivo: motivo.trim(), excepcion,
      ...(tipo === 'CORREGIR' ? { observacion_final: observacion.trim(), enciende_salida: enciende === 'true',
        usa_corriente_ac_salida: corriente === 'true', pruebas_salida: resultados } : { aclaracion: aclaracion.trim() }),
    });
  };
  return <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><strong>Correcciones del cierre</strong><p className="text-xs text-slate-600">Plazo normal: {meta.plazo_horas} horas desde la finalización · hasta {fecha(meta.fecha_limite)}.</p></div><button type="button" onClick={() => setOpen(!open)} className="rounded border bg-white px-3 py-2 text-xs font-semibold text-indigo-700">{open ? 'Ocultar' : 'Ver correcciones y fotos'}</button></div>
    {open && <div className="mt-4 space-y-4">
      {meta.requiere_excepcion && <p className="rounded border border-amber-300 bg-amber-100 p-3 text-xs font-semibold text-amber-900">El plazo normal venció. Cualquier actualización quedará marcada como excepción.</p>}
      {!puedeGuardar && <p className="text-xs text-red-700">Las correcciones excepcionales están deshabilitadas en las reglas del negocio.</p>}
      {puedeGuardar && <form onSubmit={submit} className="space-y-3 rounded border bg-white p-3">
        {meta.puede_editar_informe && <label className="block text-xs font-semibold">Tipo de corrección<select value={tipo} onChange={(e) => { setTipo(e.target.value); guardar.reset(); }} className="mt-1 w-full rounded border p-2"><option value="CORREGIR">Corregir informe y pruebas de salida</option><option value="ACLARAR">Agregar aclaración sin reemplazar el informe</option><option value="REABRIR">Reabrir para completar el trabajo</option></select></label>}
        {!meta.puede_editar_informe && <p className="text-xs text-slate-600">Este cierre ya fue facturado, entregado o aprobado como irreparable. Puedes agregar una aclaración; el informe original queda intacto.</p>}
        {tipo === 'CORREGIR' ? <>
          <label className="block text-xs font-semibold">Informe final corregido<textarea required maxLength={4000} rows={4} value={observacion} onChange={(e) => setObservacion(e.target.value)} className="mt-1 w-full rounded border p-2 font-normal" /></label>
          <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-semibold">Encendido<select required value={enciende} onChange={(e) => setEnciende(e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Seleccione</option><option value="true">Enciende</option><option value="false">No enciende</option></select></label><label className="text-xs font-semibold">Alimentación AC<select required value={corriente} onChange={(e) => setCorriente(e.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Seleccione</option><option value="true">Funciona con AC</option><option value="false">No / No aplica</option></select></label></div>
          <div className="grid gap-2 sm:grid-cols-2">{pruebas.map(([key, label]) => <label key={key} className="text-xs font-semibold">{label}<select required={requiredTests.includes(key)} value={resultados[key] || ''} onChange={(e) => setResultados((prev) => ({ ...prev, [key]: e.target.value || undefined }))} className="mt-1 w-full rounded border p-2"><option value="">Sin registro</option><option value="CORRECTO">Correcto</option><option value="FALLA">Presenta falla</option><option value="NO_APLICA">No aplica</option></select></label>)}</div>
        </> : tipo === 'ACLARAR' ? <label className="block text-xs font-semibold">Aclaración técnica<textarea required maxLength={4000} rows={3} value={aclaracion} onChange={(e) => setAclaracion(e.target.value)} className="mt-1 w-full rounded border p-2 font-normal" placeholder="Qué faltó o qué dato debe aclararse" /></label> : <p className="rounded border border-indigo-200 bg-indigo-50 p-3 text-xs">La orden regresará a reparaciones activas. El cierre anterior quedará en el historial; deberás registrar un nuevo cierre al terminar.</p>}
        <label className="block text-xs font-semibold">Motivo de la corrección<input required maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); guardar.reset(); }} className="mt-1 w-full rounded border p-2 font-normal" placeholder="Explique por qué se corrige después del cierre" /></label>
        {meta.requiere_excepcion && <label className="flex items-start gap-2 text-xs"><input type="checkbox" required checked={excepcion} onChange={(e) => setExcepcion(e.target.checked)} />Confirmo que esta actualización es excepcional y quedará identificada en el historial.</label>}
        <button type="submit" disabled={guardar.isPending} className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{guardar.isPending ? 'Guardando…' : tipo === 'CORREGIR' ? 'Guardar informe corregido' : tipo === 'REABRIR' ? 'Reabrir reparación' : 'Guardar aclaración'}</button>
        {guardar.isSuccess && <p role="status" className="text-xs text-emerald-700">Corrección registrada en el historial.</p>}{guardar.error && <p role="alert" className="text-xs text-red-700">{guardar.error.response?.data?.error || 'No se pudo guardar la corrección.'}</p>}
      </form>}
      <FotosServicio kind="diagnosticos" id={orden.diagnostico_id} readOnly />
      <FotosServicio kind="ordenes" id={orden.id} tipoInicial="FOTO_REPARACION" allowedTypes={['FOTO_REPARACION']} readOnly={!puedeGuardar} correccion={puedeGuardar ? { motivo, excepcion, requiere_excepcion: meta.requiere_excepcion } : null} />
      {puedeGuardar && <p className="text-xs text-slate-600">Para agregar fotos de reparación, escribe el motivo arriba{meta.requiere_excepcion ? ' y confirma la excepción' : ''}. Las fotos anteriores se conservan.</p>}
    </div>}
  </section>;
}
