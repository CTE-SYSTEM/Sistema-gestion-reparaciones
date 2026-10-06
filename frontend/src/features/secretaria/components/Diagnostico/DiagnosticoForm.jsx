import { Edit3, Loader2, Monitor, Phone, User, XCircle } from 'lucide-react';
import Autocomplete from '../shared/Autocomplete';
import { tourHighlightClass } from './constants';
import { accessAppliesToType, chargerAppliesToType } from './receptionRequirements';
import { handleFormNavigationKeyDown } from '../shared/formKeyboardNavigation';
import FotosPendientes from '../shared/FotosPendientes';

const Select = ({ label, children, ...props }) => (
  <div className="flex flex-col">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select {...props} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 transition-all outline-none">
      {children}
    </select>
  </div>
);

const receptionOptions = [
  ['estado_cargador', 'Cargador', [['ENTREGADO', 'Entregado'], ['NO_ENTREGADO', 'No entregado'], ['NO_INCLUIDO', 'El equipo no lo incluye'], ['NO_VERIFICADO', 'Pendiente de verificar']]],
  ['estado_accesorios', 'Accesorios', [['COMPLETOS', 'Completos'], ['INCOMPLETOS', 'Incompletos'], ['SIN_ACCESORIOS', 'Sin accesorios'], ['NO_VERIFICADOS', 'Pendientes de verificar']]],
  ['estado_fisico', 'Estado físico', [['SIN_DANOS', 'Sin daños visibles'], ['DANOS_LEVES', 'Daños leves'], ['DANOS_GRAVES', 'Daños graves'], ['NO_VERIFICADO', 'Pendiente de verificar']]],
  ['estado_encendido', 'Encendido', [['ENCIENDE', 'Enciende'], ['NO_ENCIENDE', 'No enciende'], ['INTERMITENTE', 'Intermitente'], ['NO_PROBADO', 'No probado']]],
  ['estado_alimentacion', 'Alimentación eléctrica', [['FUNCIONA', 'Funciona'], ['NO_FUNCIONA', 'No funciona'], ['INTERMITENTE', 'Intermitente'], ['NO_PROBADA', 'No probada']]],
  ['estado_acceso', 'Acceso para pruebas', [['NO_REQUIERE', 'No requiere acceso'], ['ENTREGADO', 'Acceso facilitado'], ['NO_ENTREGADO', 'Acceso no facilitado'], ['NO_VERIFICADO', 'Pendiente de verificar']]],
];

const SectionHeader = ({ currentId, isEditing, onCancelEdit, savedPhotoDiagnosisId, loading }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
        {savedPhotoDiagnosisId ? `Diagnóstico #${savedPhotoDiagnosisId} guardado` : isEditing ? (
          <>
            <Edit3 className="w-5 h-5" /> Editando Registro #{currentId}
          </>
        ) : (
          'Datos del Ingreso'
        )}
      </h3>
      <button
        type="button"
        onClick={onCancelEdit}
        disabled={loading}
        className="text-red-500 flex items-center gap-1 text-sm font-bold hover:bg-red-50 px-2 py-1 rounded transition-colors"
      >
        <XCircle className="w-4 h-4" /> {savedPhotoDiagnosisId ? 'Cerrar registro' : 'Cancelar'}
      </button>
    </div>
  </div>
);

