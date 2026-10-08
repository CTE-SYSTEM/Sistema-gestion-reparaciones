import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Table from '../../../components/Table';
import { Plus, Search, Edit, ArrowRight, HelpCircle } from 'lucide-react';
import { GuidedTour, tourHighlightClass } from '../../shared/components/GuidedTour';
import { createCliente, getClientes, updateCliente } from '../services/clientesService';
import { useInfiniteAreaList } from '../../shared/hooks/useInfiniteAreaList';
import { handleFormNavigationKeyDown } from '../../shared/components/formKeyboardNavigation';

const emptyCliente = {
  nombre: '',
  telefono: '',
  direccion: '',
  correo: '',
  contacto_secundario: '',
};

// Función de validación de correo electrónico
const validateEmail = (email) => {
  if (!email || email.trim() === '') return true;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const formatPhone = (value = '') => {
  const rawDigits = String(value).replace(/\D/g, '');
  const digits = rawDigits.length > 8 ? rawDigits.slice(-8) : rawDigits;
  return digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
};

const normalizePhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '');
  return digits.length > 8 ? digits.slice(-8) : digits;
};

const sanitizeInternationalPhone = (value = '') => String(value).replace(/[^\d+\-()./\s]/g, '');

const normalizeClientePayload = (data = emptyCliente) => ({
  ...emptyCliente,
  ...data,
  nombre: data.nombre,
  telefono: normalizePhone(data.telefono),
  contacto_secundario: data.contacto_secundario,
});

const tourSteps = [
  {
    target: 'create',
    title: '1. Crear un cliente',
    text: 'Usa Nuevo Cliente para abrir el formulario. Desde aquí la secretaría registra a la persona antes de asociarle equipos u órdenes.',
  },
  {
    target: 'entries',
    title: '2. Datos del cliente',
    text: 'Registra nombre, teléfono y contacto secundario. El contacto secundario acepta formatos internacionales sin letras y conserva el formato escrito.',
  },
  {
    target: 'actions',
    title: '3. Guardar o continuar',
    text: 'Solo Guardar registra al cliente y deja el formulario limpio para capturar otro. Guardar y Continuar registra al cliente y abre Equipos para anotar el aparato que trae.',
  },
  {
    target: 'search',
    title: '4. Buscar rápido',
    text: 'Este buscador filtra la tabla en tiempo real por nombre o teléfono. Es útil cuando la lista de clientes crece mucho.',
  },
  {
    target: 'table',
    title: '5. Revisar, editar o cancelar',
    text: 'La tabla muestra los clientes registrados. Al tocar editar se abre el formulario con los datos del cliente y el botón cambia a Actualizar. Cancelar descarta la edición y evita guardar cambios por error.',
  },
];

const ClienteForm = ({ onSubmit, onCancel, initialData = null, activeTourTarget = '' }) => {
  const [formData, setFormData] = useState({
    nombre: initialData?.nombre || '',
    telefono: formatPhone(initialData?.telefono || ''),
    direccion: initialData?.direccion || '',
    correo: initialData?.correo || '',
    contacto_secundario: initialData?.contacto_secundario || '',
  });

  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    setFormData({
      nombre: initialData?.nombre || '',
      telefono: formatPhone(initialData?.telefono || ''),
      direccion: initialData?.direccion || '',
      correo: initialData?.correo || '',
      contacto_secundario: initialData?.contacto_secundario || '',
    });
    setEmailError(initialData?.correo && !validateEmail(initialData.correo) ? 'Formato de correo no válido' : '');
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;

    if (name === 'telefono') {
      nextValue = formatPhone(value);
    }

    if (name === 'contacto_secundario') {
      nextValue = sanitizeInternationalPhone(value);
    }

    if (name === 'correo') {
      setEmailError(value && !validateEmail(value) ? 'Formato de correo no válido' : '');
    }

    setFormData((prev) => ({ ...prev, [name]: nextValue }));
  };

  return (
    <form
      className="space-y-5"
      autoComplete="off"
      onKeyDown={handleFormNavigationKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(formData, event.nativeEvent.submitter?.value || 'save');
      }}
    >
      <div
        data-tour-target="entries"
        className={`grid grid-cols-1 md:grid-cols-2 gap-5 ${tourHighlightClass(activeTourTarget === 'entries')}`}
      >
        <Field 
          label="Nombre Completo" 
          name="nombre" 
          value={formData.nombre} 
          onChange={handleChange} 
          helpText="Ej.: María López"
          autoComplete="off"
          required 
        />
        <Field 
          label="Teléfono" 
          name="telefono" 
          value={formData.telefono} 
          onChange={handleChange} 
          inputMode="numeric" 
          helpText="Ej.: 8888 1234"
          maxLength={9} 
        />
        <Field 
          label="Correo Electrónico" 
          name="correo" 
          type="email" 
          value={formData.correo} 
          onChange={handleChange} 
          helpText="Ej.: nombre@ejemplo.com"
          error={emailError} 
        />
        <Field 
          label="Contacto Secundario" 
          name="contacto_secundario" 
          value={formData.contacto_secundario} 
          onChange={handleChange} 
          inputMode="tel" 
          helpText="Ej.: +1 212 555 0198"
        />
        <Field 
          label="Dirección" 
          name="direccion" 
          value={formData.direccion} 
          onChange={handleChange} 
          helpText="Ej.: Barrio Centro, una cuadra al norte de la escuela"
          className="md:col-span-2" 
        />
      </div>
      
      <FormActions 
        onCancel={onCancel} 
        isEditing={Boolean(initialData)} 
        activeTourTarget={activeTourTarget}
        isFormInvalid={!!emailError}
      />
      <p className="text-xs text-gray-500">Enter avanza; ↑/↓ mueve entre campos de texto o entre sugerencias. Alt+flechas navega desde cualquier campo.</p>
    </form>
  );
};

