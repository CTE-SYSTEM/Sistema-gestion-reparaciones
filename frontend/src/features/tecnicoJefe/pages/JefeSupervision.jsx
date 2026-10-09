import React, { useContext, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ClipboardList, Clock, FileCheck, LayoutDashboard, LogOut, Menu, PackageCheck, RefreshCw, Search, ShieldCheck, TriangleAlert, UserRound, Users, Waypoints, Wrench } from 'lucide-react';
import { AuthContext } from '../../../context/AuthContext';
import BrandLogo from '../../../components/BrandLogo';
import PageHelp from '../../../components/PageHelp';
import MiCuenta from '../../admin/pages/MiCuenta';
import { NotificationTray } from '../../../components/NotificationTray';
import { NotificationBell, NotificationSummary, NotificationToast } from '../../../components/NotificationAttention';
import { useSupervision } from '../hooks/useSupervision';
import { CompactTeam, InterventionTable, PartsTable, SupervisionDialog, TeamCards, WorkTable, hours, interventionTitle, label } from '../components/SupervisionWidgets';
import '../components/supervision.css';

const sections = [
  { id: 'resumen', title: 'Resumen del taller', description: 'Una vista general del trabajo, las prioridades y el equipo técnico.', icon: LayoutDashboard },
  { id: 'asignaciones', title: 'Asignaciones', description: 'Distribuye los diagnósticos y las órdenes sin técnico responsable.', icon: ClipboardList },
  { id: 'seguimiento', title: 'Seguimiento', description: 'Consulta el avance, las fechas y el historial de cada trabajo.', icon: Waypoints },
  { id: 'diagnosticos_cerrados', title: 'Diagnósticos cerrados', description: 'Revisa los diagnósticos completados, aprobados o rechazados de todos los técnicos y sus correcciones.', icon: FileCheck },
  { id: 'ordenes_cerradas', title: 'Órdenes cerradas', description: 'Revisa las reparaciones finalizadas, entregadas, canceladas o declaradas irreparables y sus correcciones.', icon: Wrench },
  { id: 'tecnicos', title: 'Equipo técnico', description: 'Revisa la carga de trabajo, las especialidades y la disponibilidad.', icon: Users },
  { id: 'repuestos', title: 'Repuestos', description: 'Revisa solicitudes y confirma la entrega de las piezas aprobadas.', icon: PackageCheck },
  { id: 'irreparables', title: 'Irreparables', description: 'Evalúa los casos presentados por los técnicos y registra tu decisión.', icon: ShieldCheck },
  { id: 'alertas', title: 'Pendientes y retrasos', description: 'Trabajos activos que exceden el plazo configurado sin avances.', icon: TriangleAlert },
  { id: 'intervenciones', title: 'Correcciones y excepciones', description: 'Consulta las correcciones técnicas de todo el taller y abre el expediente relacionado.', icon: Activity },
];
const closedDiagnostics = new Set(['COMPLETADO', 'DIAGNOSTICADO', 'APROBADO', 'RECHAZADO']);
const isClosedOrder = (r) => ['FINALIZADO', 'ENTREGADO', 'CANCELADO'].includes(r.estado)
  || (r.estado === 'IRREPARABLE' && r.irreparable_estado === 'APROBADO');
