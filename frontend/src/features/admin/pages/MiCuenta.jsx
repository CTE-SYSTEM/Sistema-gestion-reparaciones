import { useContext, useEffect, useState } from 'react';
import { ShieldCheck, KeyRound, UserRound } from 'lucide-react';
import { AuthContext } from '../../../context/AuthContext';
import { administracionService, errorText } from '../services/administracionService';
import { AdminPage, AdminSection, AdminField, AdminButton, AdminNotice, inputClass, formatAdminDate } from '../components/AdministrationUI';

export default function MiCuenta() {
  const { updateUser, logout } = useContext(AuthContext);
  const [account, setAccount] = useState(null), [profile, setProfile] = useState({ nombre_usuario: '', correo_electronico: '', password_actual: '' });
  const [passwords, setPasswords] = useState({ password_actual: '', password: '', confirmacion: '' });
  const [minimum, setMinimum] = useState(8), [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    administracionService.getCuenta().then(({ data }) => {
      if (!active) return;
      setAccount(data.data); setMinimum(data.password_minimo);
      setProfile({ nombre_usuario: data.data.nombre_usuario, correo_electronico: data.data.correo_electronico || '', password_actual: '' });
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
  return <AdminPage title="Mi cuenta" description="Actualiza tus datos y controla el acceso a tu cuenta de administrador.">
    <AdminNotice error message={error} /><AdminNotice message={message} />
    {!account ? !error && <p className="text-sm text-slate-500">Cargando cuenta…</p> : <>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-indigo-950 p-5 text-white"><UserRound size={32} /><div><p className="text-lg font-bold">{account.nombre_usuario}</p><p className="text-sm text-indigo-200">{account.rol} · Cuenta creada el {formatAdminDate(account.fecha_creacion)}</p></div><span className="ml-auto flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200"><ShieldCheck size={14} />Cuenta activa</span></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSection title="Datos de la cuenta" description="Confirma tu contraseña actual para guardar los cambios.">
          <form onSubmit={(e) => submit(e, 'profile')} className="space-y-4"><fieldset disabled={!!busy} className="space-y-4">
            <AdminField label="Usuario"><input className={inputClass} required maxLength={100} autoComplete="username" value={profile.nombre_usuario} onChange={(e) => setProfile((p) => ({ ...p, nombre_usuario: e.target.value }))} /></AdminField>
            <AdminField label="Correo electrónico"><input className={inputClass} type="email" maxLength={254} autoComplete="email" value={profile.correo_electronico} onChange={(e) => setProfile((p) => ({ ...p, correo_electronico: e.target.value }))} /></AdminField>
            <AdminField label="Contraseña actual"><input className={inputClass} type="password" required autoComplete="current-password" value={profile.password_actual} onChange={(e) => setProfile((p) => ({ ...p, password_actual: e.target.value }))} /></AdminField>
            <AdminButton type="submit">{busy === 'profile' ? 'Guardando…' : 'Guardar datos'}</AdminButton>
          </fieldset></form>
        </AdminSection>
        <AdminSection title="Contraseña y sesiones" description="Al cambiar tu contraseña se cerrarán todas tus sesiones, incluida esta.">
          <form onSubmit={(e) => submit(e, 'password')} className="space-y-4"><fieldset disabled={!!busy} className="space-y-4">
            <AdminField label="Contraseña actual para seguridad"><input className={inputClass} type="password" required autoComplete="current-password" value={passwords.password_actual} onChange={(e) => setPasswords((p) => ({ ...p, password_actual: e.target.value }))} /></AdminField>
            <AdminField label="Nueva contraseña" hint={`Al menos ${minimum} caracteres.`}><input className={inputClass} type="password" required minLength={minimum} autoComplete="new-password" value={passwords.password} onChange={(e) => setPasswords((p) => ({ ...p, password: e.target.value }))} /></AdminField>
            <AdminField label="Confirmar nueva contraseña"><input className={inputClass} type="password" required minLength={minimum} autoComplete="new-password" value={passwords.confirmacion} onChange={(e) => setPasswords((p) => ({ ...p, confirmacion: e.target.value }))} /></AdminField>
            <AdminButton type="submit"><KeyRound size={16} />{busy === 'password' ? 'Actualizando…' : 'Cambiar contraseña'}</AdminButton>
            <div className="border-t border-slate-100 pt-4"><p className="mb-3 text-sm text-slate-500">Puedes cerrar todas tus sesiones sin cambiar la contraseña. Completa la contraseña actual de este apartado.</p><AdminButton danger disabled={!passwords.password_actual} onClick={(e) => submit(e, 'sessions')}>{busy === 'sessions' ? 'Cerrando…' : 'Cerrar todas mis sesiones'}</AdminButton></div>
          </fieldset></form>
        </AdminSection>
      </div>
    </>}
  </AdminPage>;
}