export const DiagnosticoForm = ({
  activeTourTarget,
  clienteSeleccionado,
  currentId,
  equipoSeleccionado,
  equiposDelCliente,
  formData,
  formRef,
  isEditing,
  loading,
  onCancelEdit,
  onChange,
  onSubmit,
  photoQueue,
  savedPhotoDiagnosisId,
  photoContextLabel,
  clientes,
}) => (
  <section ref={formRef} className="bg-white rounded-xl shadow-md border border-indigo-50 p-6 scroll-mt-6 transition-all duration-300">
    <SectionHeader
      currentId={currentId}
      isEditing={isEditing}
      onCancelEdit={onCancelEdit}
      savedPhotoDiagnosisId={savedPhotoDiagnosisId}
      loading={loading || photoQueue.isBusy}
    />

    <form onSubmit={onSubmit} onKeyDown={handleFormNavigationKeyDown} className="space-y-6 mt-6 animate-in slide-in-from-top-2 fade-in duration-200">
      <fieldset disabled={loading || photoQueue.isBusy || Boolean(savedPhotoDiagnosisId)} className="min-w-0 space-y-6">
        <div data-tour-target="owner" className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${tourHighlightClass(activeTourTarget === 'owner')}`}>
          <Autocomplete
            label="Cliente (Dueno)"
            name="cliente_id"
            value={formData.cliente_id}
            onChange={onChange}
            options={clientes}
            matchMode="prefix"
            getOptionValue={(cliente) => cliente.id_cliente}
            getOptionLabel={(cliente) => cliente.nombre || `Cliente #${cliente.id_cliente}`}
            getOptionDescription={(cliente) => `ID: ${cliente.id_cliente}${cliente.telefono ? ` | ${cliente.telefono}` : ''}`}
            placeholder=""
            helpText="Ej.: nombre, ID o teléfono del cliente"
            emptyMessage="No hay clientes con ese criterio"
            required
          />

          {clienteSeleccionado ? (
            <div className="animate-in fade-in zoom-in duration-200">
              <label className="block text-sm font-bold text-indigo-600 mb-1">Contacto del Dueno</label>
              <div className="flex items-center justify-between w-full px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm h-[42px]">
                <div className="flex items-center gap-2 text-indigo-700 font-bold">
                  <Phone className="w-4 h-4" />
                  <span>{clienteSeleccionado.telefono || 'Sin telefono'}</span>
                </div>
                <span className="text-[10px] font-mono bg-indigo-200 px-2 py-0.5 rounded text-indigo-900">ID: {clienteSeleccionado.id_cliente}</span>
              </div>
            </div>
          ) : (
            <div className="hidden md:flex items-center text-gray-400 text-xs italic pt-6">
              <User className="w-4 h-4 mr-1" /> Seleccione un cliente para validar datos
            </div>
          )}
        </div>

        <div data-tour-target="equipment" className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${tourHighlightClass(activeTourTarget === 'equipment')}`}>
          <Autocomplete
            label="Equipo Registrado"
            name="equipo_id"
            value={formData.equipo_id}
            onChange={onChange}
            options={equiposDelCliente}
            getOptionValue={(equipo) => equipo.id_equipo}
            getOptionLabel={(equipo) => [equipo.marca, equipo.modelo].filter(Boolean).join(' ') || `Equipo #${equipo.id_equipo}`}
            getOptionDescription={(equipo) => [equipo.tipo, equipo.numero_serie ? `S/N: ${equipo.numero_serie}` : '', `ID: ${equipo.id_equipo}`].filter(Boolean).join(' | ')}
            placeholder=""
            helpText={formData.cliente_id ? 'Ej.: marca, modelo o número de serie' : 'Seleccione un cliente primero para buscar sus equipos'}
            emptyMessage="No hay equipos para ese criterio"
            disabled={!formData.cliente_id}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Electronico</label>
            <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-semibold min-h-[42px]">
              {equipoSeleccionado?.tipo || ''}
            </div>
            <p className="mt-1 text-xs text-gray-400">{equipoSeleccionado ? 'Este valor viene del equipo registrado.' : 'Seleccione un equipo para ver el tipo.'}</p>
          </div>
        </div>

        <div data-tour-target="priority" className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${tourHighlightClass(activeTourTarget === 'priority')}`}>
          <Select label="Prioridad de Atencion" name="prioridad" value={formData.prioridad} onChange={onChange}>
            <option value="Normal">Normal</option>
            <option value="Alta">Alta</option>
            <option value="Urgente">Urgente</option>
          </Select>

        </div>

        {equipoSeleccionado ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {receptionOptions.filter(([name]) => (
                (name !== 'estado_cargador' || chargerAppliesToType(equipoSeleccionado.tipo))
                && (name !== 'estado_acceso' || accessAppliesToType(equipoSeleccionado.tipo))
              )).map(([name, label, options]) => (
                <Select key={name} label={label} name={name} value={formData[name]} onChange={onChange} required>
                  {options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
                </Select>
              ))}
            </div>
            {!chargerAppliesToType(equipoSeleccionado.tipo) && (
              <p className="text-xs text-slate-600">Para {equipoSeleccionado.tipo}, el cargador no aplica. Si recibió cable o adaptador de corriente, descríbalo en accesorios.</p>
            )}
            {!accessAppliesToType(equipoSeleccionado.tipo) && (
              <p className="text-xs text-slate-600">Este tipo de equipo no requiere registrar acceso para pruebas.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm text-gray-700">Detalle de accesorios
                <textarea name="detalle_accesorios" value={formData.detalle_accesorios} onChange={onChange} aria-describedby="detalle_accesorios-help" rows={2} className="mt-1 w-full rounded-lg border border-gray-300 p-2" />
                <span id="detalle_accesorios-help" className="mt-1 block text-xs text-slate-500">Ej.: Cable de corriente y control inalámbrico</span>
                <span className="block text-xs text-slate-500">El técnico verá este detalle. Incluya solo accesorios, sin nombres ni contactos.</span>
              </label>
              <label className="text-sm text-gray-700">Observaciones de recepción
                <textarea name="observaciones_recepcion" value={formData.observaciones_recepcion} onChange={onChange} aria-describedby="observaciones_recepcion-help" rows={2} className="mt-1 w-full rounded-lg border border-gray-300 p-2" />
                <span id="observaciones_recepcion-help" className="mt-1 block text-xs text-slate-500">Ej.: Rayones en la carcasa y tornillo faltante</span>
              </label>
            </div>
          </>
        ) : (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Seleccione un equipo para mostrar los datos de recepción que corresponden a su tipo.</p>
        )}
        <div data-tour-target="failure" className={tourHighlightClass(activeTourTarget === 'failure')}>
          <label className="block text-sm font-medium text-gray-700 mb-1 italic">Falla reportada por el cliente</label>
          <textarea
            name="falla_reportada"
            value={formData.falla_reportada}
            onChange={onChange}
            required
            rows={3}
            aria-describedby="falla_reportada-help"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-sm outline-none"
          />
          <p id="falla_reportada-help" className="mt-1 text-xs text-slate-500">Ej.: No enciende o se apaga después de unos minutos</p>
          <p className="mt-1 text-xs text-slate-500">Describa solo el problema técnico. Los datos del cliente se registran en su ficha.</p>
        </div>
      </fieldset>

        {savedPhotoDiagnosisId && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Los datos ya están guardados en el diagnóstico #{savedPhotoDiagnosisId}. Puede reintentar las fotos pendientes sin crear otro diagnóstico ni repetir las fotos guardadas.</p>}
        <FotosPendientes
          photos={photoQueue.photos}
          selectionMessages={photoQueue.selectionMessages}
          onAdd={photoQueue.addPhotos}
          onRemove={photoQueue.removePhoto}
          onClear={photoQueue.clearPendingPhotos}
          isPreparing={photoQueue.isPreparing}
          isUploading={photoQueue.isUploading}
          disabled={loading || !formData.equipo_id}
          contextLabel={photoContextLabel}
        />
        {!formData.equipo_id && <p className="text-xs text-slate-500">Seleccione el equipo antes de agregar sus fotos.</p>}
        {isEditing && !savedPhotoDiagnosisId && <p className="text-xs text-slate-500">También puede agregar fotos al registro desde el botón Fotos, sin editar los datos del diagnóstico.</p>}

        <p className="text-xs text-gray-500">Enter avanza; ↑/↓ mueve entre campos de texto o sugerencias. Alt+flechas navega desde cualquier campo. En las notas, Ctrl+Enter avanza y Enter agrega una línea.</p>
        <div data-tour-target="actions" className={`flex justify-end pt-4 border-t border-gray-100 ${tourHighlightClass(activeTourTarget === 'actions')}`}>
          <button
            type="submit"
            disabled={loading || photoQueue.isBusy}
            className={`flex items-center gap-2 px-8 py-3 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 ${isEditing ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
          >
            {loading || photoQueue.isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Monitor className="w-5 h-5" />}
            {photoQueue.isUploading ? 'Subiendo fotos...' : loading ? 'Guardando diagnóstico...' : savedPhotoDiagnosisId
              ? photoQueue.photos.some((photo) => photo.status === 'failed') ? 'Reintentar fotos pendientes' : photoQueue.photos.some((photo) => photo.status !== 'uploaded') ? 'Subir fotos pendientes' : 'Finalizar registro'
              : isEditing ? 'Guardar Cambios' : 'Generar Diagnostico de Ingreso'}
          </button>
        </div>
    </form>
  </section>
);
