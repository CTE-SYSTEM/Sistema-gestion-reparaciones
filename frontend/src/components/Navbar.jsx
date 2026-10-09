import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Menu, UserRound } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { NotificationTray } from './NotificationTray';
import { NotificationBell, NotificationToast } from './NotificationAttention';
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications';
import { secretaryNotificationTarget } from '../utils/notificationInbox';

const normalizeRole = (role) => String(role || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[\s_-]/g, '')
  .toLowerCase();

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const isCustomerArea = ['secretaria', 'serviciocliente'].includes(normalizeRole(user?.rol));
  const isAdmin = ['administrador', 'adminpro', 'admin'].includes(normalizeRole(user?.rol));
  const hasInbox = ['secretaria', 'serviciocliente', 'bodega', 'calidad', 'reclamos', 'garantias', 'contabilidad'].includes(normalizeRole(user?.rol)) || isAdmin;
  const {
    notifications,
    connected: socketConnected,
    clearNotifications,
    notificationsError, clearing, reloadNotifications, unreadCount, markNotificationRead, loadingHistory,
    latestNotification, dismissLatest,
  } = useRealtimeNotifications({
    enabled: hasInbox,
    persistent: true,
    onRefresh: (notification) => {
      if (isCustomerArea) window.dispatchEvent(new CustomEvent('servicio-cliente:notificacion', { detail: notification }));
    },
    refreshIntervalMs: 0,
  });

  const reviewNotices = () => { reloadNotifications(); setShowNotifications(true); dismissLatest(); };
  const openNotice = (item) => {
    const adminPaths = { diagnostico: '/admin/diagnosticos', orden: '/admin/ordenes', repuesto: '/admin/inventario', reclamo: '/reclamos' };
    const role = normalizeRole(user?.rol);
    const target = isAdmin ? (adminPaths[item.entity?.kind] || '/admin')
      : role === 'bodega' ? (item.entity?.kind === 'compra' ? '/bodega/compras' : item.entity?.kind === 'repuesto' ? '/bodega/entregas' : '/bodega/repuestos')
        : role === 'calidad' ? '/calidad'
          : role === 'reclamos' ? '/reclamos'
            : role === 'garantias' ? (item.entity?.kind === 'reclamo' ? '/garantias/reclamos' : '/garantias')
              : role === 'contabilidad' ? (item.type === 'movimiento_contable' ? '/contabilidad/movimientos' : '/contabilidad/facturacion')
                : role === 'serviciocliente' ? (item.entity?.kind === 'reclamo' ? '/servicio-cliente/reclamos'
                  : item.type === 'diagnostico_completado' ? '/servicio-cliente/nueva-orden'
                    : ['calidad_aprobada', 'irreparable_confirmado'].includes(item.type) ? '/servicio-cliente/facturacion'
                      : item.type === 'factura_creada' ? '/servicio-cliente/entregas' : '/servicio-cliente/flujo-atencion')
                : role === 'secretaria' ? secretaryNotificationTarget(item) : '/secretaria/nueva-orden';
    navigate(target);
    setShowNotifications(false); dismissLatest();
  };

  return (
    <><header className="app-navbar flex items-center justify-between border-b bg-white px-5 py-3 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 lg:hidden"
          aria-label="Abrir menu"
          title="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            {hasInbox && (
              <div className="relative">
                <NotificationBell count={unreadCount} connected={socketConnected} expanded={showNotifications}
                  onClick={() => { if (!showNotifications) reloadNotifications(); setShowNotifications((value) => !value); }} />

                {showNotifications && (
                  <NotificationTray
                    notifications={notifications}
                    total={unreadCount}
                    connected={socketConnected}
                    onClear={clearNotifications}
                    onRead={markNotificationRead}
                    loading={loadingHistory}
                    clearing={clearing}
                    error={notificationsError}
                    onOpen={openNotice}
                    onClose={() => setShowNotifications(false)}
                  />
                )}
              </div>
            )}

            <Link to={isAdmin ? '/admin/mi-cuenta' : '/mi-cuenta'} aria-label="Abrir Mi cuenta" className="flex items-center gap-3 rounded-xl p-1 transition hover:bg-slate-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-sm font-black text-white">
                {(user.personName || user.username)?.charAt(0).toUpperCase() || <UserRound className="h-5 w-5" />}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-bold text-gray-800">{user.personName || user.username}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{user.rol === 'Secretaria' ? 'Operación integral' : user.rol}</div>
              </div>
            </Link>

            <button
              type="button"
              onClick={logout}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 text-sm font-bold text-red-600 transition hover:border-red-200 hover:bg-red-600 hover:text-white"
              title="Cerrar sesion"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </>
        ) : (
          <Link to="/login" className="text-sm font-semibold text-indigo-600">Iniciar sesion</Link>
        )}
      </div>
    </header><NotificationToast notification={latestNotification} onClose={dismissLatest} onReview={reviewNotices} onOpen={openNotice} /></>
  );
};

export default Navbar;
