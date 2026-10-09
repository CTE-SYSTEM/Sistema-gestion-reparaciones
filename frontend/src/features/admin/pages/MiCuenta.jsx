import { useContext, useEffect, useState } from 'react';
import { ChevronDown, ShieldCheck, KeyRound, UserRound } from 'lucide-react';
import { AuthContext } from '../../../context/AuthContext';
import PageHelp from '../../../components/PageHelp';
import { administracionService, errorText } from '../services/administracionService';
import { AdminPage, AdminField, AdminButton, AdminNotice, inputClass } from '../components/AdministrationUI';

export default function MiCuenta() {
  const { user, updateUser, logout } = useContext(AuthContext);
  const [account, setAccount] = useState(null), [profile, setProfile] = useState({ nombre_usuario: '', nombre_persona: '', correo_electronico: '', password_actual: '' });
  const [passwords, setPasswords] = useState({ password_actual: '', password: '', confirmacion: '' });
  const [minimum, setMinimum] = useState(8), [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [openSection, setOpenSection] = useState('profile');
  useEffect(() => {
    let active = true;
    administracionService.getCuenta().then(({ data }) => {
      if (!active) return;
      setAccount(data.data); setMinimum(data.password_minimo);
      setProfile({ nombre_usuario: data.data.nombre_usuario, nombre_persona: data.data.nombre_persona || '', correo_electronico: data.data.correo_electronico || '', password_actual: '' });
    }).catch(async (e) => { if (active) setError(await errorText(e)); });
    return () => { active = false; };
  }, []);
  const submit = async (event, operation) => {
    event.preventDefault(); setBusy(operation); setError(''); setMessage('');
    try {
      if (operation === 'profile') {
        const { data } = await administracionService.updateCuenta(profile);
        setAccount(data.data); updateUser(data.data); setProfile((p) => ({ ...p, password_actual: '' })); setMessage(data.message);
      } else {
        const { data } = operation === 'password'
          ? await administracionService.changePassword(passwords)
          : await administracionService.closeSessions({ password_actual: passwords.password_actual });
        logout(data.message);
      }
    } catch (e) { setError(await errorText(e)); } finally { setBusy(''); }
  };
  const isAdmin = ['Administrador', 'admin_pro', 'Admin'].includes(user?.rol);
  const profileHome = {
    Recepcion: '/recepcion', ServicioCliente: '/servicio-cliente', Secretaria: '/secretaria',
    Bodega: '/bodega', Calidad: '/calidad', Reclamos: '/reclamos', Garantias: '/garantias',
    Contabilidad: '/contabilidad', Tecnico: '/tecnico', TecnicoJefe: '/tecnico-jefe',
  }[user?.rol] || '/admin';
  const toggleSection = (name) => setOpenSection((current) => current === name ? null : name);

  return <AdminPage title="Mi cuenta" description="Actualiza tus datos y controla el acceso a tu cuenta."
    backTo={isAdmin ? '/admin' : profileHome} backLabel={isAdmin ? 'Administración' : user?.rol || 'Inicio'} actions={<PageHelp compact />}>
    <AdminNotice error message={error} /><AdminNotice message={message} />
    {!account ? !error && <p className="text-sm text-slate-500">Cargando cuenta…</p> : <>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-indigo-950 p-5 text-white"><UserRound size={32} /><div><p className="text-lg font-bold">{account.nombre_persona || account.nombre_usuario}</p><p className="text-sm text-indigo-200">@{account.nombre_usuario} · {account.rol === 'Secretaria' ? 'Operación integral' : account.rol}</p></div><span className="ml-auto flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200"><ShieldCheck size={14} />Cuenta activa</span></div>
      <div className="space-y-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <button type="button" onClick={() => toggleSection('profile')} aria-expanded={openSection === 'profile'} aria-controls="account-profile-fields" className="flex w-full items-center justify-between gap-4 text-left">
            <span><span className="block text-lg font-bold text-slate-800">Datos de la cuenta</span><span className="mt-1 block text-sm text-slate-500">Nombre, usuario y correo electrónico</span></span>
            <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${openSection === 'profile' ? 'rotate-180' : ''}`} />
          </button>
          {openSection === 'profile' && <form id="account-profile-fields" onSubmit={(e) => submit(e, 'profile')} className="mt-5 space-y-4"><fieldset disabled={!!busy} className="space-y-4">
            <AdminField label="Nombre de la persona"><input className={inputClass} maxLength={120} autoComplete="name" value={profile.nombre_persona} onChange={(e) => setProfile((p) => ({ ...p, nombre_persona: e.target.value }))} /></AdminField>
            <AdminField label="Usuario"><input className={inputClass} required maxLength={100} autoComplete="username" value={profile.nombre_usuario} onChange={(e) => setProfile((p) => ({ ...p, nombre_usuario: e.target.value }))} /></AdminField>
            <AdminField label="Correo electrónico"><input className={inputClass} type="email" maxLength={254} autoComplete="email" value={profile.correo_electronico} onChange={(e) => setProfile((p) => ({ ...p, correo_electronico: e.target.value }))} /></AdminField>
            <AdminField label="Contraseña actual"><input className={inputClass} type="password" required autoComplete="current-password" value={profile.password_actual} onChange={(e) => setProfile((p) => ({ ...p, password_actual: e.target.value }))} /></AdminField>
            <AdminButton type="submit">{busy === 'profile' ? 'Guardando…' : 'Guardar datos'}</AdminButton>
          </fieldset></form>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <button type="button" onClick={() => toggleSection('password')} aria-expanded={openSection === 'password'} aria-controls="account-password-fields" className="flex w-full items-center justify-between gap-4 text-left">
            <span><span className="block text-lg font-bold text-slate-800">Contraseña y sesiones</span><span className="mt-1 block text-sm text-slate-500">Cambia tu clave o cierra las sesiones abiertas</span></span>
            <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${openSection === 'password' ? 'rotate-180' : ''}`} />
          </button>
          {openSection === 'password' && <form id="account-password-fields" onSubmit={(e) => submit(e, 'password')} className="mt-5 space-y-4"><fieldset disabled={!!busy} className="space-y-4">
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">Cambiarás la contraseña de <strong>{account.nombre_usuario}</strong>.</p>
            <AdminField label="Contraseña actual para seguridad"><input className={inputClass} type="password" required autoComplete="current-password" value={passwords.password_actual} onChange={(e) => setPasswords((p) => ({ ...p, password_actual: e.target.value }))} /></AdminField>
            <AdminField label="Nueva contraseña" hint={`Al menos ${minimum} caracteres.`}><input className={inputClass} type="password" required minLength={minimum} autoComplete="new-password" value={passwords.password} onChange={(e) => setPasswords((p) => ({ ...p, password: e.target.value }))} /></AdminField>
            <AdminField label="Confirmar nueva contraseña"><input className={inputClass} type="password" required minLength={minimum} autoComplete="new-password" value={passwords.confirmacion} onChange={(e) => setPasswords((p) => ({ ...p, confirmacion: e.target.value }))} /></AdminField>
            <AdminButton type="submit"><KeyRound size={16} />{busy === 'password' ? 'Actualizando…' : 'Cambiar contraseña'}</AdminButton>
            <div className="border-t border-slate-100 pt-4"><p className="mb-3 text-sm text-slate-500">Puedes cerrar todas tus sesiones sin cambiar la contraseña. Completa la contraseña actual de este apartado.</p><AdminButton danger disabled={!passwords.password_actual} onClick={(e) => submit(e, 'sessions')}>{busy === 'sessions' ? 'Cerrando…' : 'Cerrar todas mis sesiones'}</AdminButton></div>
          </fieldset></form>}
        </section>
      </div>
    </>}
  </AdminPage>;
}
