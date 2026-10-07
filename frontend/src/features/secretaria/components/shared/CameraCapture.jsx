import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Camera, Loader2, X } from 'lucide-react';
import { MAX_PHOTO_BYTES, PHOTO_LIMIT_LABEL } from './photoQueue';

const cameraErrorMessage = (error) => {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'No se permitió usar la cámara. Autorice el acceso en el navegador e inténtelo de nuevo.';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'Este equipo no tiene una cámara disponible.';
  }
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
    return 'La cámara está ocupada o el equipo no puede abrirla en este momento.';
  }
  return 'No se pudo abrir la cámara en este equipo.';
};

const toJpeg = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

export default function CameraCapture({ onClose, onCapture }) {
  const videoRef = useRef(null);
  const [starting, setStarting] = useState(true);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let stream;
    const video = videoRef.current;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no permite acceder a la cámara desde esta página.');
        setStarting(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (!video) throw new Error('Video unavailable');
        video.srcObject = stream;
        await video.play();
      } catch (cameraError) {
        stream?.getTracks().forEach((track) => track.stop());
        if (active) setError(cameraErrorMessage(cameraError));
      } finally {
        if (active) setStarting(false);
      }
    };
    start();
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, []);

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) return;
    setCapturing(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 2048 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      let blob = await toJpeg(canvas, 0.88);
      if (blob?.size > MAX_PHOTO_BYTES) blob = await toJpeg(canvas, 0.7);
      if (!blob || blob.size > MAX_PHOTO_BYTES) {
        setError(`La foto supera ${PHOTO_LIMIT_LABEL}. Pruebe con otra cámara o use el teléfono.`);
        return;
      }
      const file = new File([blob], `camara-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
      const added = await onCapture(file);
      if (added === false) {
        setError('No se pudo agregar la foto. Revise la selección e inténtelo de nuevo.');
        return;
      }
      onClose();
    } catch {
      setError('No se pudo preparar la foto. Inténtelo de nuevo o use el teléfono.');
    } finally {
      setCapturing(false);
    }
  };

  return <Dialog open onClose={onClose} className="relative z-[150]">
    <div className="fixed inset-0 bg-slate-950/75" aria-hidden="true" />
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
      <DialogPanel className="w-full max-w-2xl space-y-4 rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div><DialogTitle className="text-base font-semibold text-slate-900">Cámara de este equipo</DialogTitle>
            <p className="mt-1 text-sm text-slate-600">Revise la imagen antes de agregarla a las fotos por guardar.</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar cámara" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-slate-900">
          <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => setReady(true)} className="aspect-video w-full object-contain" />
          {starting && <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white"><Loader2 className="h-4 w-4 animate-spin" /> Abriendo cámara…</p>}
        </div>
        {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error} Si esta PC no tiene cámara, abra «Fotos desde el teléfono» y cree una sesión temporal para tomarla con el móvil.</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cerrar</button>
          <button type="button" onClick={takePhoto} disabled={!ready || starting || capturing || Boolean(error)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {capturing ? 'Preparando foto…' : 'Capturar foto'}
          </button>
        </div>
      </DialogPanel>
    </div>
  </Dialog>;
}
