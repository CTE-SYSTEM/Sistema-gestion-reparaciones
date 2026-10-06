import React from 'react';
import { Bell, LogOut, Save, Settings, X } from 'lucide-react';
import BrandLogo from '../../../components/BrandLogo';
import { NotificationTray } from '../../../components/NotificationTray';
import { PRIORIDADES, REPUESTO_ESTADOS } from '../utils/constants';
import { getCorreccionId, getCorreccionTipo, getEquipo } from '../utils/helpers';

const cardColors = {
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  red: 'bg-red-50 text-red-600',
};

export const DashboardHeader = ({
  user,
  logout,
  socketConnected,
  notifications,
  notificationsCount,
  showNotifications,
  onToggleNotifications,
  onClearNotifications,
  onCloseNotifications,
}) => (
  <header className="bg-[#0f172a] text-white p-6 shadow-xl">
    <div className="container mx-auto flex justify-between items-center">
      <div className="flex items-center gap-5">
        <BrandLogo className="h-12 w-20 shadow-lg shadow-indigo-500/20" />
        <h1 className="text-xl text-white italic uppercase tracking-tight">
          Panel <span className="text-indigo-400">Jefe Tecnico</span>
        </h1>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          <button
            type="button"
            onClick={onToggleNotifications}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/50 text-slate-200 hover:border-indigo-400 hover:text-white"
            title={socketConnected ? 'Notificaciones conectadas' : 'Notificaciones desconectadas'}
          >
            <Bell size={20} />
            {notificationsCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                {notificationsCount}
              </span>
            )}
            <span className={`absolute bottom-1 right-1 h-2 w-2 rounded-full ${notificationsCount > 0 ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          </button>

          {showNotifications && (
            <NotificationTray
              notifications={notifications}
              connected={socketConnected}
              onClear={onClearNotifications}
              onClose={onCloseNotifications}
            />
          )}
        </div>

        <div className="text-right hidden md:block">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none mb-1">
            Usuario Conectado
          </p>
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm font-bold text-white uppercase tracking-tight">
              {user?.nombre || user?.username || 'Tecnico Jefe'}
            </span>
            <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-indigo-500/30">
              {user?.rol || 'Jefe'}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="group flex items-center gap-3 bg-slate-800/50 hover:bg-red-500/10 p-2 pr-4 rounded-2xl transition-all border border-slate-700 hover:border-red-500/50"
        >
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center group-hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-red-500">
            Salir
          </span>
        </button>
      </div>
    </div>
  </header>
);

export const DetailBox = ({ label, value, isFull, highlight }) => (
  <div className={`${isFull ? 'col-span-2' : ''} p-5 rounded-3xl border ${highlight ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">{label}</span>
    <p className={`text-sm font-bold ${highlight ? 'text-indigo-700' : 'text-slate-700'}`}>{value || 'N/A'}</p>
  </div>
);

export const FormSelect = ({ label, value, onChange, children }) => (
  <label className="block">
    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border-2 border-slate-100 bg-white px-4 py-3 text-xs font-bold uppercase text-slate-700 outline-none transition-all focus:border-indigo-500">
      {children}
    </select>
  </label>
);

export const FormInput = ({ label, value, onChange, type = 'text', min }) => (
  <label className="block">
    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <input type={type} min={min} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border-2 border-slate-100 bg-white px-4 py-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-indigo-500" />
  </label>
);

export const StatCard = ({ icon, label, value, color, compact }) => (
  <div className={`bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 ${compact ? 'md:max-w-sm' : ''}`}>
    <div className={`w-10 h-10 ${cardColors[color] || cardColors.indigo} rounded-xl flex items-center justify-center mb-4`}>
      {icon}
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <span className="text-3xl font-black text-slate-800 tracking-tighter">{value}</span>
  </div>
);

export const TabButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 py-4 px-6 rounded-2xl font-black text-[10px] uppercase transition-all ${
      active ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
    }`}
  >
    {icon} <span>{label}</span>
  </button>
);

export const DetailModal = ({ detalles, loadingDetalles, onClose }) => {
  const equipo = getEquipo(detalles || {}) || {};
  const orden = detalles?.orden || detalles;
  const diagnostico = detalles?.diagnostico || detalles?.orden?.diagnostico || {};
  const tecnico = orden?.tecnico || diagnostico?.tecnico;
  const esSolicitudRepuesto = Boolean(detalles?.id_detalle_repuesto);
  const irreparableEstado = String(orden?.irreparable_estado || '').toUpperCase();
  const tieneIrreparable = Boolean(orden?.justificacion_irreparable || orden?.observacion_final || irreparableEstado);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
              {esSolicitudRepuesto ? `Solicitud #${detalles.id_detalle_repuesto}` : 'Detalle tecnico'}
            </p>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Ficha Tecnica</h2>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
            <X size={24} />
          </button>
        </div>
        <div className="p-8 overflow-y-auto space-y-6">
          {loadingDetalles ? (
            <div className="py-20 text-center">Cargando detalles...</div>
          ) : detalles ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailBox label="Equipo" value={`${equipo.marca || 'S/M'} ${equipo.modelo || 'S/M'}`} />
                <DetailBox label="Cliente" value={equipo.cliente?.nombre || (equipo.cliente_id ? `Cliente #${equipo.cliente_id}` : 'Particular')} />
                <DetailBox label="Tipo / Serie" value={[equipo.tipo, equipo.numero_serie || equipo.serie].filter(Boolean).join(' - ')} />
                <DetailBox label="Orden" value={orden?.id_orden ? `Orden #${orden.id_orden}` : undefined} />
                <DetailBox label="Tecnico" value={tecnico?.nombre} />
                <DetailBox label="Fecha ingreso" value={orden?.fecha_ingreso ? new Date(orden.fecha_ingreso).toLocaleDateString() : undefined} />
              </div>
              <DetailBox label="Falla Reportada" value={detalles.falla_reportada || diagnostico.falla_reportada} isFull highlight />
              <DetailBox label="Diagnostico Realizado" value={detalles.diagnostico_real || diagnostico.diagnostico_real || 'Aun no se ha realizado diagnostico'} isFull />
              {tieneIrreparable && (
                <div className="rounded-[2rem] border border-red-100 bg-red-50/70 p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Revision de irreparabilidad</p>
                    <span className="rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-700">
                      {irreparableEstado || 'PENDIENTE'}
                    </span>
                  </div>
                  <DetailBox
                    label="Hallazgo o justificacion"
                    value={orden.justificacion_irreparable || orden.observacion_final || 'Sin justificacion registrada'}
                    isFull
                    highlight
                  />
                </div>
              )}
              {esSolicitudRepuesto && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailBox label="Pieza solicitada" value={detalles.repuesto?.nombre || detalles.pieza_solicitada} highlight />
                  <DetailBox label="Cantidad solicitada" value={detalles.cantidad_usada || 1} highlight />
                  <DetailBox label="Inventario" value={detalles.repuesto_id ? `Repuesto #${detalles.repuesto_id}` : 'No registrada en inventario'} />
                  <DetailBox label="Estado aprobacion" value={detalles.estado_aprobacion} />
                  <DetailBox label="Técnico solicitante" value={detalles.tecnico_solicitante?.nombre || detalles.orden?.tecnico?.nombre || 'No registrado'} />
                  <DetailBox label="Usuario aprobador" value={detalles.usuario_aprobador?.nombre_usuario || 'Pendiente'} />
                  {detalles.motivo_rechazo && <DetailBox label="Motivo de rechazo" value={detalles.motivo_rechazo} isFull />}
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs">No se encontraron detalles.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export const CorrectionModal = ({
  editItem,
  editForm,
  editError,
  tecnicos,
  repuestosCatalogo,
  savingId,
  onClose,
  onFieldChange,
  onSave,
}) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-[2rem] shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Correccion #{getCorreccionId(editItem)}</p>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
            {getCorreccionTipo(editItem) === 'diagnostico' ? 'Modificar diagnostico' : getCorreccionTipo(editItem) === 'orden' ? 'Modificar orden' : 'Modificar repuesto'}
          </h2>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
          <X size={24} />
        </button>
      </div>

      <div className="p-8 overflow-y-auto space-y-5">
        {getCorreccionTipo(editItem) !== 'repuesto' ? (
          <>
            <FormSelect label="Tecnico asignado" value={editForm.tecnico_id || ''} onChange={(value) => onFieldChange('tecnico_id', value)}>
              <option value="">Sin tecnico</option>
              {tecnicos.map((tecnico) => (
                <option key={tecnico.id_tecnico} value={tecnico.id_tecnico}>{tecnico.nombre} - {tecnico.especialidad || 'GENERAL'}</option>
              ))}
            </FormSelect>
            <FormSelect label="Prioridad" value={editForm.prioridad || 'Normal'} onChange={(value) => onFieldChange('prioridad', value)}>
              {PRIORIDADES.map((prioridad) => <option key={prioridad} value={prioridad}>{prioridad}</option>)}
            </FormSelect>
          </>
        ) : (
          <>
            <FormSelect label="Repuesto de inventario" value={editForm.repuesto_id || ''} onChange={(value) => onFieldChange('repuesto_id', value)}>
              <option value="">Sin repuesto asociado</option>
              {repuestosCatalogo.map((repuesto) => (
                <option key={repuesto.id_repuesto} value={repuesto.id_repuesto}>{repuesto.nombre || `Repuesto #${repuesto.id_repuesto}`}</option>
              ))}
            </FormSelect>
            <FormInput label="Pieza solicitada" value={editForm.pieza_solicitada || ''} onChange={(value) => onFieldChange('pieza_solicitada', value)} />
            <FormInput label="Cantidad" type="number" min="1" value={editForm.cantidad_usada || 1} onChange={(value) => onFieldChange('cantidad_usada', value)} />
            <FormSelect label="Estado de aprobacion" value={editForm.estado_aprobacion || 'APROBADO'} onChange={(value) => onFieldChange('estado_aprobacion', value)}>
              {REPUESTO_ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
            </FormSelect>
            {editForm.estado_aprobacion === 'DENEGADO' && <FormInput label="Motivo de rechazo" value={editForm.motivo_rechazo || ''} onChange={(value) => onFieldChange('motivo_rechazo', value)} />}
          </>
        )}

        {editError && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">{editError}</div>}
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 p-6">
        <button onClick={onClose} className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-500 font-black text-[10px] uppercase hover:text-slate-800">Cancelar</button>
        <button
          onClick={onSave}
          disabled={savingId === `correccion-${getCorreccionTipo(editItem)}-${getCorreccionId(editItem)}`}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase hover:bg-indigo-700 disabled:opacity-50"
        >
          {savingId === `correccion-${getCorreccionTipo(editItem)}-${getCorreccionId(editItem)}` ? <Settings size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar cambios
        </button>
      </div>
    </div>
  </div>
);
