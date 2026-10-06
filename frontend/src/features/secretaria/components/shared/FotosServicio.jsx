import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../../../context/AuthContext';
import { descargarFotoServicio, listarFotosServicio, subirFotoServicio, revisarFotoTecnica } from '../../services/archivosServicioService';
import { usePhotoQueue } from '../../hooks/usePhotoQueue';
import FotosPendientes from './FotosPendientes';

const tipos = {
  diagnosticos: [['FOTO_RECEPCION', 'Recepción'], ['FOTO_DIAGNOSTICO', 'Diagnóstico'], ['FOTO_SALIDA_SIN_REPARAR', 'Salida sin reparar']],
  ordenes: [['FOTO_REPARACION', 'Reparación'], ['FOTO_ENTREGA', 'Entrega']],
};
export default function FotosServicio({ kind, id, tipoInicial, allowedTypes, readOnly = false, correccion = null }) {
  const { user } = useContext(AuthContext);
  const role = String(user?.rol || '').normalize('NFD').replace(/[\u0300-\u036f\s_-]/g, '').toLowerCase();
  const canReview = ['secretaria', 'tecnicojefe', 'administrador', 'adminpro'].includes(role);
  const opciones = allowedTypes ? tipos[kind].filter(([value]) => allowedTypes.includes(value)) : tipos[kind];
  const [archivos, setArchivos] = useState([]), [tipo, setTipo] = useState(tipoInicial || opciones[0]?.[0]);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [preview, setPreview] = useState(null);
  const [reviewed, setReviewed] = useState(false), [busy, setBusy] = useState(false), [stage, setStage] = useState('');
  const queue = usePhotoQueue();
  const reload = async () => { if (id) setArchivos((await listarFotosServicio(kind, id)).data.data || []); };
  useEffect(() => { let current = true; listarFotosServicio(kind, id).then((r) => { if (current) setArchivos(r.data.data || []); }).catch(() => { if (current) setError('No se pudieron cargar las fotografías'); }); return () => { current = false; }; }, [kind, id]);
  useEffect(() => { if (tipoInicial) setTipo(tipoInicial); }, [tipoInicial]);
  const previewUrl = preview?.url;
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const upload = async () => {
    setError(''); setNotice('');
    if (correccion && !correccion.motivo?.trim()) { setError('Indique el motivo de la corrección antes de guardar fotos.'); return; }
    if (correccion?.requiere_excepcion && !correccion.excepcion) { setError('Confirme que la carga de fotos es excepcional.'); return; }
    const result = await queue.uploadPhotos((photo, onProgress) => subirFotoServicio(kind, id, tipo, photo.file, {
      onProgress, correccion: correccion ? { motivo: correccion.motivo.trim(), excepcion: correccion.excepcion } : null,
    }));
    if (result) {
      await reload().catch(() => setError('Las fotos se guardaron; actualice la lista para verlas.'));
      setNotice(result.failed.length ? result.failed.length + ' fotos pendientes. Puede reintentar sin repetir las guardadas.' : 'Fotografías guardadas.');
      if (!canReview) setNotice((v) => v + ' Recepción o supervisión revisará su publicación en el expediente.');
    }
  };
  const openPhoto = async (archivo) => {
    setError(''); setReviewed(false);
    try { const response = await descargarFotoServicio(archivo.id_archivo); setPreview({ archivo, url: URL.createObjectURL(response.data) }); }
    catch (err) { setError(err.response?.status === 403 ? 'La fotografía no está autorizada para el expediente técnico.' : 'No se pudo abrir la fotografía'); }
  };
  const review = async (visible) => {
    setBusy(true); setError('');
    try {
      await revisarFotoTecnica(preview.archivo.id_archivo, visible);
      setPreview((v) => ({ ...v, archivo: { ...v.archivo, visible_tecnico: visible } }));
      await reload(); setNotice(visible ? 'Fotografía autorizada para el técnico.' : 'Fotografía retirada del expediente técnico.');
    } catch (err) { setError(err.response?.data?.error || 'No se pudo registrar la revisión'); }
    finally { setBusy(false); }
  };
  const reviewable = preview && ['FOTO_RECEPCION', 'FOTO_DIAGNOSTICO', 'FOTO_REPARACION'].includes(preview.archivo.tipo_archivo);
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Fotografías del servicio</h3><button type="button" onClick={() => reload().catch(() => setError('No se pudo actualizar la lista'))} className="text-xs underline">Actualizar fotos</button></div>
    {!readOnly && <><label className="block text-xs">Etapa<select aria-label="Tipo de fotografía" value={tipo} disabled={queue.photos.length > 0 || queue.isBusy} onChange={(e) => setTipo(e.target.value)} className="ml-2 rounded border bg-white p-2">{opciones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <FotosPendientes photos={queue.photos} selectionMessages={queue.selectionMessages} onAdd={queue.addPhotos} onRemove={queue.removePhoto} onClear={queue.clearPendingPhotos} isPreparing={queue.isPreparing} isUploading={queue.isUploading} title="Fotos por guardar" />
      <label className="inline-block text-xs font-semibold text-indigo-700">Tomar foto<input aria-label="Tomar fotografía con cámara" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={queue.isBusy} onChange={(e) => { queue.addPhotos(Array.from(e.target.files || [])); e.target.value = ''; }} className="ml-2 max-w-full text-xs" /></label>
      {queue.photos.some((p) => p.status !== 'uploaded') && <button type="button" onClick={upload} disabled={queue.isBusy} className="ml-3 rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">{queue.isUploading ? 'Guardando…' : queue.photos.some((p) => p.status === 'failed') ? 'Reintentar pendientes' : 'Guardar fotos'}</button>}
      {queue.photos.length > 0 && !queue.isBusy && queue.photos.every((p) => p.status === 'uploaded') && <button type="button" onClick={queue.clearPhotos} className="ml-3 text-xs underline">Nueva selección</button>}
    </>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}{notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}
    {archivos.length > 0 ? <><select aria-label="Filtrar etapa de fotografías" value={stage} onChange={(e) => setStage(e.target.value)} className="rounded border bg-white p-2 text-xs"><option value="">Todas las etapas</option>{tipos[kind].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <div className="flex flex-wrap gap-2">{archivos.filter((a) => !stage || a.tipo_archivo === stage).map((a) => <button type="button" key={a.id_archivo} onClick={() => openPhoto(a)} disabled={!canReview && !a.visible_tecnico} className="rounded border bg-white px-3 py-2 text-left text-xs text-indigo-700 disabled:opacity-60"><strong className="block">{a.nombre_original}</strong><span>{a.tipo_archivo.replaceAll('_', ' ')} · {new Date(a.fecha_subida).toLocaleString('es-NI', { timeZone: 'America/Managua' })}</span>{a.correccion_cierre && <span className="block font-semibold text-amber-700">{a.es_excepcion ? 'Corrección excepcional' : 'Foto agregada tras el cierre'}</span>}<span className="block">{a.visible_tecnico ? 'Disponible en expediente técnico' : 'Pendiente de revisión técnica'}</span></button>)}</div></> : <p className="text-xs text-slate-500">{canReview ? 'Sin fotografías registradas.' : 'No hay fotografías autorizadas para este expediente.'}</p>}
    {preview && <div className="space-y-3 rounded border bg-white p-3"><img src={preview.url} alt={preview.archivo.nombre_original} className="max-h-96 max-w-full object-contain" />
      <div className="flex gap-4 text-xs"><a href={preview.url} download={preview.archivo.nombre_original} className="text-indigo-700 underline">Descargar</a><button type="button" onClick={() => setPreview(null)} className="underline">Cerrar foto</button></div>
      {canReview && reviewable && <div className="space-y-2 border-t pt-3"><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />He revisado la imagen y no contiene nombres, teléfonos, direcciones, documentos ni otros datos que identifiquen al cliente.</label>
        <button type="button" disabled={busy || (!preview.archivo.visible_tecnico && !reviewed)} onClick={() => review(!preview.archivo.visible_tecnico)} className="rounded border px-3 py-2 text-xs disabled:opacity-50">{preview.archivo.visible_tecnico ? 'Retirar del expediente técnico' : 'Autorizar para el técnico'}</button>
      </div>}
    </div>}
  </section>;
}
