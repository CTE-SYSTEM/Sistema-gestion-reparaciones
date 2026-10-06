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
const FlujoAtencion = lazy(() => import('./pages/FlujoAtencion'));

const SecretariaDashboard = lazy(() => import('./features/secretaria/pages/SecretariaDashboard'));
const ClientesSecretaria = lazy(() => import('./features/secretaria/pages/Clientes'));
const EquiposSecretaria = lazy(() => import('./features/secretaria/pages/Equipos'));
const ProveedoresSecretaria = lazy(() => import('./features/secretaria/pages/Proveedores'));
const RepuestosSecretaria = lazy(() => import('./features/secretaria/pages/Repuestos'));
const TiposRepuestoSecretaria = lazy(() => import('./features/secretaria/pages/TiposRepuesto'));
const ComprasSecretaria = lazy(() => import('./features/secretaria/pages/Compras'));
const FacturacionSecretaria = lazy(() => import('./features/secretaria/pages/Facturacion'));
const Diagnostico = lazy(() => import('./features/secretaria/pages/Diagnostico'));
const NuevaOrden = lazy(() => import('./features/secretaria/pages/NuevaOrden'));

const TecnicoDashboard = lazy(() => import('./features/tecnico/pages/TecnicoDashboard'));
const JefeDashboard = lazy(() => import('./features/tecnicoJefe/pages/TecnicoJefeDashboard'));

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
  const isSecretariaRoute = location.pathname.startsWith('/secretaria');

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
        <main className={`app-main-scroll flex-1 overflow-auto ${isAdminRoute ? 'admin-main' : ''} ${isSecretariaRoute ? 'secretaria-main' : ''}`}>
          <div className={`mx-auto w-full ${isAdminRoute ? 'admin-content' : ''} ${isSecretariaRoute ? 'secretaria-content' : ''}`}>
            {!isSecretariaRoute && <PageHelp />}
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

        // 1. RUTAS CON SIDEBAR Y NAVBAR GLOBAL
        {
          element: <MainLayout />,
          children: [
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

            // Secretaria
            { path: 'secretaria', element: <RequireAuth><Page><SecretariaDashboard /></Page></RequireAuth> },
            { path: 'secretaria/clientes', element: <RequireAuth><Page><ClientesSecretaria /></Page></RequireAuth> },
            { path: 'secretaria/equipos', element: <RequireAuth><Page><EquiposSecretaria /></Page></RequireAuth> },
            { path: 'secretaria/proveedores', element: <RequireAuth><Page><ProveedoresSecretaria /></Page></RequireAuth> },
            { path: 'secretaria/repuestos', element: <RequireAuth><Page><RepuestosSecretaria /></Page></RequireAuth> },
            { path: 'secretaria/tipos-repuesto', element: <RequireAuth><Page><TiposRepuestoSecretaria /></Page></RequireAuth> },
            { path: 'secretaria/compras', element: <RequireAuth><Page><ComprasSecretaria /></Page></RequireAuth> },
            { path: 'secretaria/fotos', element: <RequireAuth><Navigate to="/secretaria/compras" replace /></RequireAuth> },
            { path: 'secretaria/facturacion', element: <RequireAuth><Page><FacturacionSecretaria /></Page></RequireAuth> },
            { path: 'secretaria/nueva-orden', element: <RequireAuth><Page><NuevaOrden /></Page></RequireAuth> },
            { path: 'secretaria/diagnostico', element: <RequireAuth><Page><Diagnostico /></Page></RequireAuth> },
            { path: 'secretaria/flujo-atencion', element: <RequireAuth><Page><FlujoAtencion /></Page></RequireAuth> },
          ],
        },

        // 2. RUTAS INDEPENDIENTES (Sin Sidebar Global)
        // Los dashboards tecnicos ya traen su propio Header integrado
        {
          path: 'tecnico',
          element: <RequireAuth><Page><TecnicoDashboard /></Page></RequireAuth>
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
  if ((pathname === '/' || pathname.startsWith('/admin')) && !['Administrador', 'admin_pro', 'Admin'].includes(user.rol)) {
    const home = { Secretaria: '/secretaria', TecnicoJefe: '/tecnico-jefe', Tecnico: '/tecnico' }[user.rol] || '/login';
    return <Navigate to={home} replace />;
  }
  return children;
}

export default App;
