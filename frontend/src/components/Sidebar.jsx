import React, { useContext, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  DatabaseBackup,
  Settings,
  SlidersHorizontal,
  UserRound,
  Boxes,
  BriefcaseBusiness,
  ClipboardCheck,
  ClipboardList,
  ClipboardPenLine,
  ContactRound,
  ChevronDown,
  Cpu,
  FileCheck,
  FilePlus2,
  FileText,
  Handshake,
  History,
  Laptop,
  LayoutDashboard,
  LogOut,
  Monitor,
  MonitorCog,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  PackageSearch,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SquareKanban,
  Stethoscope,
  Tags,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  WalletCards,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const adminRoles = ['Administrador', 'admin_pro', 'Admin'];

const allMenuItems = [
  { name: 'Resumen', to: '/admin', roles: adminRoles, icon: LayoutDashboard, group: 'Taller' },
  { name: 'Reclamos', to: '/reclamos', roles: adminRoles, icon: ClipboardList, group: 'Gestión' },
  { name: 'Control de calidad', to: '/calidad', roles: adminRoles, icon: ClipboardCheck, group: 'Gestión' },
  { name: 'Piezas entregadas', to: '/bodega/entregas', roles: adminRoles, icon: PackageSearch, group: 'Gestión' },
  { name: 'Inventario de bodega', to: '/bodega/inventario', roles: adminRoles, icon: Boxes, group: 'Gestión' },
  { name: 'Movimientos contables', to: '/contabilidad/movimientos', roles: adminRoles, icon: WalletCards, group: 'Gestión' },
  { name: 'Clientes', to: '/admin/clientes', roles: adminRoles, icon: ContactRound, group: 'Gestión' },
  { name: 'Equipos', to: '/admin/equipos', roles: adminRoles, icon: Laptop, group: 'Gestión' },
  { name: 'Diagnósticos', to: '/admin/diagnosticos', roles: adminRoles, icon: ClipboardCheck, group: 'Gestión' },
  { name: 'Órdenes', to: '/admin/ordenes', roles: adminRoles, icon: ClipboardList, group: 'Gestión' },
  { name: 'Flujo de atención', to: '/admin/flujo-atencion', roles: adminRoles, icon: SquareKanban, group: 'Gestión' },
  { name: 'Facturas', to: '/admin/visualizacion-control-facturas', roles: adminRoles, icon: FileText, group: 'Gestión' },
  { name: 'Garantías', to: '/admin/garantias', roles: adminRoles, icon: ShieldCheck, group: 'Gestión' },
  { name: 'Inventario', to: '/admin/inventario', roles: adminRoles, icon: Package, group: 'Gestión' },
  { name: 'Centro de reportes', to: '/admin/reportes', roles: adminRoles, icon: BarChart3, group: 'Reportes' },
  { name: 'Administración', to: '/admin/administracion', roles: adminRoles, icon: Settings, group: 'Administración' },
  { name: 'Usuarios y acceso', to: '/admin/usuarios', roles: adminRoles, icon: UserCog, group: 'Administración' },
  { name: 'Negocio', to: '/admin/configuracion', roles: adminRoles, icon: Building2, group: 'Administración' },
  { name: 'Reglas del negocio', to: '/admin/reglas', roles: adminRoles, icon: SlidersHorizontal, group: 'Administración' },
  { name: 'Respaldos', to: '/admin/respaldos', roles: adminRoles, icon: DatabaseBackup, group: 'Administración' },
  { name: 'Auditoría', to: '/admin/auditoria', roles: adminRoles, icon: History, group: 'Administración' },

  { name: 'Inicio integral', to: '/secretaria', roles: ['Secretaria'], icon: BriefcaseBusiness },
  { name: 'Clientes', to: '/secretaria/clientes', roles: ['Secretaria'], icon: ContactRound, group: 'Recepción' },
  { name: 'Equipos', to: '/secretaria/equipos', roles: ['Secretaria'], icon: MonitorCog, group: 'Recepción' },
  { name: 'Diagnóstico', to: '/secretaria/diagnostico', roles: ['Secretaria'], icon: ClipboardPenLine, group: 'Recepción' },
  { name: 'Nueva orden', to: '/secretaria/nueva-orden', roles: ['Secretaria'], icon: FilePlus2, group: 'Servicio al cliente' },
  { name: 'Flujo de atención', to: '/secretaria/flujo-atencion', roles: ['Secretaria'], icon: SquareKanban, group: 'Servicio al cliente' },
  { name: 'Facturación y entrega', to: '/secretaria/facturacion', roles: ['Secretaria'], icon: Receipt, group: 'Servicio al cliente' },
  { name: 'Inventario', to: '/bodega/inventario', roles: ['Secretaria'], icon: Boxes, group: 'Bodega' },
  { name: 'Repuestos', to: '/secretaria/repuestos', roles: ['Secretaria'], icon: PackageSearch, group: 'Bodega' },
  { name: 'Tipos de repuesto', to: '/secretaria/tipos-repuesto', roles: ['Secretaria'], icon: Tags, group: 'Bodega' },
  { name: 'Compras', to: '/secretaria/compras', roles: ['Secretaria'], icon: ShoppingBag, group: 'Bodega' },
  { name: 'Proveedores', to: '/secretaria/proveedores', roles: ['Secretaria'], icon: Handshake, group: 'Bodega' },
  { name: 'Entregas de piezas', to: '/bodega/entregas', roles: ['Secretaria'], icon: PackageSearch, group: 'Bodega' },
  { name: 'Control de calidad', to: '/calidad', roles: ['Secretaria'], icon: ClipboardCheck, group: 'Calidad y posventa' },
  { name: 'Reclamos', to: '/reclamos', roles: ['Secretaria'], icon: ClipboardList, group: 'Calidad y posventa' },
  { name: 'Garantías', to: '/garantias', roles: ['Secretaria'], icon: ShieldCheck, group: 'Calidad y posventa' },
  { name: 'Reportes del taller', to: '/secretaria/reportes', roles: ['Secretaria'], icon: FileText },

  { name: 'Inicio', to: '/recepcion', roles: ['Recepcion'], icon: LayoutDashboard },
  { name: 'Clientes', to: '/recepcion/clientes', roles: ['Recepcion'], icon: ContactRound },
  { name: 'Equipos', to: '/recepcion/equipos', roles: ['Recepcion'], icon: MonitorCog },
  { name: 'Recepción', to: '/recepcion/diagnostico', roles: ['Recepcion'], icon: ClipboardPenLine },
  { name: 'Flujo de atención', to: '/recepcion/flujo-atencion', roles: ['Recepcion'], icon: SquareKanban },
  { name: 'Inicio', to: '/servicio-cliente', roles: ['ServicioCliente'], icon: LayoutDashboard },
  { name: 'Nueva orden', to: '/servicio-cliente/nueva-orden', roles: ['ServicioCliente'], icon: FilePlus2 },
  { name: 'Facturación', to: '/servicio-cliente/facturacion', roles: ['ServicioCliente'], icon: Receipt },
  { name: 'Flujo de atención', to: '/servicio-cliente/flujo-atencion', roles: ['ServicioCliente'], icon: SquareKanban },
  { name: 'Reclamos', to: '/servicio-cliente/reclamos', roles: ['ServicioCliente'], icon: ClipboardList },
  { name: 'Inicio', to: '/bodega', roles: ['Bodega'], icon: LayoutDashboard },
  { name: 'Inventario', to: '/bodega/inventario', roles: ['Bodega'], icon: Boxes },
  { name: 'Repuestos', to: '/bodega/repuestos', roles: ['Bodega'], icon: PackageSearch },
  { name: 'Tipos de repuesto', to: '/bodega/tipos-repuesto', roles: ['Bodega'], icon: Tags },
  { name: 'Compras', to: '/bodega/compras', roles: ['Bodega'], icon: ShoppingBag },
  { name: 'Proveedores', to: '/bodega/proveedores', roles: ['Bodega'], icon: Handshake },
  { name: 'Entregas de piezas', to: '/bodega/entregas', roles: ['Bodega'], icon: PackageSearch },
  { name: 'Control de calidad', to: '/calidad', roles: ['Calidad'], icon: ClipboardCheck },
  { name: 'Reclamos', to: '/reclamos', roles: ['Reclamos'], icon: ClipboardList },
  { name: 'Garantías', to: '/garantias', roles: ['Garantias'], icon: ShieldCheck },
  { name: 'Coberturas', to: '/garantias/reclamos', roles: ['Garantias'], icon: FileCheck },
  { name: 'Inicio', to: '/contabilidad', roles: ['Contabilidad'], icon: LayoutDashboard },
  { name: 'Movimientos', to: '/contabilidad/movimientos', roles: ['Contabilidad'], icon: WalletCards },
  { name: 'Facturas', to: '/contabilidad/facturacion', roles: ['Contabilidad'], icon: Receipt },
  { name: 'Reportes financieros', to: '/contabilidad/reportes', roles: ['Contabilidad'], icon: BarChart3 },

  { name: 'Dashboard', to: '/tecnico-jefe', roles: ['TecnicoJefe'], icon: LayoutDashboard },
  { name: 'Dashboard', to: '/tecnico', roles: ['Tecnico'], icon: LayoutDashboard },
];

const adminMenu = [
  { type: 'link', item: allMenuItems[0] },
  { type: 'group', name: 'Gestión', icon: BriefcaseBusiness, items: allMenuItems.filter((item) => item.group === 'Gestión') },
  { type: 'link', item: allMenuItems.find((item) => item.to === '/admin/reportes') },
  { type: 'group', name: 'Administración', icon: Settings, items: allMenuItems.filter((item) => item.group === 'Administración') },
];

const secretaryMenu = [
  { type: 'link', item: allMenuItems.find((item) => item.to === '/secretaria') },
  { type: 'group', name: 'Recepción', icon: ContactRound },
  { type: 'group', name: 'Servicio al cliente', icon: Receipt },
  { type: 'group', name: 'Bodega', icon: Boxes },
  { type: 'group', name: 'Calidad y posventa', icon: ShieldCheck },
  { type: 'link', item: allMenuItems.find((item) => item.to === '/secretaria/reportes') },
].map((section) => section.type === 'group'
  ? { ...section, items: allMenuItems.filter((item) => item.roles.includes('Secretaria') && item.group === section.name) }
  : section);

const groupForPath = (path, items) => items.find((item) => item.group && path === item.to)?.group
  || items.find((item) => item.group && path.startsWith(`${item.to}/`))?.group;

const Sidebar = ({ collapsed = false, onClose = () => {}, onToggleCollapse = () => {}, open = true }) => {
  const { user, logout } = useContext(AuthContext);
  const { pathname } = useLocation();
  const isAdmin = adminRoles.includes(user?.rol);
  const isSecretary = user?.rol === 'Secretaria';
  const menuItems = allMenuItems.filter((item) => item.roles.includes(user?.rol));
  const sections = isAdmin ? adminMenu : isSecretary ? secretaryMenu : null;
  const [openGroup, setOpenGroup] = useState(() => groupForPath(pathname, menuItems) || null);

  useEffect(() => {
    if (isSecretary) {
      const activeGroup = groupForPath(pathname, menuItems);
      if (activeGroup) setOpenGroup(activeGroup);
    }
  }, [pathname, isSecretary]);

  const renderLink = (item) => (
    <NavLink
      to={item.to}
      end={item.to === '/admin' || item.to === '/secretaria' || item.to === '/recepcion' || item.to === '/bodega' || item.to === '/contabilidad'}
      onClick={onClose}
      className={({ isActive }) =>
        `sidebar-nav-link flex w-full min-w-0 items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
        ${isActive
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
          : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`
      }
      title={collapsed ? item.name : undefined}
    >
      <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span className="sidebar-nav-label min-w-0 flex-1 truncate text-sm font-medium tracking-wide">{item.name}</span>
    </NavLink>
  );

  const toggleGroup = (name) => {
    setOpenGroup(openGroup === name && !collapsed ? null : name);
    if (collapsed) onToggleCollapse();
  };

  return (
    <aside
      className={`app-sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''} flex flex-col bg-[#0f1724] text-white`}
      aria-label="Barra lateral de navegación"
    >
      <div className="sidebar-header p-4 border-b border-gray-800 flex flex-col items-center lg:items-start gap-3">
        <div className="sidebar-brand-row flex w-full items-center justify-center gap-3 lg:justify-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/15 text-indigo-200 shadow-lg shadow-indigo-950/20">
            <Boxes className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="sidebar-brand-copy min-w-0">
            <div className="truncate text-sm font-black uppercase tracking-wide text-white">Sistema</div>
            <div className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300">Gestion operativa</div>
          </div>
        </div>
        <div className="sidebar-user-panel w-full overflow-hidden">
          <div className="text-sm font-semibold truncate text-gray-100">{user?.personName || user?.username}</div>
          <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{user?.rol === 'Secretaria' ? 'Operación integral' : user?.rol}</div>
        </div>
        <button
          type="button"
          className="sidebar-collapse-toggle inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-300/20 px-2 py-1.5 text-xs font-semibold text-indigo-100 transition hover:border-indigo-300/40 hover:bg-indigo-500/15"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expandir barra lateral' : 'Minimizar barra lateral'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expandir barra lateral' : 'Minimizar barra lateral'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
          <span>{collapsed ? 'Expandir' : 'Minimizar'}</span>
        </button>
      </div>

      <nav className="p-2 flex-1 overflow-y-auto custom-scrollbar">
        <ul className="space-y-1">
          {sections ? sections.map((section) => {
            if (section.type === 'link') {
              return <li key={section.item.to} className="w-full">{renderLink(section.item)}</li>;
            }
            const expanded = openGroup === section.name && !collapsed;
            const active = groupForPath(pathname, menuItems) === section.name;
            const groupId = `sidebar-group-${section.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')}`;
            return <li key={section.name} className="w-full">
              <button
                type="button"
                className={`sidebar-group-toggle flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${active ? 'bg-indigo-500/15 text-indigo-100' : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'}`}
                onClick={() => toggleGroup(section.name)}
                aria-expanded={expanded}
                aria-controls={groupId}
                title={collapsed ? section.name : undefined}
              >
                <section.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span className="sidebar-nav-label min-w-0 flex-1 truncate">{section.name}</span>
                <ChevronDown className={`sidebar-nav-chevron h-4 w-4 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              <ul id={groupId} hidden={!expanded} className="mt-1 space-y-1 border-l border-indigo-400/20 pl-2 ml-5">
                {section.items.map((item) => <li key={item.to}>{renderLink(item)}</li>)}
              </ul>
            </li>;
          }) : menuItems.map((item) => <li key={item.to + item.name} className="w-full">{renderLink(item)}</li>)}
        </ul>
      </nav>

      <div className="sidebar-footer shrink-0 space-y-2 border-t border-gray-800 bg-[#0b111a] p-3">
        <NavLink to={isAdmin ? '/admin/mi-cuenta' : '/mi-cuenta'} onClick={onClose} title="Mi cuenta" aria-label="Mi cuenta" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/15"><UserRound className="h-4 w-4 shrink-0" /><span className="sidebar-footer-label">Mi cuenta</span></NavLink>
        <button type="button" onClick={() => logout()} title="Salir" aria-label="Salir" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"><LogOut className="h-4 w-4 shrink-0" /><span className="sidebar-footer-label">Salir</span></button>
        <div className="sidebar-footer-meta text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">
          Sistema de Gestion
        </div>
        <div className="sidebar-footer-meta text-[10px] text-gray-600 flex justify-between items-center">
          <span>v0.1 Beta</span>
          <span className="px-1.5 py-0.5 rounded bg-gray-800">2026</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
