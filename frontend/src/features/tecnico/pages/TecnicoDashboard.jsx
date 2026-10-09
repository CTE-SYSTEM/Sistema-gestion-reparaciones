import React, { useContext, useEffect, useState } from 'react';
import { ClipboardList, FileCheck, Home, LogOut, Menu, Package, RefreshCw, UserRound, Wrench } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import { useRealtimeNotifications } from '../../../hooks/useRealtimeNotifications';
import BrandLogo from '../../../components/BrandLogo';
import { NotificationTray } from '../../../components/NotificationTray';
import { NotificationBell, NotificationSummary, NotificationToast } from '../../../components/NotificationAttention';
import { useTecnicoDashboard } from '../hooks/useTecnicoDashboard';
import DiagnosticosTable from '../components/DiagnosticosTable';
import OrdenesGrid from '../components/OrdenesGrid';
import RepuestosTable from '../components/RepuestosTable';
import { TecnicoDashboardModals } from '../components/sections/TecnicoDashboardModals';
import ExpedienteTecnico from '../components/ExpedienteTecnico';
import MiCuenta from '../../admin/pages/MiCuenta';
import '../../tecnicoJefe/components/supervision.css';
import '../components/tecnico.css';

const tabs = [
  { id: 'resumen', title: 'Mi trabajo', icon: Home },
  { id: 'diagnosticos', title: 'Diagnósticos activos', icon: ClipboardList, count: 'diagnosticos_activos' },
  { id: 'diagnosticos_completados', title: 'Diagnósticos cerrados', icon: FileCheck, count: 'diagnosticos_completados' },
  { id: 'ordenes', title: 'Reparaciones activas', icon: Wrench, count: 'ordenes_activas' },
  { id: 'ordenes_completadas', title: 'Reparaciones cerradas', icon: FileCheck, count: 'ordenes_completadas' },
  { id: 'repuestos', title: 'Solicitudes de piezas', icon: Package, count: 'piezas_pendientes' },
];
export default function TecnicoDashboard() {
  const { user, logout } = useContext(AuthContext);
  const { pathname, search: routeSearch } = useLocation();
  const navigate = useNavigate();
  const accountView = pathname === '/tecnico/mi-cuenta';
  const requestedTab = new URLSearchParams(routeSearch).get('tab');
  const [activeTab, setActiveTab] = useState(tabs.some((tab) => tab.id === requestedTab) ? requestedTab : 'resumen'), [mobile, setMobile] = useState(false);
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [debouncedSearch, setDebouncedSearch] = useState('');
  const [periodo, setPeriodo] = useState('todos'), [grupo, setGrupo] = useState('activos');
  const [estado, setEstado] = useState(''), [prioridad, setPrioridad] = useState('');
  const [modalRepuesto, setModalRepuesto] = useState(null), [modalDiagnostico, setModalDiagnostico] = useState(null);
  const [modalCierre, setModalCierre] = useState(null), [expediente, setExpediente] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false), [actionError, setActionError] = useState('');
  const dashboard = useTecnicoDashboard(user, { activeTab, page, search: debouncedSearch, periodo, grupo, estado, prioridad });
  useEffect(() => {
    if (search === debouncedSearch) return;
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);
  const realtime = useRealtimeNotifications({ enabled: Boolean(user?.username), persistent: true, onRefresh: dashboard.actions.invalidate,
    refreshIntervalMs: 60000, refreshOnConnect: true, refreshOnlyDisconnected: true });
  const go = (tab, group = 'activos') => { if (accountView) navigate(`/tecnico?tab=${tab}`); setActiveTab(tab); setGrupo(group); setSearch(''); setDebouncedSearch(''); setPage(1); setEstado(''); setPrioridad(''); setMobile(false); setActionError(''); };
  const filter = (setter, value) => { setter(value); setPage(1); };
  const changeState = async (id, state) => {
    const orden = dashboard.items.find((r) => r.id === id);
    if (['FINALIZADO', 'IRREPARABLE'].includes(state)) { setModalCierre({ orden, estado: state }); return; }
    try { setActionError(''); await dashboard.actions.cambiarEstadoOrden(id, { estado: state }); }
    catch (err) { setActionError(err.response?.data?.error || 'No se pudo cambiar el estado'); }
  };
  const openNotice = (notice) => {
    const entity = notice.entity;
    if (!entity) return;
    setExpediente({ kind: entity.kind === 'diagnostico' ? 'diagnostico' : 'orden', id: entity.orden_id || entity.id });
    setNotificationsOpen(false);
    realtime.dismissLatest();
  };
  const reviewNotices = () => { realtime.reloadNotifications(); setNotificationsOpen(true); realtime.dismissLatest(); };
  const error = actionError || dashboard.error?.response?.data?.error || (dashboard.error ? 'No se pudo actualizar esta sección. Puede reintentar.' : '');
  const stats = dashboard.stats;
  const section = tabs.find((t) => t.id === activeTab), completed = activeTab.includes('completad');
  const diagnostics = activeTab.startsWith('diagnosticos');
  return <div className="jefe-panel tecnico-panel">
    {mobile && <button className="jefe-mobile-shade" aria-label="Cerrar navegación" onClick={() => setMobile(false)} />}
    <aside className={'jefe-sidebar ' + (mobile ? 'open' : '')} aria-label="Navegación del técnico">
      <div className="jefe-brand"><BrandLogo className="h-9 w-9" /><div><strong>SGR · Taller</strong><small>Área técnica</small></div></div>
      <div className="jefe-nav-caption">Mis trabajos asignados</div><nav className="jefe-nav">{tabs.map((t) => <button key={t.id} aria-current={!accountView && activeTab === t.id ? 'page' : undefined} onClick={() => go(t.id)}><t.icon size={17} /><span>{t.title}</span>{stats[t.count] > 0 && <span className="jefe-nav-count">{stats[t.count]}</span>}</button>)}</nav>
      <div className="jefe-sidebar-footer"><p>{user?.personName || user?.username}</p><small>Técnico · Ejecución y pruebas</small><Link to="/tecnico/mi-cuenta" aria-current={accountView ? 'page' : undefined} className="mt-3 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-200 hover:bg-indigo-500/20 hover:text-white"><UserRound size={15} /> Mi cuenta</Link><button onClick={logout}><LogOut size={15} /> Cerrar sesión</button></div>
    </aside>
    <div className="jefe-workspace">
      <header className="jefe-topbar"><div className="jefe-topbar-left"><button className="jefe-icon-btn jefe-mobile-menu" aria-label="Abrir navegación" aria-expanded={mobile} onClick={() => setMobile(!mobile)}><Menu size={18} /></button><span>Panel técnico</span><strong>{accountView ? 'Mi cuenta' : section.title}</strong></div>
        <div className="jefe-topbar-right"><span className="text-xs">{import.meta.env.VITE_NOTIFICATIONS_MODE === 'poll' ? 'Avisos actualizados periódicamente' : realtime.connected ? 'Avisos conectados' : 'Reconectando avisos'}</span><div className="relative"><NotificationBell count={realtime.unreadCount} connected={realtime.connected} expanded={notificationsOpen} onClick={() => { if (!notificationsOpen) realtime.reloadNotifications(); setNotificationsOpen(!notificationsOpen); }} />{notificationsOpen && <NotificationTray notifications={realtime.notifications} total={realtime.unreadCount} connected={realtime.connected} onClear={realtime.clearNotifications} onRead={realtime.markNotificationRead} clearing={realtime.clearing} loading={realtime.loadingHistory} error={realtime.notificationsError} onClose={() => setNotificationsOpen(false)} onOpen={openNotice} />}</div></div>
      </header>
      <main className="jefe-main">{accountView ? <MiCuenta /> : <><NotificationSummary notifications={realtime.notifications} count={realtime.unreadCount} onReview={reviewNotices} onOpen={openNotice} />
        <div className="jefe-heading"><div><div className="jefe-eyebrow">Ejecución técnica</div><h1>{section.title}</h1><p>Equipos, informes, pruebas y piezas de tus trabajos asignados.</p></div><button className="jefe-btn" disabled={dashboard.loading || dashboard.summaryLoading} onClick={dashboard.actions.reload}><RefreshCw size={14} /> Actualizar</button></div>
        {error && <div role="alert" className="jefe-message error">{error}<button onClick={() => { setActionError(''); dashboard.actions.reload(); }}>Reintentar</button></div>}
        <div className="tecnico-periodo"><label>Periodo <select aria-label="Filtrar periodo" value={periodo} onChange={(e) => filter(setPeriodo, e.target.value)}><option value="todos">Todos</option><option value="hoy">Hoy</option><option value="mes">Este mes</option><option value="anio">Este año</option></select></label><small>Fecha de asignación para trabajos activos, de finalización para cerrados y de solicitud para piezas. Hora de Managua.</small></div>
        {activeTab === 'resumen' ? <>
          <div className="jefe-stats">{[
            ['diagnosticos_activos', 'Diagnósticos activos', ClipboardList, 'diagnosticos'],
            ['ordenes_activas', 'Reparaciones activas', Wrench, 'ordenes'],
            ['piezas_pendientes', 'Piezas pendientes', Package, 'repuestos'],
            ['revision_jefe', 'Revisión del jefe', FileCheck, 'ordenes', 'revision_jefe'],
          ].map(([key, title, Icon, tab, group]) => <button className="jefe-stat text-left" key={key} onClick={() => go(tab, group)}><div className="jefe-stat-top"><span>{title}</span><Icon size={20} /></div><div className="jefe-stat-value">{stats[key] || 0}</div><small>Abrir sección</small></button>)}</div>
          <section className="jefe-card"><div className="jefe-card-header"><h2>Organiza tu jornada</h2></div><div className="tecnico-jornada">
            <button onClick={() => go('diagnosticos', 'por_iniciar')}><ClipboardList /><strong>Iniciar diagnósticos</strong><span>Revisa las condiciones del equipo antes de comenzar.</span></button>
            <button onClick={() => go('ordenes', 'por_iniciar')}><Wrench /><strong>Iniciar reparaciones</strong><span>Consulta el informe y registra el inicio real.</span></button>
            <button onClick={() => go('ordenes', 'esperando_piezas')}><Package /><strong>Esperando piezas · {stats.esperando_piezas || 0}</strong><span>Aprobación y entrega física se registran por separado.</span></button>
          </div></section>
          <p className="mt-4 text-sm text-slate-500">Los trabajos se ordenan por urgencia y antigüedad. El contacto y los acuerdos con el cliente se gestionan en recepción.</p>
        </> : <>
          <div className="tecnico-filtros">
            <input aria-label="Buscar trabajos técnicos" placeholder={activeTab === 'repuestos' ? 'Buscar pieza o número de orden…' : 'Buscar código, tipo, marca o modelo…'} value={search} onChange={(e) => setSearch(e.target.value)} />
            {activeTab !== 'repuestos' && <select aria-label="Filtrar prioridad" value={prioridad} onChange={(e) => filter(setPrioridad, e.target.value)}><option value="">Todas las prioridades</option><option value="URGENTE">Urgente</option><option value="ALTA">Alta</option><option value="NORMAL">Normal</option></select>}
            {!completed && activeTab !== 'repuestos' && <select aria-label="Filtrar grupo de trabajo" value={grupo} onChange={(e) => filter(setGrupo, e.target.value)}><option value="activos">Todos los activos</option><option value="por_iniciar">Por iniciar</option>{!diagnostics && <><option value="esperando_piezas">Esperando piezas</option><option value="revision_jefe">Pendientes del jefe</option></>}</select>}
            {activeTab === 'repuestos' && <select aria-label="Filtrar estado de piezas" value={estado} onChange={(e) => filter(setEstado, e.target.value)}><option value="">Todas las solicitudes</option><option value="PENDIENTE">Pendientes de aprobación</option><option value="POR_ENTREGAR">Aprobadas por entregar</option><option value="SIN_EXISTENCIA">Sin existencias</option><option value="APROBADO">Aprobadas</option><option value="DENEGADO">Rechazadas</option></select>}
          </div>
          {dashboard.loading && <p role="status" className="mb-3 text-sm text-indigo-700">Actualizando sección…</p>}
          {diagnostics ? <DiagnosticosTable items={dashboard.items} loading={dashboard.loading || dashboard.busy} readOnly={completed} onOpenDiagnostico={setModalDiagnostico} onOpenDetalle={(r, intent) => setExpediente({ kind: 'diagnostico', id: r.id, intent })} onReopen={dashboard.actions.reabrirDiagnostico} onIniciarDiagnostico={async (r) => { try { await dashboard.actions.iniciarDiagnostico(r.id); } catch (err) { setActionError(err.response?.data?.error || 'No se pudo iniciar el diagnóstico'); } }} />
            : activeTab === 'repuestos' ? <RepuestosTable solicitudes={dashboard.items} loading={dashboard.loading} onOpenOrden={(id) => setExpediente({ kind: 'orden', id })} />
            : <OrdenesGrid items={dashboard.items} loading={dashboard.loading} busy={dashboard.busy} completed={completed} username={user?.username} onEstadoChange={changeState} onSolicitarPieza={setModalRepuesto} onOpenDetalle={(r) => setExpediente({ kind: 'orden', id: r.id })} />}
          <div className="tecnico-paginacion"><span>{dashboard.meta.total} registros · Página {page}</span><button disabled={page === 1 || dashboard.loading} onClick={() => setPage(page - 1)}>Anterior</button><button disabled={!dashboard.meta.hasMore || dashboard.loading} onClick={() => setPage(page + 1)}>Siguiente</button></div>
        </>}</>}
      </main>
    </div>
    <TecnicoDashboardModals modalRepuesto={modalRepuesto} modalDiagnostico={modalDiagnostico} modalCierre={modalCierre}
      onCloseRepuesto={() => setModalRepuesto(null)} onCloseDiagnostico={() => setModalDiagnostico(null)} onCloseCierre={() => setModalCierre(null)}
      onSolicitarRepuesto={dashboard.actions.solicitarRepuesto} onGuardarDiagnostico={dashboard.actions.guardarDiagnostico}
      onGuardarBorrador={dashboard.actions.guardarBorrador} onCerrarOrden={dashboard.actions.cambiarEstadoOrden} />
    {expediente && <ExpedienteTecnico key={expediente.kind + '-' + expediente.id} {...expediente} username={user?.username} onClose={() => setExpediente(null)} />}
  <NotificationToast notification={realtime.latestNotification} onClose={realtime.dismissLatest} onReview={reviewNotices} onOpen={openNotice} /></div>;
}
