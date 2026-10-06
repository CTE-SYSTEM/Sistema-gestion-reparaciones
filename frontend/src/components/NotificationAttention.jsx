import { BellRing, ChevronRight, X } from 'lucide-react';
import { notificationActionLabel } from '../utils/notificationInbox';

export function NotificationBell({ count = 0, connected, expanded, onClick }) {
  return <button type="button" onClick={onClick} aria-label="Abrir notificaciones" aria-expanded={expanded}
    title={connected ? 'Avisos guardados y conexión en vivo activa' : 'Avisos guardados; reconectando el servicio en vivo'}
    className={`relative inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${count ? 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
    <BellRing size={19} /><span className="hidden sm:inline">{count ? 'Avisos pendientes' : 'Notificaciones'}</span>
    {count > 0 && <span className="min-w-6 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-extrabold text-white">{count}</span>}
    <span aria-hidden="true" className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
  </button>;
}

export function NotificationSummary({ notifications, count, onReview, onOpen }) {
  const first = notifications[0];
  if (!first) return null;
  const urgent = first.severity === 'warning' || first.severity === 'error';
  return <section aria-label="Avisos pendientes" className={`mb-5 flex flex-wrap items-start gap-4 rounded-2xl border p-4 shadow-sm ${urgent ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-indigo-200 bg-indigo-50 text-indigo-950'}`}>
    <div className={`rounded-xl p-2.5 text-white ${urgent ? 'bg-amber-600' : 'bg-indigo-600'}`}><BellRing size={23} /></div>
    <div className="min-w-0 flex-1"><p className={`text-xs font-bold uppercase tracking-wide ${urgent ? 'text-amber-700' : 'text-indigo-600'}`}>{count || notifications.length} {(count || notifications.length) === 1 ? 'aviso pendiente de revisar' : 'avisos pendientes de revisar'}</p>
      <h2 className="mt-1 text-base font-extrabold">{first.title}</h2><p className="mt-1 text-sm leading-relaxed">{first.message}</p>
      <p className={`mt-2 text-xs ${urgent ? 'text-amber-800' : 'text-indigo-700'}`}>Los avisos se conservan hasta que los marques como leídos.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {onOpen && first.entity && <button type="button" onClick={() => onOpen(first)} className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-white ${urgent ? 'bg-amber-700 hover:bg-amber-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{notificationActionLabel(first)}<ChevronRight size={16} /></button>}
      <button type="button" onClick={onReview} className={`rounded-xl border bg-white px-3 py-2 text-sm font-bold ${urgent ? 'border-amber-300 text-amber-900' : 'border-indigo-200 text-indigo-800'}`}>Revisar avisos</button>
    </div>
  </section>;
}

export function NotificationToast({ notification, onClose, onOpen, onReview }) {
  if (!notification) return null;
  const urgent = notification.severity === 'warning' || notification.severity === 'error';
  return <aside role="status" aria-live="polite" aria-label="Nuevo aviso recibido" className={`fixed bottom-5 right-4 z-[70] w-[min(420px,calc(100vw-32px))] rounded-2xl border border-l-4 bg-white p-4 text-slate-900 shadow-2xl ${urgent ? 'border-amber-200 border-l-amber-600' : 'border-indigo-200 border-l-indigo-600'}`}>
    <div className="flex items-start gap-3"><BellRing size={23} className={`mt-0.5 shrink-0 ${urgent ? 'text-amber-600' : 'text-indigo-600'}`} /><div className="min-w-0 flex-1">
      <p className={`text-xs font-bold uppercase ${urgent ? 'text-amber-700' : 'text-indigo-600'}`}>{urgent ? 'Nuevo aviso · Requiere atención' : 'Nuevo aviso'}</p><h2 className="mt-1 text-base font-extrabold">{notification.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{notification.message}</p>
    </div><button type="button" aria-label="Ocultar aviso" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
    <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onReview} className={`rounded-lg px-3 py-2 text-sm font-bold ${urgent ? 'text-amber-800' : 'text-indigo-700'}`}>Ver avisos</button>
      {onOpen && notification.entity && <button type="button" onClick={() => onOpen(notification)} className={`rounded-lg px-3 py-2 text-sm font-bold text-white ${urgent ? 'bg-amber-700' : 'bg-indigo-600'}`}>{notificationActionLabel(notification)}</button>}</div>
  </aside>;
}
