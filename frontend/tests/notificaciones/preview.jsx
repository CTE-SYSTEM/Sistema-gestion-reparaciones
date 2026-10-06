import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NotificationBell, NotificationSummary, NotificationToast } from '../../src/components/NotificationAttention';
import { NotificationTray } from '../../src/components/NotificationTray';
import '../../src/index.css';
import '../../src/features/tecnicoJefe/components/supervision.css';

const example = {
  id: 'muestra-1', type: 'nuevo_diagnostico', title: 'Nuevo diagnóstico recibido',
  message: 'Diagnóstico #42 · Laptop Dell Inspiron 15 · Cliente: Ana López · Sin técnico asignado · Prioridad alta.',
  severity: 'warning', entity: { kind: 'diagnostico', id: 42 }, timestamp: new Date().toISOString(),
};

function Preview() {
  const [notifications, setNotifications] = useState([example]);
  const [tray, setTray] = useState(false);
  const [toast, setToast] = useState(true);
  const markRead = (id) => setNotifications((items) => items.filter((item) => item.id !== id));
  return <div className="jefe-panel min-h-screen">
    <aside className="jefe-sidebar"><div className="p-6 text-lg font-bold text-white">CTE · Taller</div><div className="px-6 text-xs text-slate-300">Coordinación técnica</div></aside>
    <div className="jefe-workspace">
      <header className="jefe-topbar"><div className="jefe-topbar-left"><strong>Panel del Jefe Técnico</strong></div><div className="jefe-topbar-right"><div className="relative"><NotificationBell count={notifications.length} connected expanded={tray} onClick={() => setTray(!tray)} />{tray && <NotificationTray notifications={notifications} total={notifications.length} connected onClear={() => setNotifications([])} onRead={markRead} onClose={() => setTray(false)} onOpen={() => setTray(false)} />}</div></div></header>
      <main className="jefe-main"><p className="mb-4 text-xs font-bold uppercase tracking-wider text-indigo-600">Vista de muestra · Datos ficticios</p><NotificationSummary notifications={notifications} count={notifications.length} onReview={() => setTray(true)} onOpen={() => setTray(true)} /><div className="jefe-heading"><div><div className="jefe-eyebrow">Control técnico</div><h1>Resumen del taller</h1><p>Una vista general del trabajo, las prioridades y el equipo técnico.</p></div></div><section className="jefe-card p-6"><h2 className="text-base font-bold">Trabajos que requieren atención</h2><p className="mt-2 text-sm text-slate-500">El aviso pendiente aparece arriba del contenido y se conserva hasta marcarlo como leído.</p></section></main>
    </div>
    {toast && <NotificationToast notification={example} onClose={() => setToast(false)} onReview={() => { setTray(true); setToast(false); }} onOpen={() => { setTray(true); setToast(false); }} />}
  </div>;
}

createRoot(document.getElementById('root')).render(<Preview />);
