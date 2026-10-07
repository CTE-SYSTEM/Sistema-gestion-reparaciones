import { useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Trash2, UploadCloud, X, ZoomIn } from 'lucide-react';
import { formatPhotoSize } from './photoQueue';
import RemotePhotoBridge from './RemotePhotoBridge';

export default function FotosPendientes({
  photos, selectionMessages = [], onAdd, onRemove, onClear,
  disabled = false, isPreparing = false, isUploading = false,
  contextLabel = '', readOnly = false, title = 'Fotografías de recepción',
}) {
  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const preview = photos.find((photo) => photo.id === previewId);
  const uploaded = photos.filter((photo) => photo.status === 'uploaded').length;
  const pending = photos.length - uploaded;
  const busy = disabled || isPreparing || isUploading;

  const addFiles = (files) => {
    if (!busy && !readOnly) onAdd?.(Array.from(files || []));
  };

  return (
    <section className="space-y-4 rounded-xl border border-indigo-100 bg-slate-50/70 p-4 text-left">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          {contextLabel && <p className="mt-1 text-xs text-slate-600">Equipo: <strong>{contextLabel}</strong></p>}
          {!readOnly && <p className="mt-1 text-xs text-slate-500">Agregue varias fotos y revíselas antes de guardar. JPG, PNG o WebP, hasta 5 MB por foto.</p>}
        </div>
        {!readOnly && pending > 0 && (
          <button type="button" disabled={busy} onClick={onClear} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-white disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> {uploaded ? 'Quitar pendientes' : 'Quitar todas'}
          </button>
        )}
      </div>

      {!readOnly && (
        <div
          onDragOver={(event) => { event.preventDefault(); if (!busy) setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => { event.preventDefault(); setDragActive(false); addFiles(event.dataTransfer.files); }}
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed p-4 ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white'} ${busy ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center gap-3">
            <UploadCloud className="h-6 w-6 text-indigo-500" />
            <p className="text-sm text-slate-600">Arrastre las fotos aquí o selecciónelas.<span className="mt-0.5 block text-xs text-slate-500">Puede agregar más sin perder las anteriores.</span></p>
          </div>
          <input
            ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy}
            aria-label="Seleccionar fotografías" className="sr-only" tabIndex={-1}
            onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }}
          />
          <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} aria-label="Tomar foto con cámara" className="sr-only" tabIndex={-1} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
          <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed">
            {isPreparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {isPreparing ? 'Revisando imágenes...' : photos.length ? 'Agregar más fotos' : 'Seleccionar fotos'}
          </button><button type="button" disabled={busy} onClick={() => cameraRef.current?.click()} className="rounded-lg border px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50">Tomar foto</button></div>
        </div>
      )}

      {!readOnly && <RemotePhotoBridge onAdd={onAdd} disabled={busy} />}

      {selectionMessages.length > 0 && <div className="space-y-1" aria-live="polite">
        {selectionMessages.map((message, index) => <p key={`${index}-${message.text}`} className={`text-xs ${message.type === 'error' ? 'text-red-700' : 'text-slate-600'}`} role={message.type === 'error' ? 'alert' : undefined}>{message.text}</p>)}
      </div>}

      {photos.length > 0 && <>
        <p className="flex items-center gap-2 text-xs font-medium text-slate-700" role="status">
          {isUploading && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
          {photos.length} foto{photos.length === 1 ? '' : 's'} · {uploaded} guardada{uploaded === 1 ? '' : 's'}{pending > 0 ? ` · ${pending} por subir` : ''}
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {photos.map((photo) => (
            <article key={photo.id} className={`overflow-hidden rounded-xl border bg-white ${photo.status === 'failed' ? 'border-red-300' : photo.status === 'uploaded' ? 'border-emerald-200' : 'border-slate-200'}`}>
              <div className="relative">
                <button type="button" onClick={() => setPreviewId(photo.id)} aria-label={`Ampliar ${photo.file.name}`} className="group relative block aspect-[4/3] w-full bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
                  <img src={photo.previewUrl} alt={`Vista previa de ${photo.file.name}`} className="h-full w-full object-contain" />
                  <span className="absolute bottom-2 right-2 rounded-full bg-white/90 p-1.5 text-slate-700 shadow-sm group-hover:text-indigo-600"><ZoomIn className="h-4 w-4" /></span>
                </button>
                {!readOnly && photo.status !== 'uploaded' && <button type="button" disabled={busy} onClick={() => onRemove?.(photo.id)} aria-label={`Quitar ${photo.file.name}`} title="Quitar de la selección" className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-slate-600 shadow-sm hover:text-red-600 disabled:opacity-50"><X className="h-4 w-4" /></button>}
              </div>
              <div className="space-y-2 p-3">
                <div>
                  <p className="truncate text-xs font-semibold text-slate-800" title={photo.file.name}>{photo.file.name}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{formatPhotoSize(photo.file.size)} · {photo.width} × {photo.height}</p>
                </div>
                <p className={`flex items-center gap-1.5 text-xs font-medium ${photo.status === 'uploaded' ? 'text-emerald-700' : photo.status === 'failed' ? 'text-red-700' : 'text-indigo-700'}`}>
                  {photo.status === 'uploaded' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : photo.status === 'failed' ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : photo.status === 'uploading' ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
                  {photo.status === 'uploaded' ? 'Guardada' : photo.status === 'failed' ? 'No se guardó' : photo.status === 'uploading' ? photo.progress >= 100 ? 'Guardando foto...' : `Enviando ${photo.progress}%` : 'Lista para subir'}
                </p>
                {photo.status === 'uploading' && <div role="progressbar" aria-label={`Subida de ${photo.file.name}`} aria-valuenow={photo.progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${photo.progress}%` }} /></div>}
                {photo.error && <p className="break-words text-xs text-red-700">{photo.error}</p>}
              </div>
            </article>
          ))}
        </div>
      </>}

      <Dialog open={Boolean(preview)} onClose={() => setPreviewId(null)} className="relative z-[140]">
        <div className="fixed inset-0 bg-slate-950/75" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
          <DialogPanel className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b p-4">
              <div className="min-w-0"><DialogTitle className="break-words text-sm font-semibold text-slate-900">{preview?.file.name}</DialogTitle><p className="mt-1 text-xs text-slate-500">{preview && `${formatPhotoSize(preview.file.size)} · ${preview.width} × ${preview.height}`}</p></div>
              <button type="button" onClick={() => setPreviewId(null)} aria-label="Cerrar vista previa" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            {preview && <img src={preview.previewUrl} alt={preview.file.name} className="max-h-[75vh] w-full bg-slate-100 object-contain" />}
          </DialogPanel>
        </div>
      </Dialog>
    </section>
  );
}
