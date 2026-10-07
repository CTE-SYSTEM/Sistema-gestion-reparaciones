import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { consultarSesionFotos, enviarFotoTemporal } from '../services/photoTransferService';
import { MAX_PHOTO_BYTES, PHOTO_LIMIT_LABEL } from '../components/shared/photoQueue';

const allowed = ['image/jpeg', 'image/png', 'image/webp'];

export default function FotoTemporal() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let active = true;
    consultarSesionFotos(token).then(({ data }) => { if (active) setSession(data); })
      .catch((err) => { if (active) setError(err.response?.data?.error || 'No se pudo abrir la sesión.'); });
    return () => { active = false; };
  }, [token]);

  const send = async (files) => {
    if (!files.length || busy) return;
    setBusy(true); setError(''); setNotice('');
    let sent = 0;
    try {
      for (const file of files) {
        if (!allowed.includes(file.type) || !file.size || file.size > MAX_PHOTO_BYTES) throw new Error(`Cada foto debe ser JPG, PNG o WebP y medir hasta ${PHOTO_LIMIT_LABEL}.`);
        setProgress(0);
        const { data } = await enviarFotoTemporal(token, file, setProgress);
        sent += 1;
        setSession((current) => ({ ...current, count: data.count }));
      }
      setNotice(`${sent} foto(s) enviada(s). Revise la selección en la PC.`);
    } catch (err) { setError(err.response?.data?.error || err.message || 'No se pudo enviar la foto.'); }
    finally { setBusy(false); setProgress(0); }
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
      {busy && <p role="status" className="text-sm">Enviando foto… {progress}%</p>}
      <p className="text-xs text-slate-500">La sesión vence a las {new Date(session.expiresAt).toLocaleTimeString('es-NI', { timeZone: 'America/Managua', hour: '2-digit', minute: '2-digit' })}. Estas fotos aún no se guardan en el registro.</p>
    </section>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
  </main>;
}
