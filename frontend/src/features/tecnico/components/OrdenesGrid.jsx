import React, { useState } from 'react';
import { EstadoBadge, PrioridadBadge } from './TecnicoBadges';
import FotosServicio from '../../shared/components/FotosServicio';
import AvancesOrden from './AvancesOrden';
import CorreccionOrden from './CorreccionOrden';

const fecha = (v) => v ? new Date(v).toLocaleString('es-NI', { timeZone: 'America/Managua' }) : 'Sin registro';
const OrdenCard = ({ orden, completed, busy, username, onEstadoChange, onSolicitarPieza, onOpenDetalle }) => {
  const [photosOpen, setPhotosOpen] = useState(false);
  const [fotoMotivo, setFotoMotivo] = useState('');
  const [fotoExcepcion, setFotoExcepcion] = useState(false);
  const meta = orden.correccion_cierre;
  const puedeAgregarFoto = completed && meta && (!meta.requiere_excepcion || meta.permite_excepcion);
  const piezas = orden.repuestos_usados || [];
  const bloqueadaPorPiezas = piezas.some((p) => p.estado_aprobacion === 'PENDIENTE'
    || (p.estado_aprobacion === 'APROBADO' && (p.estado_entrega !== 'ENTREGADO' || !p.repuesto_id)));
  const revision = orden.estado === 'IRREPARABLE' && orden.irreparable_estado === 'PENDIENTE';
  const cerrado = completed || revision;
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><div className="mb-1 flex items-center gap-2"><span className="text-xs font-bold text-indigo-700">Orden #{orden.id}</span><PrioridadBadge prioridad={orden.prioridad} /></div><h2 className="text-lg font-bold">{orden.equipo}</h2></div><EstadoBadge estado={revision ? 'REVISION_JEFE' : orden.estado} /></div>
    <p className="mb-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{orden.falla}</p>
    <p className="mb-3 text-xs text-slate-500">Asignada: {fecha(orden.fecha_asignacion)}{orden.fecha_inicio_reparacion ? ' · Inicio: ' + fecha(orden.fecha_inicio_reparacion) : ' · Pendiente de inicio'}</p>
    {!completed && orden.horas_sin_avance >= 72 && <p className="mb-3 rounded border border-amber-200 p-2 text-xs text-amber-800">Más de 72 horas sin avance registrado.</p>}
    {revision && <p className="mb-3 rounded border border-amber-200 p-3 text-sm">Irreparabilidad pendiente de revisión del jefe. Puede corregir o retirar el informe desde el expediente.</p>}
    {orden.motivo_revision_irreparable && <p className="mb-3 rounded border border-indigo-100 p-3 text-sm"><strong>Decisión del jefe: </strong>{orden.motivo_revision_irreparable}</p>}
    {piezas.length > 0 && <div className="mb-4 space-y-2"><h3 className="text-sm font-semibold">Piezas del trabajo</h3>{piezas.map((p) => <div key={p.id_detalle_repuesto} className="rounded border p-3 text-xs"><strong>{p.repuesto?.nombre || p.pieza_solicitada}</strong> · {p.cantidad_usada}
      <p className="mt-1">{p.estado_entrega === 'SIN_EXISTENCIA' ? 'Bodega reportó falta de existencias' : p.estado_aprobacion === 'APROBADO' ? p.estado_entrega === 'ENTREGADO' ? 'Aprobada y entregada' : 'Aprobada · pendiente de entrega física' : p.estado_aprobacion === 'DENEGADO' ? 'Rechazada' : 'Pendiente de aprobación'}</p>
      {p.motivo_rechazo && <p className="mt-1 text-red-700">Motivo: {p.motivo_rechazo}</p>}
    </div>)}</div>}
    {bloqueadaPorPiezas && !cerrado && <p className="mb-3 text-xs text-amber-800">Para reanudar o finalizar, las solicitudes deben estar resueltas y las piezas aprobadas, entregadas.</p>}
    {completed && <div className="mb-3 text-sm"><strong>Resultado: {orden.resultado_final || orden.estado}</strong><p className="mt-2 whitespace-pre-wrap">{orden.observacion_final}</p><p className="mt-1 text-xs">Finalizada: {fecha(orden.fecha_finalizacion)}</p></div>}
    {completed && <CorreccionOrden orden={orden} username={username} />}
    {orden.fecha_inicio_reparacion && <AvancesOrden orden={orden} username={username} editable={!cerrado && ['EN_REPARACION', 'ESPERANDO_PIEZA'].includes(orden.estado)} />}
    <div className="mb-4 flex flex-wrap gap-2"><button type="button" onClick={() => onOpenDetalle(orden)} className="rounded border px-3 py-2 text-xs font-semibold text-indigo-700">Ver expediente</button><button type="button" onClick={() => setPhotosOpen(!photosOpen)} aria-expanded={photosOpen} className="rounded border px-3 py-2 text-xs">{photosOpen ? 'Cerrar fotografías' : 'Fotografías de la reparación'}</button></div>
    {photosOpen && <div className="mb-4 space-y-3">
      {puedeAgregarFoto && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
        <p>Para añadir una foto después del cierre, indique el motivo. Las fotos anteriores se conservan.</p>
        <label className="block font-semibold">Motivo de la foto añadida<input required maxLength={2000} value={fotoMotivo} onChange={(e) => setFotoMotivo(e.target.value)} className="mt-1 w-full rounded border bg-white p-2 font-normal" /></label>
        {meta.requiere_excepcion && <label className="flex items-start gap-2"><input type="checkbox" checked={fotoExcepcion} onChange={(e) => setFotoExcepcion(e.target.checked)} />Confirmo que esta foto se agrega como excepción fuera del plazo normal.</label>}
      </div>}
      <FotosServicio kind="ordenes" id={orden.id} tipoInicial="FOTO_REPARACION" allowedTypes={['FOTO_REPARACION']} title="Fotografías de la reparación" readOnly={cerrado && !puedeAgregarFoto} correccion={puedeAgregarFoto ? { motivo: fotoMotivo, excepcion: fotoExcepcion, requiere_excepcion: meta.requiere_excepcion } : null} />
      <p className="text-xs text-slate-500">Las fotos del diagnóstico están en «Ver expediente».</p>
    </div>}
    {!cerrado && <div className="flex flex-wrap gap-2">
      {!orden.fecha_inicio_reparacion ? <button disabled={busy} onClick={() => onEstadoChange(orden.id, 'EN_REPARACION')} className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Iniciar reparación</button> : <>
        {orden.estado === 'ESPERANDO_PIEZA' && <button disabled={busy || bloqueadaPorPiezas} onClick={() => onEstadoChange(orden.id, 'EN_REPARACION')} className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Reanudar reparación</button>}
        <button disabled={busy || bloqueadaPorPiezas} onClick={() => onEstadoChange(orden.id, 'FINALIZADO')} className="rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Finalizar y registrar pruebas</button>
        <button disabled={busy} onClick={() => onEstadoChange(orden.id, 'IRREPARABLE')} className="rounded border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Reportar irreparable</button>
      </>}
      <button disabled={busy || !orden.fecha_inicio_reparacion} onClick={() => onSolicitarPieza(orden)} className="rounded border px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-50">Solicitar pieza</button>
    </div>}
  </article>;
};
export default function OrdenesGrid({ items, loading, completed = false, busy, ...actions }) {
  return <div className="grid gap-5 lg:grid-cols-2">{items.map((o) => <OrdenCard key={o.id} orden={o} completed={completed} busy={busy} {...actions} />)}{!loading && !items.length && <p className="col-span-full rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">No hay reparaciones que coincidan con los filtros.</p>}</div>;
}
