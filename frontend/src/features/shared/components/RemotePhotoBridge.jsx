import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { cerrarSesionFotos, crearSesionFotos, descargarFotoTemporal, listarFotosTemporales } from '../services/photoTransferService';
import { receiveTemporaryPhotos } from './receiveTemporaryPhotos';

export default function RemotePhotoBridge({ onAdd, disabled = false }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [phoneOrigin, setPhoneOrigin] = useState(window.location.origin);
  const received = useRef(new Set());
  const fetching = useRef(false);
  const onAddRef = useRef(onAdd);
  const disabledRef = useRef(disabled);
  const tokenRef = useRef(null);
  useEffect(() => { onAddRef.current = onAdd; }, [onAdd]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  useEffect(() => () => { if (tokenRef.current) cerrarSesionFotos(tokenRef.current).catch(() => {}); }, []);

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    const poll = async () => {
      if (fetching.current || disabledRef.current) return;
      fetching.current = true;
      try {
        const { data } = await listarFotosTemporales(session.token);
        if (active) setError('');
        const result = await receiveTemporaryPhotos(data.photos || [], {
          received: received.current,
          isAvailable: () => active && !disabledRef.current,
          download: async (photo) => {
            const response = await descargarFotoTemporal(session.token, photo.id);
            return new File([response.data], photo.name, { type: photo.mime, lastModified: photo.createdAt });
          },
          add: (files) => onAddRef.current(files),
        });
        if (active && result.accepted) setNotice(`${result.accepted} foto(s) agregada(s) a la selección. Revise y guárdelas en la PC.`);
        if (active && result.failed.length) setError(`${result.failed.length} foto(s) no se pudieron recibir; se volverá a intentar.`);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.error || 'Se perdió la conexión con la sesión temporal. Puede seguir adjuntando fotos aquí.');
          if (err.response?.status === 404) { tokenRef.current = null; setSession(null); }
        }
      } finally { fetching.current = false; }
    };
    poll();
    const timer = setInterval(poll, 2500);
    return () => { active = false; clearInterval(timer); };
  }, [session]);

  const start = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await crearSesionFotos();
      received.current = new Set();
      tokenRef.current = data.token;
      setSession(data);
    } catch (err) { setError(err.response?.data?.error || 'No se pudo abrir la sesión temporal.'); }
    finally { setBusy(false); }
  };
  const close = async () => {
    const token = tokenRef.current;
    tokenRef.current = null;
    setSession(null); received.current = new Set(); setNotice(''); setError('');
    if (token) await cerrarSesionFotos(token).catch(() => {});
  };
  const url = session ? `${phoneOrigin.trim().replace(/\/$/, '')}/foto-temporal/${session.token}` : '';

  return <div className="space-y-2 rounded-lg border border-indigo-100 bg-white p-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong>Fotos desde el teléfono</strong>
      {!session ? <button type="button" disabled={busy || disabled} onClick={start} className="rounded border border-indigo-300 px-3 py-2 font-semibold text-indigo-700 disabled:opacity-50">{busy ? 'Abriendo…' : 'Abrir sesión temporal'}</button>
        : <button type="button" onClick={close} className="text-slate-600 underline">Cerrar sesión</button>}
    </div>
    {session && <><label className="block text-slate-600">Dirección que abrirá el teléfono<input type="url" value={phoneOrigin} onChange={(event) => setPhoneOrigin(event.target.value)} className="mt-1 block w-full rounded border p-2 text-xs" /></label><div className="flex flex-wrap items-center gap-4">
      <QRCodeSVG value={url} size={132} level="M" marginSize={1} />
      <div className="min-w-0 flex-1 space-y-1"><p>Escanee el código con el teléfono. Las fotos aparecerán en esta selección; guárdelas aquí cuando termine.</p>
        <a className="block break-all text-indigo-700 underline" href={url} target="_blank" rel="noreferrer">Abrir enlace de la sesión</a>
        <p className="text-slate-500">Vence a las {new Date(session.expiresAt).toLocaleTimeString('es-NI', { timeZone: 'America/Managua', hour: '2-digit', minute: '2-digit' })}. Máximo 12 fotos.</p>
        {/localhost|127\.0\.0\.1/.test(phoneOrigin) && <p className="text-amber-700">En lugar de localhost, escriba arriba la dirección de la PC accesible desde el teléfono, por ejemplo http://192.168.1.20:5173.</p>}
      </div>
    </div></>}
    {error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status" className="text-emerald-700">{notice}</p>}
  </div>;
}