const Field = ({ label, className = '', error, helpText, ...props }) => (
  <div className={className}>
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
    <input
      {...props}
      aria-describedby={helpText ? `${props.name}-help` : undefined}
      className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
        error ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50/30' : 'border-gray-300'
      }`}
    />
    {helpText && <p id={`${props.name}-help`} className="mt-1 text-xs text-slate-500 text-left">{helpText}</p>}
    {error && <p className="text-red-500 text-xs mt-1.5 font-semibold">{error}</p>}
  </div>
);

const FormActions = ({ onCancel, isEditing, activeTourTarget, isFormInvalid }) => (
  <div
    data-tour-target="actions"
    className={`flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-100 ${tourHighlightClass(activeTourTarget === 'actions')}`}
  >
    <button
      type="button"
      onClick={onCancel}
      className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
    >
      Cancelar
    </button>
    
    <button 
      type="submit"
      value="save"
      disabled={isFormInvalid}
      className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all ${
        isFormInvalid ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-indigo-600 hover:bg-indigo-700 shadow-xs'
      }`}
    >
      {isEditing ? 'Actualizar' : 'Solo Guardar'}
    </button>

    {!isEditing && (
      <button 
        type="submit"
        value="next"
        disabled={isFormInvalid}
        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all ${
          isFormInvalid ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-indigo-600 hover:bg-indigo-700 shadow-xs'
        }`}
      >
        <span>Guardar y Continuar</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    )}
  </div>
);

const Clientes = () => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const clientesQuery = useInfiniteAreaList({
    queryKey: ['recepcion', 'clientes'],
    queryFn: getClientes,
    search: searchTerm,
  });
  const clientes = clientesQuery.rows;
  const loadClientes = () => clientesQuery.refetch();

  const activeTourTarget = showHelp ? tourSteps[tourStep].target : '';

  useEffect(() => {
    if (!showHelp || !activeTourTarget) return;

    const scrollTimer = window.setTimeout(() => {
      document
        .querySelector(`[data-tour-target="${activeTourTarget}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 80);

    return () => window.clearTimeout(scrollTimer);
  }, [activeTourTarget, showHelp]);

  const startTour = () => {
    setEditingCliente(null);
    setShowForm(true);
    setTourStep(0);
    setShowHelp(true);
  };

  const closeTour = () => {
    setShowHelp(false);
    setTourStep(0);
  };

  const goToNextTourStep = () => {
    if (tourStep === tourSteps.length - 1) {
      closeTour();
      return;
    }

    setTourStep((step) => step + 1);
  };

  const goToPreviousTourStep = () => {
    setTourStep((step) => Math.max(step - 1, 0));
  };

  const columnas = [
  { 
    header: 'ID', 
    accessor: 'id_cliente', 
    contentClassName: 'whitespace-nowrap text-xs font-bold text-indigo-600 py-1.5 px-2' 
  },
  { 
    header: 'Nombre', 
    accessor: 'nombre', 
    contentClassName: 'whitespace-nowrap text-xs font-semibold text-gray-800 py-1.5 px-2' 
  },
  { 
    header: 'Teléfono', 
    accessor: 'telefono', 
    contentClassName: 'whitespace-nowrap text-xs text-gray-600 py-1.5 px-2', 
    render: (row) => formatPhone(row.telefono) || '-' 
  },
  { 
    header: 'Correo', 
    accessor: 'correo', 
    contentClassName: 'text-xs text-gray-600 py-1.5 px-2' 
  },
  { 
    header: 'Contacto secundario', 
    accessor: 'contacto_secundario', 
    contentClassName: 'whitespace-nowrap text-xs text-gray-600 py-1.5 px-2', 
    render: (row) => row.contacto_secundario || '-' 
  },
  { 
    header: 'Dirección', 
    accessor: 'direccion', 
    contentClassName: 'max-w-[280px] text-xs whitespace-normal break-words text-gray-600 py-1.5 px-2' 
  },
  {
    header: 'Acciones',
    accessor: 'acciones',
    contentClassName: 'whitespace-nowrap py-1 px-2',
    render: (row) => (
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => { setEditingCliente(row); setShowForm(true); }}
          className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
          title="Editar"
          aria-label={`Editar cliente ${row.id_cliente}`}
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
      </div>
    ),
  },
];

  const filteredClientes = clientes;

  const handleSubmit = async (data, action) => {
    setLoading(true);
    setError(null);
    setMessage('');
    try {
      let response;
      const payload = normalizeClientePayload(data);
      if (editingCliente) {
        response = await updateCliente(editingCliente.id_cliente, payload);
      } else {
        response = await createCliente(payload);
      }

      if (action === 'next' && response?.data?.data?.id_cliente) {
        const idNuevo = response.data.data.id_cliente;
        navigate('/recepcion/equipos', { state: { clienteId: idNuevo, nombreCliente: payload.nombre } });
      } else if (action === 'save' && !editingCliente) {
        setMessage('Cliente registrado correctamente.');
        setShowForm(true);
        setEditingCliente(null);
        setFormKey((key) => key + 1);
        await loadClientes();
      } else {
        setMessage(editingCliente ? 'Cliente actualizado correctamente.' : 'Cliente registrado correctamente.');
        setShowForm(false);
        setEditingCliente(null);
        await loadClientes();
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al guardar el cliente. Verifica la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="min-h-screen bg-gray-50 p-4 space-y-4">
    {showHelp && (
      <GuidedTour
        steps={tourSteps}
        stepIndex={tourStep}
        onBack={goToPreviousTourStep}
        onClose={closeTour}
        onNext={goToNextTourStep}
      />
    )}

    {/* Encabezado Principal */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-left">
        <h1 className="m-0 text-xl font-bold text-gray-900 tracking-tight">Gestión de Clientes</h1>
        <p className="text-xs text-gray-500 font-medium mt-0.5">
          Registro de datos de contacto: nombre, teléfono, dirección, correo y contacto secundario.
        </p>
      </div>

      <div
        data-tour-target="create"
        className={`flex flex-wrap items-center gap-2 ${tourHighlightClass(activeTourTarget === 'create')}`}
      >
        <button
          type="button"
          onClick={startTour}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-all"
          title="Iniciar tutorial guiado"
        >
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <span>Ayuda</span>
        </button>

        <button
          onClick={() => { setEditingCliente(null); setShowForm(true); }}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>
    </div>

    {error && (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 text-left">
        {error}
      </div>
    )}

    {message && (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 text-left">
        {message}
      </div>
    )}

    {/* Formulario */}
    {showForm && (
      <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3 text-left">
          {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
        </h2>
        <ClienteForm
          key={formKey}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingCliente(null); }}
          initialData={editingCliente}
          activeTourTarget={activeTourTarget}
        />
      </div>
    )}

    {/* Buscador */}
    <div
      data-tour-target="search"
      className={`${tourHighlightClass(activeTourTarget === 'search')}`}
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o correo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all"
        />
      </div>
    </div>

    {/* Tabla de Clientes */}
    <div
      data-tour-target="table"
      className={`bg-white rounded-lg shadow-xs border border-gray-200 overflow-hidden ${tourHighlightClass(activeTourTarget === 'table')}`}
    >
      {loading || clientesQuery.isLoading ? (
        <div className="p-6 text-center text-xs font-semibold text-gray-500">Cargando...</div>
      ) : (
        <Table
          columns={columnas}
          data={filteredClientes}
          onLoadMore={() => clientesQuery.fetchNextPage()}
          hasMore={clientesQuery.hasNextPage}
          isLoadingMore={clientesQuery.isFetchingNextPage}
        />
      )}
    </div>
  </div>
);
};

export default Clientes;