const normalize = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function Stat({ title, value = 0, note, icon: Icon, tone = '' }) {
  return <article className={`jefe-stat ${tone}`}><div className="jefe-stat-top"><span>{title}</span><div className="jefe-stat-icon"><Icon size={17} /></div></div><p className="jefe-stat-value">{value}</p><small>{note}</small></article>;
}
function Overview({ data, go, open }) {
  const { indicadores: k, tecnicos, trabajos } = data;
  const averageTime = (value) => value == null ? 'Sin datos' : hours(value);
  return <><div className="jefe-stats"><Stat title="Trabajos activos" value={k.trabajos_activos} note={`${k.diagnosticos_activos || 0} diagnósticos · ${k.ordenes_activas || 0} reparaciones`} icon={Activity} /><Stat title="Pendientes de asignación" value={k.sin_asignar} note="Trabajos sin responsable" icon={ClipboardList} tone="amber" /><Stat title="Repuestos por revisar" value={k.repuestos_pendientes} note={`${k.repuestos_por_entregar || 0} aprobados por entregar`} icon={PackageCheck} tone="green" /><Stat title="Alertas de retraso" value={k.atrasados} note={`${k.alerta_tecnica_horas || 72} horas sin avance`} icon={TriangleAlert} tone="red" /></div>
    <div className="jefe-grid"><section className="jefe-card"><div className="jefe-card-header"><div><h2>Estado de los trabajos</h2><p>Diagnósticos y reparaciones activos</p></div><Waypoints size={19} className="text-indigo-500" /></div><div className="jefe-card-body">{[['Por asignar', k.sin_asignar], ['Asignados', k.asignados], ['En diagnóstico', k.en_diagnostico], ['En reparación', k.en_reparacion], ['Esperando piezas', k.esperando_piezas], ['Revisión de irreparable', k.irreparables_pendientes]].map(([name, value]) => <div className="jefe-state-line" key={name}><span className="label">{name}</span><div className="track"><div className="fill" style={{ width: `${(Number(value || 0) / Math.max(k.trabajos_activos || 0, 1)) * 100}%` }} /></div><b>{value || 0}</b></div>)}<div className="jefe-overview-footer"><span><Clock size={12} className="inline mr-1" /> Diagnóstico promedio: {averageTime(k.promedio_diagnostico_horas)}</span><span>Reparación: {averageTime(k.promedio_reparacion_horas)}</span></div></div></section>
    <section className="jefe-card"><div className="jefe-card-header"><div><h2>Carga del equipo</h2><p>{tecnicos.length} técnicos con cuenta activa</p></div><Users size={19} className="text-indigo-500" /></div><div className="jefe-card-body"><CompactTeam rows={[...tecnicos].sort((a, b) => b.ordenes_activas + b.diagnosticos_activos - a.ordenes_activas - a.diagnosticos_activos)} onView={() => go('tecnicos')} /></div></section></div>
    <section className="jefe-card"><div className="jefe-card-header"><div><h2>Trabajos que requieren atención</h2><p>Primero los pendientes de asignación; después, prioridades altas y retrasos</p></div><button className="jefe-btn" onClick={() => go(k.sin_asignar ? 'asignaciones' : 'seguimiento')}>{k.sin_asignar ? 'Ver asignaciones' : 'Ver seguimiento'}</button></div><WorkTable rows={[...trabajos].filter((r) => r.activo && (r.puede_asignar || r.horas_sin_avance >= (k.alerta_tecnica_horas || 72) || String(r.prioridad).toUpperCase() !== 'NORMAL')).sort((a, b) => Number(b.puede_asignar) - Number(a.puede_asignar) || b.horas_sin_avance - a.horas_sin_avance).slice(0, 5)} onAction={open} compact assignment /></section></>;
}
export default function JefeSupervision() {
  const { user, logout } = useContext(AuthContext), state = useSupervision(user);
  const { pathname, search: routeSearch } = useLocation();
  const navigate = useNavigate();
  const accountView = pathname === '/tecnico-jefe/mi-cuenta';
  const requestedSection = new URLSearchParams(routeSearch).get('section');
  const [active, setActive] = useState(sections.some((section) => section.id === requestedSection) ? requestedSection : 'resumen'), [mobile, setMobile] = useState(false), [notifications, setNotifications] = useState(false);
  const [search, setSearch] = useState(''), [tipo, setTipo] = useState(''), [tecnico, setTecnico] = useState(''), [status, setStatus] = useState(''), [scope, setScope] = useState('activos'), [partStatus, setPartStatus] = useState('PENDIENTE');
  const { data, loading, error, notice, open, reload, realtime } = state;
  const { trabajos, tecnicos, repuestos, intervenciones, indicadores: k } = data;
  const section = sections.find((s) => s.id === active);
  const go = (id) => { if (accountView) navigate(`/tecnico-jefe?section=${id}`); setActive(id); setMobile(false); setSearch(''); setTipo(''); setTecnico(''); setStatus(''); setScope('activos'); };
  const reviewNotices = () => { realtime.reloadNotifications(); setNotifications(true); realtime.dismissLatest(); };
  const openNotice = (item) => {
    if (!item.entity) return;
    setNotifications(false); realtime.dismissLatest();
    if (item.type?.startsWith('repuesto') || item.entity.kind === 'repuesto') {
      go('repuestos'); setPartStatus(item.type === 'repuesto_sin_existencia' ? 'SIN_EXISTENCIA' : 'PENDIENTE'); setSearch(String(item.entity.orden_id || item.entity.id)); return;
    }
    const kind = item.entity.kind === 'diagnostico' ? 'diagnostico' : 'orden';
    const id = Number(item.entity.orden_id || item.entity.id);
    const row = trabajos.find((work) => work.tipo === kind && work.id === id) || { tipo: kind, id, key: `${kind}-${id}` };
    if (['diagnostico_creado', 'orden_creada'].includes(item.type)) {
      go('asignaciones');
      if (row.puede_asignar) open('asignar', row);
      else reload();
      return;
    }
    if (item.type === 'orden_irreparable_pendiente') {
      go('irreparables');
      if (row.irreparable_estado === 'PENDIENTE') open('irreparable', row);
      else reload();
      return;
    }
    go(row.puede_asignar ? 'asignaciones' : 'seguimiento'); setScope('todos');
    open('detalle', row);
  };
  const match = (text) => normalize(text).includes(normalize(search));
  const counts = { asignaciones: k.sin_asignar, repuestos: k.repuestos_pendientes, irreparables: k.irreparables_pendientes, alertas: k.atrasados };
  const isWork = ['asignaciones', 'seguimiento', 'diagnosticos_cerrados', 'ordenes_cerradas', 'alertas', 'irreparables'].includes(active);
  const searchPlaceholder = active === 'repuestos' ? 'Buscar orden, pieza, técnico o equipo…'
    : active === 'intervenciones' ? 'Buscar orden, diagnóstico, motivo o responsable…'
      : 'Buscar número, cliente, equipo o técnico…';
  const closedView = active === 'diagnosticos_cerrados' || active === 'ordenes_cerradas';
  const correctionCounts = useMemo(() => {
    const counts = new Map();
    for (const item of intervenciones) {
      const key = item.orden_id ? `orden-${item.orden_id}` : `diagnostico-${item.diagnostico_id}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [intervenciones]);
  const workRows = useMemo(() => trabajos.filter((r) => {
    if (active === 'asignaciones' && !r.puede_asignar) return false;
    if (active === 'alertas' && !(r.activo && r.horas_sin_avance >= (k.alerta_tecnica_horas || 72))) return false;
    if (active === 'irreparables' && !(r.tipo === 'orden' && r.estado === 'IRREPARABLE' && r.irreparable_estado === 'PENDIENTE' && r.justificacion_irreparable)) return false;
    if (active === 'diagnosticos_cerrados' && !(r.tipo === 'diagnostico' && closedDiagnostics.has(r.estado))) return false;
    if (active === 'ordenes_cerradas' && !(r.tipo === 'orden' && isClosedOrder(r))) return false;
    if (active === 'seguimiento' && scope === 'activos' && !r.activo) return false;
    return (!tipo || r.tipo === tipo) && (!tecnico || String(r.tecnico?.id_tecnico) === tecnico) && (!status || r.estado === status) && normalize(`${r.id} ${r.equipo_nombre} ${r.cliente_nombre} ${r.tecnico?.nombre || ''}`).includes(normalize(search));
  }), [trabajos, active, scope, tipo, tecnico, status, search, k.alerta_tecnica_horas]);
  const partRows = repuestos.filter((r) => (!partStatus || (partStatus === 'POR_ENTREGAR' ? r.estado_aprobacion === 'APROBADO' && r.estado_entrega === 'PENDIENTE' : partStatus === 'SIN_EXISTENCIA' ? r.estado_entrega === 'SIN_EXISTENCIA' : r.estado_aprobacion === partStatus)) && match(`${r.orden_id} ${r.repuesto?.nombre || r.pieza_solicitada} ${r.tecnico_solicitante?.nombre || ''} ${r.orden?.diagnostico?.equipo?.tipo || ''} ${r.orden?.diagnostico?.equipo?.marca || ''} ${r.orden?.diagnostico?.equipo?.modelo || ''} ${r.orden?.diagnostico?.falla_reportada || ''}`));
  const interventionRows = intervenciones.filter((r) => match(`${r.orden_id || r.diagnostico_id} ${interventionTitle(r.tipo)} ${r.motivo} ${r.datos_nuevos?.aclaracion || ''} ${r.usuario?.nombre_usuario || ''}`));
  if (user && !state.allowed) return <Navigate to="/" replace />;
  return <div className="jefe-panel">{mobile && <button className="jefe-mobile-shade" aria-label="Cerrar navegación" onClick={() => setMobile(false)} />}
    <aside className={`jefe-sidebar ${mobile ? 'open' : ''}`} aria-label="Navegación del jefe técnico"><div className="jefe-brand"><BrandLogo className="h-9 w-9" /><div><strong>SGR · Taller</strong><small>Coordinación técnica</small></div></div><div className="jefe-nav-caption">Administración del taller</div><nav className="jefe-nav">{sections.map((s) => <button key={s.id} aria-current={!accountView && active === s.id ? 'page' : undefined} onClick={() => go(s.id)}><s.icon size={17} /><span>{s.title}</span>{counts[s.id] > 0 && <span className="jefe-nav-count">{counts[s.id]}</span>}</button>)}</nav><div className="jefe-sidebar-footer"><p>{user?.personName || user?.username}</p><small>Jefe Técnico · Supervisión</small><Link to="/tecnico-jefe/mi-cuenta" aria-current={accountView ? 'page' : undefined} className="mt-3 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-200 hover:bg-indigo-500/20 hover:text-white"><UserRound size={15} /> Mi cuenta</Link><button onClick={logout}><LogOut size={15} /> Cerrar sesión</button></div></aside>
    <div className="jefe-workspace"><header className="jefe-topbar"><div className="jefe-topbar-left"><button className="jefe-icon-btn jefe-mobile-menu" aria-label="Abrir navegación" aria-expanded={mobile} onClick={() => setMobile(!mobile)}><Menu size={18} /></button><span>Panel del Jefe Técnico</span><strong>{accountView ? 'Mi cuenta' : section.title}</strong></div><div className="jefe-topbar-right"><time>{new Date().toLocaleDateString('es-NI', { weekday: 'short', day: 'numeric', month: 'long' })}</time>{!accountView && <PageHelp compact />}<div className="relative"><NotificationBell count={realtime.unreadCount} connected={realtime.connected} expanded={notifications} onClick={() => { if (!notifications) realtime.reloadNotifications(); setNotifications(!notifications); }} />{notifications && <NotificationTray notifications={realtime.notifications} total={realtime.unreadCount} connected={realtime.connected} onClear={realtime.clearNotifications} onRead={realtime.markNotificationRead} clearing={realtime.clearing} loading={realtime.loadingHistory} error={realtime.notificationsError} onClose={() => setNotifications(false)} onOpen={openNotice} />}</div></div></header>
    <main className="jefe-main">{accountView ? <MiCuenta /> : <>{active === 'resumen' && k.sin_asignar > 0 && <section aria-label="Asignaciones pendientes" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm"><div className="rounded-xl bg-amber-600 p-2.5 text-white"><ClipboardList size={23} /></div><div className="min-w-0 flex-1"><h2 className="text-base font-extrabold">{k.sin_asignar} {k.sin_asignar === 1 ? 'trabajo pendiente' : 'trabajos pendientes'} de asignación</h2><p className="mt-1 text-sm">Asigna un técnico para que puedan comenzar.</p></div><button type="button" className="jefe-btn primary" onClick={() => go('asignaciones')}>Ver asignaciones</button></section>}
      <NotificationSummary notifications={realtime.notifications} count={realtime.unreadCount} onReview={reviewNotices} onOpen={openNotice} /><div className="jefe-heading"><div><div className="jefe-eyebrow">Control técnico</div><h1>{section.title}</h1><p>{section.description}</p></div><button className="jefe-btn" disabled={loading} onClick={reload}><RefreshCw size={14} /><span>Actualizar</span></button></div>{error && <div className="jefe-message error" role="alert">{error}<button onClick={reload}>Reintentar</button></div>}{notice && <div className="jefe-message" role="status">{notice}</div>}
      {loading ? <div className="jefe-card jefe-loading"><RefreshCw size={24} className="jefe-spinner" /><p>Cargando información del taller…</p></div> : <>
        {active === 'resumen' && <Overview data={data} go={go} open={open} />}
        {active === 'tecnicos' && <><div className="jefe-toolbar" style={{ border: 0, padding: '0 0 20px' }}><div className="jefe-search"><Search size={15} /><input aria-label="Buscar técnico" placeholder="Buscar por nombre o especialidad…" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div><TeamCards rows={tecnicos.filter((t) => match(`${t.nombre} ${t.especialidad || ''}`))} onAction={open} onFilter={(t) => { go('seguimiento'); setTecnico(String(t.id_tecnico)); }} /></>}
        {active !== 'resumen' && active !== 'tecnicos' && <section className="jefe-card"><div className="jefe-toolbar"><div className="jefe-search"><Search size={15} /><input aria-label="Buscar registros" placeholder={searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {isWork && active !== 'irreparables' && <>{!closedView && <select aria-label="Filtrar tipo de trabajo" className="jefe-select" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos los trabajos</option><option value="diagnostico">Diagnósticos</option><option value="orden">Reparaciones</option></select>}<select aria-label="Filtrar técnico" className="jefe-select" value={tecnico} onChange={(e) => setTecnico(e.target.value)}><option value="">Todos los técnicos</option>{tecnicos.map((t) => <option key={t.id_tecnico} value={t.id_tecnico}>{t.nombre}</option>)}</select></>}
          {active === 'seguimiento' && <><select aria-label="Filtrar estado" className="jefe-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos los estados</option>{['PENDIENTE', 'ASIGNADO', 'EN_REVISION', 'EN_REPARACION', 'ESPERANDO_PIEZA', 'COMPLETADO', 'FINALIZADO', 'IRREPARABLE', 'ENTREGADO', 'CANCELADO'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select><select aria-label="Filtrar trabajos activos o todos" className="jefe-select" value={scope} onChange={(e) => setScope(e.target.value)}><option value="activos">Activos</option><option value="todos">Todos</option></select></>}
          {active === 'repuestos' && <select aria-label="Filtrar solicitudes de repuestos" className="jefe-select" value={partStatus} onChange={(e) => setPartStatus(e.target.value)}><option value="PENDIENTE">Pendientes de aprobación</option><option value="POR_ENTREGAR">Aprobados por entregar</option><option value="SIN_EXISTENCIA">Sin existencias</option><option value="APROBADO">Aprobados</option><option value="DENEGADO">Rechazados</option><option value="">Todas las solicitudes</option></select>}
          <span className="jefe-count">{isWork ? workRows.length : active === 'repuestos' ? partRows.length : interventionRows.length} registros</span></div>
          {isWork && <WorkTable rows={workRows} onAction={open} assignment={active === 'asignaciones'} irreparable={active === 'irreparables'} closed={closedView} correctionCount={(r) => (correctionCounts.get(r.key) || 0) + (r.tipo === 'orden' ? correctionCounts.get(`diagnostico-${r.diagnostico_id}`) || 0 : 0)} />}{active === 'repuestos' && <PartsTable rows={partRows} onAction={open} />}{active === 'intervenciones' && <InterventionTable rows={interventionRows} onOpenWork={(item) => { const kind = item.orden_id ? 'orden' : 'diagnostico'; const id = item.orden_id || item.diagnostico_id; const row = trabajos.find((work) => work.tipo === kind && work.id === id); if (row) open('detalle', row); }} />}
        </section>}
      </>}</>}
    </main></div>{state.dialog && <SupervisionDialog key={`${state.dialog.action}-${state.dialog.row.key || state.dialog.row.id || state.dialog.row.id_tecnico || state.dialog.row.id_detalle_repuesto}`} state={state} />}
  <NotificationToast notification={realtime.latestNotification} onClose={realtime.dismissLatest} onReview={reviewNotices} onOpen={openNotice} /></div>;
}
