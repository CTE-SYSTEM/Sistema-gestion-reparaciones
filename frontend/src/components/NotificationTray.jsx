import React, { useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { notificationActionLabel, notificationAreaNames } from '../utils/notificationInbox';

const notificationColors = {
  success: 'border-emerald-100 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-indigo-100 bg-indigo-50 text-indigo-950',
  error: 'border-red-200 bg-red-50 text-red-900',
};

export const NotificationTray = ({ notifications, total = notifications.length, connected, onClear, onRead, onClose, onOpen, error, clearing = false, loading = false }) => {
  const trayRef = useRef(null);

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose?.(); };
    const closeOnOutsidePress = (event) => {
      const notificationControl = trayRef.current?.parentElement;
      if (notificationControl && !notificationControl.contains(event.target)) onClose?.();
    };

    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePress);
    };
  }, [onClose]);
  return <aside ref={trayRef} aria-label="Bandeja de avisos pendientes" className="fixed inset-x-4 top-16 z-[60] rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[min(420px,calc(100vw-48px))]">
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div><h2 className="text-sm font-extrabold">Avisos pendientes · {total}</h2>
        <p className="mt-1 text-xs text-slate-500">{import.meta.env.VITE_NOTIFICATIONS_MODE === 'poll' ? 'Guardados · Actualización periódica' : connected ? 'Guardados · En vivo' : 'Guardados · Sin conexión en vivo'}</p></div>
      <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar notificaciones"><X size={17} /></button>
    </div>
    <div className="border-b border-slate-100 px-4 py-3"><p className="text-xs text-slate-600">Se conservan aunque cierres la web. Quedan pendientes hasta que los marques como leídos.</p>
      {notifications.length > 0 && <button type="button" disabled={clearing} onClick={onClear} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"><Check size={15} />{clearing ? 'Guardando lectura…' : 'Marcar estos avisos como leídos'}</button>}
      {total > notifications.length && <p className="mt-2 text-xs text-indigo-700">Se muestran {notifications.length} de {total}. Al marcarlos como leídos aparecerán los siguientes.</p>}
    </div>
    <div className="max-h-[min(420px,calc(100dvh-250px))] space-y-3 overflow-y-auto p-3">
      {error && <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{error}</p>}
      {loading && <p role="status" className="text-xs text-slate-500">Recuperando avisos guardados…</p>}
      {!notifications.length && !loading ? <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No tienes avisos pendientes.</p> : notifications.map((item) => <article key={item.id} className={`rounded-xl border p-3 ${notificationColors[item.severity] || notificationColors.info}`}>
        <h3 className="text-sm font-extrabold">{item.title || 'Actividad'}</h3><p className="mt-1 text-sm leading-relaxed">{item.message}</p>
        {notificationAreaNames(item).length > 0 && <p className="mt-2 text-xs font-semibold opacity-75">Área: {notificationAreaNames(item).join(' · ')}</p>}
        <time className="mt-2 block text-xs opacity-70">{item.timestamp ? new Date(item.timestamp).toLocaleString('es-NI', { timeZone: 'America/Managua' }) : ''}</time>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {onOpen && item.entity && <button type="button" onClick={() => onOpen(item)} className="rounded-lg bg-white/70 px-3 py-2 text-xs font-bold underline">{notificationActionLabel(item)}</button>}
          {onRead && <button type="button" disabled={clearing} onClick={() => onRead(item.id)} aria-label={`Marcar aviso ${item.title || 'Actividad'} como leído`} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold hover:bg-white/70 disabled:opacity-50"><Check size={14} />Marcar leído</button>}
        </div>
      </article>)}
    </div>
  </aside>;
};

export default NotificationTray;
