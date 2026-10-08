import React, { useState, useContext, useRef, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react'; 

// Importacion directa del SVG
import loadingSvg from '../../assets/images/svg/LoadingLogin.svg';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Estado para la animacion y la redireccion
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [userRoleName, setUserRoleName] = useState('');

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const submitRef = useRef(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      return setError('Ingresa usuario y contrasena');
    }

    setLoading(true);

    try {
      const userData = await login(username, password);

      if (!userData || !userData.rol) {
        throw new Error('Respuesta del servidor incompleta');
      }
      
      let targetPath = '';
      switch (userData.rol) {
        case 'Administrador':
        case 'admin_pro':
        case 'Admin':
          targetPath = '/admin';
          break;
        case 'Secretaria':
          targetPath = '/secretaria';
          break;
        case 'Recepcion': targetPath = '/recepcion/clientes'; break;
        case 'Bodega': targetPath = '/bodega/repuestos'; break;
        case 'Calidad': targetPath = '/calidad'; break;
        case 'Reclamos': targetPath = '/reclamos'; break;
        case 'Garantias': targetPath = '/garantias'; break;
        case 'Contabilidad': targetPath = '/contabilidad/facturacion'; break;
        case 'TecnicoJefe':
          targetPath = '/tecnico-jefe'; 
          break;
        case 'Tecnico':
          targetPath = '/tecnico';
          break;
        default:
          setError('Tu cuenta no tiene un rol asignado. Contacta soporte.');
          setLoading(false);
          return;
      }

      // 1. Activar la pantalla con la animacion SVG
      setUserRoleName(userData.rol);
      setIsRedirecting(true);

      // 2. Esperar exactamente 5000ms (5 segundos) para que termine la animacion
      setTimeout(() => {
        navigate(targetPath);
      }, 5000);

    } catch (err) {
      console.error("Fallo el inicio de sesion:", err);
      const mensajeError = err.response?.data?.message || 'Usuario o contrasena incorrectos';
      setError(mensajeError);
      setLoading(false);
    }
  };

  const handleUsernameKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      passwordRef.current?.focus();
    }
  };

  const handlePasswordKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitRef.current?.click();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      usernameRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      submitRef.current?.click();
    }
  };

  const handleButtonKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      passwordRef.current?.focus();
    }
  };

  // --- PANTALLA DE CARGA (5 SEGUNDOS CON SVG AMPLIADO) ---
  if (isRedirecting) {
    return (
      <div className="fixed inset-0 w-screen h-screen flex flex-col items-center justify-center bg-gray-50 z-50 font-sans transition-opacity duration-500 animate-in fade-in px-4">
        <div className="flex flex-col items-center w-full max-w-lg text-center">
          
          {/* SVG ampliado a un tamano visible y destacado */}
          <div className="w-64 h-64 sm:w-80 sm:h-80 lg:w-[min(32rem,65vh)] lg:h-[min(32rem,65vh)] mb-6 flex items-center justify-center">
            <img 
              src={loadingSvg} 
              alt="Cargando..." 
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>

          <h3 className="text-xl font-bold text-gray-900 tracking-tight">
            Acceso concedido
          </h3>
          <p className="text-sm text-gray-500 mt-1.5">
            Iniciando modulo de <span className="font-semibold text-blue-600">{userRoleName}</span>...
          </p>
        </div>
      </div>
    );
  }

  // --- FORMULARIO DE LOGIN NORMAL ---
  return (
    <div className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-gray-50 px-4 overflow-hidden z-50 font-sans">
      
      <div className="w-full max-w-xs bg-white p-7 rounded-2xl shadow-xl border border-gray-100">
        
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 mb-3 border border-blue-100/50 shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            Sistema de Gestion
          </h2>
          <p className="text-xs text-gray-500 font-normal leading-relaxed mt-1">
            Control y seguimiento de servicios tecnicos.
          </p>
        </div>

        {location.state?.message && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{location.state.message}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Usuario
            </label>
            <input 
              ref={usernameRef}
              type="text"
              autoComplete="username"
              disabled={loading}
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              onKeyDown={handleUsernameKeyDown}
              placeholder="Nombre de usuario" 
              className="w-full px-3.5 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-gray-800 placeholder-gray-300 disabled:bg-gray-50" 
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Contrasena
            </label>
            <div className="relative">
              <input 
                ref={passwordRef}
                type={showPassword ? "text" : "password"} 
                autoComplete="current-password"
                disabled={loading}
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                onKeyDown={handlePasswordKeyDown}
                placeholder="********" 
                className="w-full pl-3.5 pr-10 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-gray-800 placeholder-gray-300 disabled:bg-gray-50" 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 text-xs p-2.5 rounded-lg border border-red-100 flex items-center gap-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button 
            ref={submitRef}
            type="submit" 
            disabled={loading}
            onKeyDown={handleButtonKeyDown}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verificando...</span>
              </>
            ) : (
              'Ingresar al Sistema'
            )}
          </button>
        </form>
        <Link to="/recuperar-password" className="mt-4 block text-center text-xs font-semibold text-blue-700 hover:underline">¿Olvidaste tu contraseña?</Link>
      </div>

      <p className="absolute bottom-6 text-center text-gray-400 text-[11px] uppercase tracking-widest font-medium">
        &copy; {new Date().getFullYear()} SISTEMA DE GESTION
      </p>
    </div>
  );
};

export default Login;

