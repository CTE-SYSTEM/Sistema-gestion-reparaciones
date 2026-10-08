import React, { Suspense, lazy, useEffect, useState, useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, Outlet, Navigate, useLocation } from 'react-router-dom';
import useResponsiveLayout from './features/responsive/useResponsiveLayout';

// Componentes Globales
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import PageHelp from './components/PageHelp';

// Contexto de Autenticación
import { AuthProvider, AuthContext } from './context/AuthContext';
import { PersonalizacionProvider } from './features/personalizacion';

import './App.css';

// Las páginas se cargan bajo demanda para no inflar el JavaScript inicial.
const Login = lazy(() => import('./pages/Auth/Login'));
const RecuperarPassword = lazy(() => import('./pages/Auth/RecuperarPassword'));
const FotoTemporal = lazy(() => import('./features/shared/pages/FotoTemporal'));

const AdminDashboard = lazy(() => import('./features/admin/pages/AdminDashboard'));
const Administracion = lazy(() => import('./features/admin/pages/Administracion'));
const MiCuenta = lazy(() => import('./features/admin/pages/MiCuenta'));
const ConfiguracionNegocio = lazy(() => import('./features/admin/pages/ConfiguracionNegocio'));
const ReglasNegocio = lazy(() => import('./features/admin/pages/ReglasNegocio'));
const Auditoria = lazy(() => import('./features/admin/pages/Auditoria'));
const Respaldos = lazy(() => import('./features/admin/pages/Respaldos'));
const Reportes = lazy(() => import('./features/admin/pages/Reportes'));
const UsuariosAvanzado = lazy(() => import('./features/admin/pages/UsuariosAvanzado'));
const EquiposAvanzado = lazy(() => import('./features/admin/pages/EquiposAvanzado'));
const OrdenesAvanzado = lazy(() => import('./features/admin/pages/OrdenesAvanzado'));
const InventarioAvanzado = lazy(() => import('./features/admin/pages/InventarioAvanzado'));
const FacturasAvanzado = lazy(() => import('./features/admin/pages/FacturasAvanzado'));
const GarantiasAvanzado = lazy(() => import('./features/admin/pages/GarantiasAvanzado'));
const HistorialEquipo = lazy(() => import('./features/admin/pages/HistorialEquipo'));
const HistorialRepuesto = lazy(() => import('./features/admin/pages/HistorialRepuesto'));
const RepuestosAvanzado = lazy(() => import('./features/admin/pages/RepuestosAvanzado'));
const ComprasAvanzado = lazy(() => import('./features/admin/pages/ComprasAvanzado'));
const RendimientoTecnicos = lazy(() => import('./features/admin/pages/RendimientoTecnicos'));
const OrdenesEstadoAvanzado = lazy(() => import('./features/admin/pages/OrdenesEstadoAvanzado'));
const DiagnosticosEstadoAvanzado = lazy(() => import('./features/admin/pages/DiagnosticosEstadoAvanzado'));
const ClientesAvanzado = lazy(() => import('./features/admin/pages/ClientesAvanzado'));
const Ganancias = lazy(() => import('./features/admin/pages/Ganancias'));
const FlujoAtencion = lazy(() => import('./features/recepcion/pages/FlujoAtencion'));

const SecretariaDashboard = lazy(() => import('./features/secretaria/pages/SecretariaDashboard'));
const ClientesRecepcion = lazy(() => import('./features/recepcion/pages/Clientes'));
const EquiposRecepcion = lazy(() => import('./features/recepcion/pages/Equipos'));
const ProveedoresBodega = lazy(() => import('./features/bodega/pages/Proveedores'));
const RepuestosBodega = lazy(() => import('./features/bodega/pages/Repuestos'));
const TiposRepuestoBodega = lazy(() => import('./features/bodega/pages/TiposRepuesto'));
const ComprasBodega = lazy(() => import('./features/bodega/pages/Compras'));
const FacturacionContabilidad = lazy(() => import('./features/contabilidad/pages/Facturacion'));
const Diagnostico = lazy(() => import('./features/recepcion/pages/Diagnostico'));
const NuevaOrden = lazy(() => import('./features/recepcion/pages/NuevaOrden'));
const Entregas = lazy(() => import('./features/recepcion/pages/Entregas'));

