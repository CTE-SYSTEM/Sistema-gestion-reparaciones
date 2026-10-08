import { useEffect, useState } from 'react';
import { descargarFotoCompra, listarFotosCompra, subirFotoCompra } from '../services/comprasService';
import RemotePhotoBridge from '../../shared/components/RemotePhotoBridge';
import CameraCapture from '../../shared/components/CameraCapture';
import { MAX_PHOTO_BYTES, PHOTO_LIMIT_LABEL } from '../../shared/components/photoQueue';

export default function FotosCompra({ id, onChanged }) {
  const [fotos, setFotos] = useState([]);
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const addFiles = (incoming) => { setFiles((previous) => [...previous, ...incoming]); return incoming.length > 0; };
  const reload = async () => setFotos((await listarFotosCompra({ page: 1, pageSize: 100, compra_id: id })).data.data || []);
  useEffect(() => {
    let active = true;
    listarFotosCompra({ page: 1, pageSize: 100, compra_id: id }).then(({ data }) => { if (active) setFotos(data.data || []); }).catch(() => { if (active) setError('No se pudieron cargar los tickets'); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview?.url]);
  const upload = async () => {
    setBusy(true); setError(''); setNotice('');
    let saved = 0;
    try {
      for (const file of files) {
        if (file.size > MAX_PHOTO_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(`Cada foto debe ser JPG, PNG o WebP y medir hasta ${PHOTO_LIMIT_LABEL}.`);
        await subirFotoCompra(id, file);
        saved += 1;
      }
      setFiles([]); setNotice(`${saved} foto(s) guardada(s).`); await reload(); onChanged?.();
    } catch (e) { setFiles((prev) => prev.slice(saved)); setError(e.response?.data?.error || e.message || 'No se pudo guardar el ticket'); await reload().catch(() => {}); }
    finally { setBusy(false); }
  };
  const open = async (foto) => {
    setError('');
    try { const response = await descargarFotoCompra(foto.id_archivo); setPreview({ foto, url: URL.createObjectURL(response.data) }); }
    catch { setError('No se pudo abrir la foto del ticket'); }
  };
  return <section className="mt-4 rounded-xl border bg-slate-50 p-4 text-left">
    <h3 className="font-semibold">Fotos del ticket · compra #{id}</h3>
    <p className="mt-1 text-xs text-slate-500">Las fotos quedan vinculadas a esta compra y organizadas por fecha.</p>
    <label className="mt-3 block text-sm">Agregar fotos del ticket<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} className="mt-1 block w-full text-xs" /></label>
    <button type="button" disabled={busy} onClick={() => setCameraOpen(true)} className="rounded border px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-50">Usar cámara de este equipo</button>
    <div className="mt-2"><RemotePhotoBridge onAdd={addFiles} disabled={busy} /></div>
    {cameraOpen && <CameraCapture onClose={() => setCameraOpen(false)} onCapture={(file) => addFiles([file])} />}
    {files.length > 0 && <div className="mt-2"><p className="text-xs">{files.map((f) => f.name).join(', ')}</p><button type="button" onClick={upload} disabled={busy} className="mt-2 rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar fotos'}</button></div>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}{notice && <p role="status" className="mt-2 text-xs text-emerald-700">{notice}</p>}
    <div className="mt-3 flex flex-wrap gap-2">{fotos.map((foto) => <button key={foto.id_archivo} type="button" onClick={() => open(foto)} className="rounded border bg-white px-3 py-2 text-left text-xs text-indigo-700"><strong className="block">{foto.nombre_original}</strong><span>{new Date(foto.fecha_subida).toLocaleString('es-NI', { timeZone: 'America/Managua' })}</span></button>)}{!fotos.length && <p className="text-xs text-slate-500">Sin fotos del ticket.</p>}</div>
    {preview && <div className="mt-3 rounded border bg-white p-3"><img src={preview.url} alt={preview.foto.nombre_original} className="max-h-96 max-w-full object-contain" /><div className="mt-2 flex gap-3 text-xs"><a href={preview.url} download={preview.foto.nombre_original} className="text-indigo-700 underline">Descargar</a><button type="button" onClick={() => setPreview(null)} className="underline">Cerrar</button></div></div>}
  </section>;
}
