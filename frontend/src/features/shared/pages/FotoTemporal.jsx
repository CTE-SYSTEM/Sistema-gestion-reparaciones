import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { consultarSesionFotos, enviarFotoTemporal } from '../services/photoTransferService';
import { sendTemporaryPhotoBatch } from './temporaryPhotoBatch';
import { prepareTemporaryPhoto, TEMPORARY_PHOTO_LIMIT_LABEL } from './prepareTemporaryPhoto';

export default function FotoTemporal() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const busyRef = useRef(false);
  useEffect(() => {
    let active = true;
    consultarSesionFotos(token).then(({ data }) => { if (active) setSession(data); })
      .catch((err) => { if (active) setError(err.response?.data?.error || 'No se pudo abrir la sesión.'); });
    return () => { active = false; };
  }, [token]);

  const send = async (files) => {
    if (!files.length || busyRef.current || !session) return;
    busyRef.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await sendTemporaryPhotoBatch(files, {
        count: session.count,
        maxPhotos: session.maxPhotos,
        prepare: prepareTemporaryPhoto,
        upload: async (file, onProgress) => (await enviarFotoTemporal(token, file, onProgress)).data,
        onProgress: setProgress,
        onSent: (data) => setSession((current) => ({ ...current, count: data.count })),
      });
      if (result.sent) setNotice(`${result.sent} foto(s) enviada(s). Revise la selección en la PC.`);
      if (result.failed.length) setError(result.failed.map(({ name, error }) => `${name}: ${error}`).join(' '));
    } finally { busyRef.current = false; setBusy(false); setProgress(0); }
  };

  return <main className="mx-auto min-h-screen max-w-lg space-y-5 bg-slate-50 p-5 text-slate-900">
    <h1 className="text-xl font-bold">Fotos para la PC</h1>
    <p className="text-sm text-slate-600">Tome las fotos con este teléfono. Aparecerán en la sección de subir fotos de la PC para revisarlas y guardarlas allí.</p>
    {session && <section className="space-y-4 rounded-xl border bg-white p-4">
      <p className="text-sm font-semibold">{session.count} de {session.maxPhotos} fotos enviadas</p>
      <label className="block rounded-lg bg-indigo-600 px-4 py-4 text-center font-semibold text-white">
        Abrir cámara
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy || session.count >= session.maxPhotos} onChange={(event) => { send(Array.from(event.target.files || [])); event.target.value = ''; }} className="sr-only" />
      </label>
      <label className="block rounded-lg border px-4 py-3 text-center font-semibold text-indigo-700">
        Adjuntar fotos del teléfono
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || session.count >= session.maxPhotos} onChange={(event) => { send(Array.from(event.target.files || [])); event.target.value = ''; }} className="sr-only" />
      </label>
      {busy && <p role="status" className="text-sm">Preparando y enviando fotos… {progress}%</p>}
      <p className="text-xs text-slate-500">Las fotos grandes se reducen automáticamente a {TEMPORARY_PHOTO_LIMIT_LABEL}. La sesión vence a las {new Date(session.expiresAt).toLocaleTimeString('es-NI', { timeZone: 'America/Managua', hour: '2-digit', minute: '2-digit' })}. Estas fotos aún no se guardan en el registro.</p>
    </section>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
  </main>;
}
