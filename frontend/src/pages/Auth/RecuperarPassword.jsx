import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import api from '../../services/api';

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20';

export default function RecuperarPassword() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [step, setStep] = useState('request');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const submitRequest = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await api.post('/auth/recuperar-password', { correo_electronico: correo });
      setMessage(data.message);
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo solicitar el código.');
    } finally { setBusy(false); }
  };

  const submitReset = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    if (password !== confirmacion) {
      setError('La confirmación de contraseña no coincide.'); setBusy(false); return;
    }
    try {
      const { data } = await api.post('/auth/restablecer-password', {
        correo_electronico: correo, codigo, password, confirmacion,
      });
      navigate('/login', { replace: true, state: { message: data.message } });
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-50 px-4 py-8">
    <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-7 shadow-xl">
      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><KeyRound size={20} /></div>
        <h1 className="text-xl font-bold text-gray-900">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-gray-500">{step === 'request'
          ? 'Escribe el correo registrado en tu cuenta para recibir un código.'
          : 'Introduce el código enviado a tu correo y elige una contraseña nueva.'}</p>
      </div>
      {message && <p role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={step === 'request' ? submitRequest : submitReset} className="space-y-4">
        <label className="block text-sm font-semibold text-gray-700">Correo electrónico
          <input type="email" required autoComplete="email" maxLength={254} className={`${inputClass} mt-1.5`} value={correo} onChange={(e) => setCorreo(e.target.value)} disabled={busy} />
        </label>
        {step === 'reset' && <>
          <label className="block text-sm font-semibold text-gray-700">Código de seis dígitos
            <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} className={`${inputClass} mt-1.5`} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} />
          </label>
          <label className="block text-sm font-semibold text-gray-700">Nueva contraseña
            <input type="password" required minLength={8} autoComplete="new-password" className={`${inputClass} mt-1.5`} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          </label>
          <label className="block text-sm font-semibold text-gray-700">Confirmar nueva contraseña
            <input type="password" required minLength={8} autoComplete="new-password" className={`${inputClass} mt-1.5`} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} disabled={busy} />
          </label>
        </>}
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{step === 'request' ? 'Enviar código' : 'Cambiar contraseña'}
        </button>
      </form>
      {step === 'reset' && <button type="button" disabled={busy} onClick={() => { setStep('request'); setError(''); setMessage(''); }} className="mt-4 w-full text-sm font-medium text-blue-700 hover:underline">Solicitar otro código</button>}
      <Link to="/login" className="mt-5 block text-center text-sm font-medium text-gray-600 hover:text-blue-700">Volver al inicio de sesión</Link>
    </div>
  </div>;
}