const TecnicoDashboard = lazy(() => import('./features/tecnico/pages/TecnicoDashboard'));
const JefeDashboard = lazy(() => import('./features/tecnicoJefe/pages/TecnicoJefeDashboard'));
const CalidadPage = lazy(() => import('./features/calidad/pages/CalidadPage'));
const GarantiasPage = lazy(() => import('./features/garantias/pages/GarantiasPage'));
const ReclamosPage = lazy(() => import('./features/reclamos/pages/ReclamosPage'));
const MovimientosPage = lazy(() => import('./features/contabilidad/pages/MovimientosPage'));
const TrazabilidadPage = lazy(() => import('./features/bodega/pages/TrazabilidadPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const location = useLocation();
  const isAdminRoute = location.pathname === '/' || location.pathname.startsWith('/admin');
  const isAreaRoute = ['/secretaria', '/recepcion', '/bodega', '/contabilidad'].some(
    (area) => location.pathname === area || location.pathname.startsWith(`${area}/`),
  );

  useEffect(() => {
    window.localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    document.documentElement.classList.add('app-shell-active');
    document.body.classList.add('app-shell-active');

    return () => {
      document.documentElement.classList.remove('app-shell-active');
      document.body.classList.remove('app-shell-active');
    };
  }, []);

  const toggleSidebar = () => setSidebarOpen((s) => !s);
  const toggleSidebarCollapse = () => setSidebarCollapsed((collapsed) => !collapsed);

  return (
    <div className={`app-shell bg-[var(--bg)] text-[var(--text)] ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menu"
        />
      )}
      <div className="app-shell-main">
        <Navbar onToggleSidebar={toggleSidebar} />
        <main className={`app-main-scroll flex-1 overflow-auto ${isAdminRoute ? 'admin-main' : ''} ${isAreaRoute ? 'secretaria-main' : ''}`}>
          <div className={`mx-auto w-full ${isAdminRoute ? 'admin-content' : ''} ${isAreaRoute ? 'secretaria-content' : ''}`}>
            {!isAreaRoute && <PageHelp />}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm font-semibold text-gray-500">
      Cargando...
    </div>
  );
}

function Page({ children, fullWidth = false }) {
  const responsive = useResponsiveLayout();

  return (
    <Suspense fallback={<RouteFallback />}>
      <div className={`${fullWidth ? 'w-full' : responsive.pageClassName} app-page`}>{children}</div>
    </Suspense>
  );
}

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: (
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      ),
      children: [
        { path: 'login', element: <Page><Login /></Page> },
        { path: 'recuperar-password', element: <Page><RecuperarPassword /></Page> },
        { path: 'foto-temporal/:token', element: <Suspense fallback={<RouteFallback />}><FotoTemporal /></Suspense> },

        // 1. RUTAS CON SIDEBAR Y NAVBAR GLOBAL
        {
          element: <MainLayout />,
          children: [
            { path: 'mi-cuenta', element: <RequireAuth><Page><MiCuenta /></Page></RequireAuth> },
            // Admin
            { index: true, element: <RequireAuth><Page><AdminDashboard /></Page></RequireAuth> },
            { path: 'admin', element: <RequireAuth><Page><AdminDashboard /></Page></RequireAuth> },
            { path: 'admin/administracion', element: <RequireAuth><Page><Administracion /></Page></RequireAuth> },
            { path: 'admin/mi-cuenta', element: <RequireAuth><Page><MiCuenta /></Page></RequireAuth> },
            { path: 'admin/configuracion', element: <RequireAuth><Page><ConfiguracionNegocio /></Page></RequireAuth> },
            { path: 'admin/reglas', element: <RequireAuth><Page><ReglasNegocio /></Page></RequireAuth> },
            { path: 'admin/auditoria', element: <RequireAuth><Page><Auditoria /></Page></RequireAuth> },
            { path: 'admin/respaldos', element: <RequireAuth><Page><Respaldos /></Page></RequireAuth> },
            { path: 'admin/reportes', element: <RequireAuth><Page><Reportes /></Page></RequireAuth> },
            { path: 'admin/usuarios', element: <RequireAuth><Page><UsuariosAvanzado /></Page></RequireAuth> },
            { path: 'admin/equipos', element: <RequireAuth><Page><EquiposAvanzado /></Page></RequireAuth> },
            { path: 'admin/ordenes', element: <RequireAuth><Page><OrdenesAvanzado /></Page></RequireAuth> },
            { path: 'admin/repuestos', element: <RequireAuth><Page><RepuestosAvanzado /></Page></RequireAuth> },
            { path: 'admin/compras', element: <RequireAuth><Page><ComprasAvanzado /></Page></RequireAuth> },
            { path: 'admin/ganancias', element: <RequireAuth><Page><Ganancias /></Page></RequireAuth> },
            { path: 'admin/tecnicos', element: <RequireAuth><Page><RendimientoTecnicos /></Page></RequireAuth> },
            { path: 'admin/clientes', element: <RequireAuth><Page><ClientesAvanzado /></Page></RequireAuth> },
            { path: 'admin/inventario', element: <RequireAuth><Page><InventarioAvanzado /></Page></RequireAuth> },
            { path: 'admin/visualizacion-control-facturas', element: <RequireAuth><Page><FacturasAvanzado /></Page></RequireAuth> },
            { path: 'admin/facturacion', element: <RequireAuth><Page><FacturasAvanzado /></Page></RequireAuth> },
            { path: 'admin/ordenes-estado', element: <RequireAuth><Page><OrdenesEstadoAvanzado /></Page></RequireAuth> },
            { path: 'admin/diagnosticos', element: <RequireAuth><Page><DiagnosticosEstadoAvanzado /></Page></RequireAuth> },
            { path: 'admin/garantias', element: <RequireAuth><Page><GarantiasAvanzado /></Page></RequireAuth> },
            { path: 'admin/historial-equipo', element: <RequireAuth><Page><HistorialEquipo /></Page></RequireAuth> },
            { path: 'admin/historial-repuesto', element: <RequireAuth><Page><HistorialRepuesto /></Page></RequireAuth> },
            { path: 'admin/flujo-atencion', element: <RequireAuth><Page><FlujoAtencion /></Page></RequireAuth> },

            // Direcciones heredadas de Secretaria.
            { path: 'secretaria', element: <RequireAuth><Page><SecretariaDashboard /></Page></RequireAuth> },
            { path: 'secretaria/clientes', element: <RequireAuth><Page><ClientesRecepcion /></Page></RequireAuth> },
            { path: 'secretaria/equipos', element: <RequireAuth><Page><EquiposRecepcion /></Page></RequireAuth> },
            { path: 'secretaria/proveedores', element: <RequireAuth><Page><ProveedoresBodega /></Page></RequireAuth> },
            { path: 'secretaria/repuestos', element: <RequireAuth><Page><RepuestosBodega /></Page></RequireAuth> },
            { path: 'secretaria/tipos-repuesto', element: <RequireAuth><Page><TiposRepuestoBodega /></Page></RequireAuth> },
            { path: 'secretaria/compras', element: <RequireAuth><Page><ComprasBodega /></Page></RequireAuth> },
            { path: 'secretaria/fotos', element: <RequireAuth><Navigate to="/secretaria/compras" replace /></RequireAuth> },
            { path: 'secretaria/facturacion', element: <RequireAuth><Page><FacturacionContabilidad /></Page></RequireAuth> },
            { path: 'secretaria/nueva-orden', element: <RequireAuth><Page><NuevaOrden /></Page></RequireAuth> },
            { path: 'secretaria/entregas', element: <RequireAuth><Page><Entregas /></Page></RequireAuth> },
            { path: 'secretaria/diagnostico', element: <RequireAuth><Page><Diagnostico /></Page></RequireAuth> },
            { path: 'secretaria/flujo-atencion', element: <RequireAuth><Page><FlujoAtencion /></Page></RequireAuth> },
            // Direcciones propias de cada area.
            { path: 'recepcion/clientes', element: <RequireAuth><Page><ClientesRecepcion /></Page></RequireAuth> },
            { path: 'recepcion/equipos', element: <RequireAuth><Page><EquiposRecepcion /></Page></RequireAuth> },
            { path: 'recepcion/diagnostico', element: <RequireAuth><Page><Diagnostico /></Page></RequireAuth> },
            { path: 'recepcion/nueva-orden', element: <RequireAuth><Page><NuevaOrden /></Page></RequireAuth> },
            { path: 'recepcion/entregas', element: <RequireAuth><Page><Entregas /></Page></RequireAuth> },
            { path: 'recepcion/flujo-atencion', element: <RequireAuth><Page><FlujoAtencion /></Page></RequireAuth> },
            { path: 'recepcion/reclamos', element: <RequireAuth><Page><ReclamosPage /></Page></RequireAuth> },
            { path: 'bodega/repuestos', element: <RequireAuth><Page><RepuestosBodega /></Page></RequireAuth> },
            { path: 'bodega/tipos-repuesto', element: <RequireAuth><Page><TiposRepuestoBodega /></Page></RequireAuth> },
            { path: 'bodega/compras', element: <RequireAuth><Page><ComprasBodega /></Page></RequireAuth> },
            { path: 'bodega/proveedores', element: <RequireAuth><Page><ProveedoresBodega /></Page></RequireAuth> },
            { path: 'bodega/entregas', element: <RequireAuth><Page><TrazabilidadPage /></Page></RequireAuth> },
            { path: 'contabilidad/facturacion', element: <RequireAuth><Page><FacturacionContabilidad /></Page></RequireAuth> },
            { path: 'contabilidad/movimientos', element: <RequireAuth><Page><MovimientosPage /></Page></RequireAuth> },
            { path: 'calidad', element: <RequireAuth><Page><CalidadPage /></Page></RequireAuth> },
            { path: 'garantias', element: <RequireAuth><Page><GarantiasPage /></Page></RequireAuth> },
            { path: 'garantias/reclamos', element: <RequireAuth><Page><ReclamosPage /></Page></RequireAuth> },
            { path: 'reclamos', element: <RequireAuth><Page><ReclamosPage /></Page></RequireAuth> },
          ],
        },

        // 2. RUTAS INDEPENDIENTES (Sin Sidebar Global)
        // Los dashboards tecnicos ya traen su propio Header integrado
        {
          path: 'tecnico',
          element: <RequireAuth><Page fullWidth><TecnicoDashboard /></Page></RequireAuth>
        },
        {
          path: 'tecnico-jefe',
          element: <RequireAuth><Page fullWidth><JefeDashboard /></Page></RequireAuth>
        },
      ],
      future: { v7_startTransition: true, v7_relativeSplatPath: true }
    },
  ]
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PersonalizacionProvider>
        <RouterProvider router={router} />
      </PersonalizacionProvider>
    </QueryClientProvider>
  );
}

function RequireAuth({ children }) {
  const { user } = useContext(AuthContext);
  const { pathname } = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  const home = { Secretaria: '/secretaria', Recepcion: '/recepcion/clientes', Bodega: '/bodega/repuestos',
    Calidad: '/calidad', Reclamos: '/reclamos', Garantias: '/garantias', Contabilidad: '/contabilidad/facturacion',
    TecnicoJefe: '/tecnico-jefe', Tecnico: '/tecnico', Administrador: '/admin', admin_pro: '/admin', Admin: '/admin' }[user.rol] || '/login';
  const isAdmin = ['Administrador', 'admin_pro', 'Admin'].includes(user.rol);
  if (isAdmin) return children;
  if (pathname === '/mi-cuenta') return children;
  const sections = {
    Secretaria: ['/secretaria', '/recepcion', '/bodega', '/contabilidad', '/reclamos', '/calidad', '/garantias'],
    Recepcion: ['/recepcion/clientes', '/recepcion/equipos', '/recepcion/diagnostico', '/recepcion/nueva-orden', '/recepcion/entregas', '/recepcion/flujo-atencion', '/recepcion/reclamos'],
    Bodega: ['/bodega/repuestos', '/bodega/tipos-repuesto', '/bodega/proveedores', '/bodega/compras', '/bodega/entregas'],
    Calidad: ['/calidad'], Reclamos: ['/reclamos'], Garantias: ['/garantias'], Contabilidad: ['/contabilidad/facturacion', '/contabilidad/movimientos'],
    TecnicoJefe: ['/tecnico-jefe'], Tecnico: ['/tecnico'],
  };
  if (!(sections[user.rol] || []).some((path) => pathname === path || pathname.startsWith(`${path}/`))) return <Navigate to={home} replace />;
  return children;
}

export default App;
