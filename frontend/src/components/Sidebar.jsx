import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
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
  Cpu,
  FileCheck,
  FilePlus2,
  FileText,
  Handshake,
  History,
  Laptop,
  LayoutDashboard,
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
  { name: 'Mi cuenta', to: '/admin/mi-cuenta', roles: adminRoles, icon: UserRound, group: 'Administración' },
  { name: 'Usuarios y acceso', to: '/admin/usuarios', roles: adminRoles, icon: UserCog, group: 'Administración' },
  { name: 'Negocio', to: '/admin/configuracion', roles: adminRoles, icon: Building2, group: 'Administración' },
  { name: 'Reglas del negocio', to: '/admin/reglas', roles: adminRoles, icon: SlidersHorizontal, group: 'Administración' },
  { name: 'Respaldos', to: '/admin/respaldos', roles: adminRoles, icon: DatabaseBackup, group: 'Administración' },
  { name: 'Auditoría', to: '/admin/auditoria', roles: adminRoles, icon: History, group: 'Administración' },

  { name: 'Dashboard', to: '/secretaria', roles: ['Secretaria'], icon: BriefcaseBusiness },
  { name: 'Clientes', to: '/secretaria/clientes', roles: ['Secretaria'], icon: ContactRound },
  { name: 'Equipos', to: '/secretaria/equipos', roles: ['Secretaria'], icon: MonitorCog },
  { name: 'Diagnostico', to: '/secretaria/diagnostico', roles: ['Secretaria'], icon: ClipboardPenLine },
  { name: 'Nueva Orden', to: '/secretaria/nueva-orden', roles: ['Secretaria'], icon: FilePlus2 },
  { name: 'Flujo atencion', to: '/secretaria/flujo-atencion', roles: ['Secretaria'], icon: SquareKanban },
  { name: 'Repuestos', to: '/secretaria/repuestos', roles: ['Secretaria'], icon: PackageSearch },
  { name: 'Tipos Repuesto', to: '/secretaria/tipos-repuesto', roles: ['Secretaria'], icon: Tags },
  { name: 'Compras', to: '/secretaria/compras', roles: ['Secretaria'], icon: ShoppingBag },
  { name: 'Proveedores', to: '/secretaria/proveedores', roles: ['Secretaria'], icon: Handshake },
  { name: 'Facturacion', to: '/secretaria/facturacion', roles: ['Secretaria'], icon: Receipt },

  { name: 'Dashboard', to: '/tecnico-jefe', roles: ['TecnicoJefe'], icon: LayoutDashboard },
  { name: 'Dashboard', to: '/tecnico', roles: ['Tecnico'], icon: LayoutDashboard },
];

const Sidebar = ({ collapsed = false, onClose = () => {}, onToggleCollapse = () => {}, open = true }) => {
  const { user } = useContext(AuthContext);
  const menuItems = allMenuItems.filter((item) => item.roles.includes(user?.rol));

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
          <div className="text-sm font-semibold truncate text-gray-100">{user?.username}</div>
          <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{user?.rol}</div>
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
          {menuItems.map((item, index) => (
            <li key={item.to + item.name} className="w-full">
              {item.group && item.group !== menuItems[index - 1]?.group && !collapsed && <div className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-indigo-300/70">{item.group}</div>}
              <NavLink
                to={item.to}
                end={item.to === '/admin' || item.to === '/secretaria'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex w-full min-w-0 items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                  ${isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`
                }
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium tracking-wide">
                  {item.name}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer bg-[#0b111a] p-4 border-t border-gray-800">
        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">
          Sistema de Gestion
        </div>
        <div className="text-[10px] text-gray-600 flex justify-between items-center">
          <span>v0.1 Beta</span>
          <span className="px-1.5 py-0.5 rounded bg-gray-800">2026</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
