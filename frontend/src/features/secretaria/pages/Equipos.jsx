import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Table from '../../../components/Table';
import Autocomplete from '../components/shared/Autocomplete';
import { Plus, Search, Edit, Phone, User, HelpCircle, X, ArrowRight } from 'lucide-react';
import { GuidedTour, tourHighlightClass } from '../components/shared/GuidedTour';
import { getClientes } from '../services/clientesService';
import { createEquipo, getEquipos, updateEquipo } from '../services/equiposService';
import { useInfiniteSecretariaList } from '../hooks/useInfiniteSecretariaList';
import { handleFormNavigationKeyDown } from '../components/shared/formKeyboardNavigation';

const BASE_TIPOS_EQUIPO = ['Laptop', 'Celular', 'Impresora', 'Monitor', 'Tablet', 'Pc Escritorio', 'Consola'];

const toPascalCase = (value) => (
  value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
);

const sanitizeEquipmentText = (value = '') => String(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

const getTiposSugeridos = (equipos) => {
  const tipos = [...BASE_TIPOS_EQUIPO, ...equipos.map((equipo) => equipo.tipo).filter(Boolean)]
    .map(toPascalCase);

  return [...new Set(tipos)].sort((a, b) => a.localeCompare(b));
};

const sameText = (left = '', right = '') =>
  String(left).trim().localeCompare(String(right).trim(), 'es', { sensitivity: 'base' }) === 0;

const uniqueSorted = (values = []) =>
  [...new Set(values.map(sanitizeEquipmentText).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

const getEquiposPorTipo = (equipos = [], tipo = '') =>
  equipos.filter((equipo) => tipo && sameText(equipo.tipo, tipo));

const getMarcasSugeridas = (equipos = [], tipo = '') =>
  uniqueSorted(getEquiposPorTipo(equipos, tipo).map((equipo) => equipo.marca));

const getModelosSugeridos = (equipos = [], tipo = '', marca = '') => {
  const equiposPorTipo = getEquiposPorTipo(equipos, tipo);
  const equiposFiltrados = marca
    ? equiposPorTipo.filter((equipo) => sameText(equipo.marca, marca))
    : equiposPorTipo;

  return uniqueSorted(equiposFiltrados.map((equipo) => equipo.modelo));
};

const tourSteps = [
  { target: 'create', title: '1. Registrar equipo', text: 'Nuevo Equipo abre el formulario. Si vienes desde Clientes, el cliente ya queda seleccionado para evitar capturar el equipo a otra persona.' },
  { target: 'client', title: '2. Confirmar cliente', text: 'Primero confirma el cliente correcto. La verificacion muestra telefono e ID para reducir errores antes de guardar.' },
  { target: 'details', title: '3. Datos seguros', text: 'Tipo, marca y modelo son obligatorios. Las sugerencias de marca y modelo se filtran por el tipo de equipo seleccionado.' },
  { target: 'actions', title: '4. Guardar o seguir', text: 'Guardar Equipo registra el aparato y vuelve a la lista. Guardar y Seguir registra el aparato y abre Diagnostico con cliente y equipo seleccionados.' },
  { target: 'search', title: '5. Buscar por cliente', text: 'El buscador filtra por nombre del cliente para encontrar rapidamente sus equipos.' },
  { target: 'table', title: '6. Revisar y editar', text: 'La tabla permite revisar y editar equipos. No se elimina desde secretaria para evitar perdida accidental de registros.' },
];


// Ordenamiento alfabético completo de la A a la Z garantizando que no se mutile ningún dato
const sortClientesByName = (clientes = []) =>
  [...clientes].sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }));

const EquipoForm = ({ onSubmit, onCancel, initialData = null, clientes = [], equipos = [], preSelectedClient = null, onClientQueryChange, tiposSugeridos = [], activeTourTarget = '' }) => {
  const [formData, setFormData] = useState({
    cliente_id: initialData?.cliente_id || preSelectedClient?.id || '',
    tipo: initialData?.tipo || '',
    marca: initialData?.marca || '',
    modelo: initialData?.modelo || '',
    numero_serie: initialData?.numero_serie || '',
    observaciones_generales: initialData?.observaciones_generales || '',
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setFormData({
      cliente_id: initialData?.cliente_id || preSelectedClient?.id || '',
      tipo: initialData?.tipo || '',
      marca: initialData?.marca || '',
      modelo: initialData?.modelo || '',
      numero_serie: initialData?.numero_serie || '',
      observaciones_generales: initialData?.observaciones_generales || '',
    });
    setFormError('');
  }, [initialData, preSelectedClient?.id]);

  const clientesDisponibles = [...clientes];
  for (const cliente of [initialData?.cliente, preSelectedClient]) {
    if (cliente?.id_cliente && !clientesDisponibles.some((item) => String(item.id_cliente) === String(cliente.id_cliente))) {
      clientesDisponibles.push(cliente);
    }
  }
  const clienteInfo = clientesDisponibles.find(c => String(c.id_cliente) === String(formData.cliente_id));
  const marcasSugeridas = getMarcasSugeridas(equipos, formData.tipo);
  const modelosSugeridos = getModelosSugeridos(equipos, formData.tipo, formData.marca);
  const handleChange = (e) => {
    setFormError('');
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'tipo' ? { marca: '', modelo: '' } : {}),
      ...(name === 'marca' ? { modelo: '' } : {}),
    }));
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      tipo: toPascalCase(sanitizeEquipmentText(formData.tipo)),
      marca: sanitizeEquipmentText(formData.marca),
      modelo: sanitizeEquipmentText(formData.modelo),
      numero_serie: sanitizeEquipmentText(formData.numero_serie),
    };

    if (!payload.cliente_id || !payload.tipo || !payload.marca || !payload.modelo) {
      setFormError('Seleccione un cliente y complete tipo, marca y modelo antes de guardar.');
      return;
    }

    onSubmit(payload, e.nativeEvent.submitter?.value || 'save');
  };

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleFormNavigationKeyDown} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
        {/* Selector de Cliente */}
        <div
          data-tour-target="client"
          className={`${clienteInfo ? "md:col-span-1" : "md:col-span-2"} ${tourHighlightClass(activeTourTarget === 'client')}`}
        >
          <Autocomplete
            label="Cliente"
            name="cliente_id"
            value={formData.cliente_id}
            onChange={handleChange}
            options={clientesDisponibles}
            matchMode="prefix"
            onQueryChange={onClientQueryChange}
            getOptionValue={(cliente) => cliente.id_cliente}
            getOptionLabel={(cliente) => cliente.nombre || `Cliente #${cliente.id_cliente}`}
            getOptionDescription={(cliente) => `ID: ${cliente.id_cliente}${cliente.telefono ? ` | ${cliente.telefono}` : ''}`}
            placeholder=""
            helpText="Ej.: nombre, ID o teléfono del cliente"
            emptyMessage="No hay clientes con ese criterio"
            required
          />
        </div>

        {/* Verificación visual en Formulario */}
        {clienteInfo && (
          <div className="animate-in fade-in zoom-in duration-200">
            <label className="block text-sm font-medium text-indigo-600 mb-1 font-bold">Verificación de Usuario</label>
            <div className="flex items-center justify-between w-full px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm h-[42px]">
              <div className="flex items-center gap-2 text-indigo-700">
                <Phone className="w-4 h-4" />
                <span className="text-sm font-semibold">{clienteInfo.telefono || 'Sin número'}</span>
              </div>
              <span className="text-[10px] font-mono bg-indigo-200 px-2 py-0.5 rounded text-indigo-800">
                ID: {clienteInfo.id_cliente}
              </span>
            </div>
          </div>
        )}

        <div
          data-tour-target="details"
          className={`md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 ${tourHighlightClass(activeTourTarget === 'details')}`}
        >
          <TipoField value={formData.tipo} onChange={handleChange} tiposSugeridos={tiposSugeridos} />
          <MarcaField value={formData.marca} onChange={handleChange} marcasSugeridas={marcasSugeridas} disabled={!formData.tipo} />
          <ModeloField value={formData.modelo} onChange={handleChange} modelosSugeridos={modelosSugeridos} disabled={!formData.tipo} />
          <Field label="Número de Serie" name="numero_serie" value={formData.numero_serie} onChange={handleChange} helpText="Ej.: SN12345678" maxLength={80} />
          <label className="md:col-span-2 block text-sm text-gray-700">Observaciones generales del equipo
            <textarea name="observaciones_generales" value={formData.observaciones_generales} onChange={handleChange} aria-describedby="observaciones_generales-help" rows={2} className="mt-1 w-full rounded-lg border border-gray-300 p-2" />
            <span id="observaciones_generales-help" className="mt-1 block text-xs text-slate-500">Ej.: Carcasa con rayones en la tapa</span>
          </label>
        </div>
      </div>

      {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{formError}</div>}
      <p className="text-xs text-gray-500">Enter avanza; ↑/↓ mueve entre campos de texto o sugerencias. Alt+flechas navega desde cualquier campo. En las observaciones, Ctrl+Enter avanza y Enter agrega una línea.</p>

      <div
        data-tour-target="actions"
        className={`flex flex-wrap justify-end gap-3 pt-4 border-t mt-2 ${tourHighlightClass(activeTourTarget === 'actions')}`}
      >
        <button type="button" onClick={onCancel} className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium">
          Cancelar
        </button>
        <button type="submit" value="save" className="px-6 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md transition-all font-bold">
          {initialData ? 'Actualizar Equipo' : 'Guardar Equipo'}
        </button>
        {!initialData && (
          <button type="submit" value="next" className="flex items-center gap-2 px-6 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md transition-all font-bold">
            Guardar y Seguir <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </form>
  );
};

const Field = ({ label, className = '', helpText, ...props }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input {...props} aria-describedby={helpText ? `${props.name}-help` : undefined} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
    {helpText && <p id={`${props.name}-help`} className="mt-1 text-xs text-slate-500 text-left">{helpText}</p>}
  </div>
);

const TipoField = ({ value, onChange, tiposSugeridos }) => (
  <div>
    <Autocomplete
      label="Tipo"
      name="tipo"
      value={value}
      onChange={onChange}
      options={tiposSugeridos.map((tipo) => ({ value: tipo, label: tipo }))}
      placeholder=""
      helpText="Ej.: Laptop, Consola o Monitor"
      emptyMessage="Escriba un nuevo tipo de equipo"
      allowCustom
      required
    />
  </div>
);

const MarcaField = ({ value, onChange, marcasSugeridas, disabled }) => (
  <div>
    <Autocomplete
      label="Marca"
      name="marca"
      value={value}
      onChange={onChange}
      options={marcasSugeridas.map((marca) => ({ value: marca, label: marca }))}
      placeholder=""
      helpText={disabled ? 'Seleccione un tipo primero. Ej.: HP, Sony o Samsung' : 'Ej.: HP, Sony o Samsung'}
      emptyMessage="Escriba una nueva marca para este tipo"
      allowCustom
      disabled={disabled}
      maxLength={40}
      required
    />
  </div>
);

const ModeloField = ({ value, onChange, modelosSugeridos, disabled }) => (
  <div>
    <Autocomplete
      label="Modelo"
      name="modelo"
      value={value}
      onChange={onChange}
      options={modelosSugeridos.map((modelo) => ({ value: modelo, label: modelo }))}
      placeholder=""
      helpText={disabled ? 'Seleccione un tipo primero. Ej.: IdeaPad 3 o PlayStation 5' : 'Ej.: IdeaPad 3 o PlayStation 5'}
      emptyMessage="Escriba un nuevo modelo para este tipo"
      allowCustom
      disabled={disabled}
      maxLength={60}
      required
    />
  </div>
);


const Equipos = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [clienteSearch, setClienteSearch] = useState('');
  const [showForm, setShowForm] = useState(!!location.state?.clienteId);
  const [editingEquipo, setEditingEquipo] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const equiposQuery = useInfiniteSecretariaList({
    queryKey: ['secretaria', 'equipos'],
    queryFn: getEquipos,
    search: searchTerm,
  });
  const equipos = equiposQuery.rows;
  const tiposSugeridos = getTiposSugeridos(equipos);

  const preSelectedClient = location.state?.clienteId ? {
    id: location.state.clienteId,
    id_cliente: location.state.clienteId,
    nombre: location.state.nombreCliente
  } : null;

  const loadData = async () => {
    setLoading(true);
    try {
      const cRes = await getClientes({ page: 1, pageSize: 20 });
      setClientes((prev) => sortClientesByName([
        ...new Map([...prev, ...(cRes.data.data || [])].map((cliente) => [cliente.id_cliente, cliente])).values(),
      ]));
    } catch (err) {
      setError('Error al cargar clientes');
    }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const search = clienteSearch.trim();
    if (!search) return undefined;

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await getClientes({ page: 1, pageSize: 20, search, searchMode: 'prefix' });
        if (!active) return;
        setClientes((prev) => sortClientesByName([
          ...new Map([...prev, ...(response.data.data || [])].map((cliente) => [cliente.id_cliente, cliente])).values(),
        ]));
        setError(null);
      } catch {
        if (active) setError('No se pudo buscar clientes. Intente de nuevo.');
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [clienteSearch]);

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
    setEditingEquipo(null);
    setShowForm(true);
    setTourStep(0);
    setShowHelp(true);
  };

  const closeTour = () => {
    setShowHelp(false);
    setTourStep(0);
  };

  const handleTourNext = () => {
    if (tourStep === tourSteps.length - 1) {
      closeTour();
      return;
    }
    setTourStep((step) => step + 1);
  };

  const handleSubmit = async (data, action = 'save') => {
    setLoading(true);
    setError(null);
    try {
      let response;
      if (editingEquipo) response = await updateEquipo(editingEquipo.id_equipo, data);
      else response = await createEquipo(data);

      const equipoGuardado = response?.data?.data || response?.data?.equipo || response?.data;

      if (action === 'next' && !editingEquipo) {
        navigate('/secretaria/diagnostico', {
          state: {
            clienteId: data.cliente_id,
            equipoId: equipoGuardado?.id_equipo,
          },
        });
        return;
      }

      setShowForm(false);
      setEditingEquipo(null);
      window.history.replaceState({}, document.title);
      await Promise.all([loadData(), equiposQuery.refetch()]);
    } catch {
      setError('Error al guardar. Revise que el cliente exista y que tipo, marca y modelo esten completos.');
    }
    finally { setLoading(false); }
  };

  const columnas = [
    { header: 'ID', accessor: 'id_equipo' },
    { 
      header: 'Cliente', 
      accessor: 'cliente', 
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-800">{row.cliente?.nombre || 'N/A'}</span>
          <span className="text-[10px] text-indigo-600 font-mono font-bold uppercase tracking-tighter">
            ID Cliente: {row.cliente?.id_cliente || 'N/A'}
          </span>
        </div>
      )
    },
    { header: 'Tipo', accessor: 'tipo' },
    { header: 'Marca', accessor: 'marca' },
    { header: 'Modelo', accessor: 'modelo' },
    { header: 'No. Serie', accessor: 'numero_serie' },
    { header: 'Observaciones', accessor: 'observaciones_generales' },
    {
      header: 'Acciones',
      accessor: 'acciones',
      render: (row) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => { setEditingEquipo(row); setShowForm(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Editar" aria-label={`Editar equipo ${row.id_equipo}`}><Edit className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const filteredEquipos = equipos;

  return (
  <div className="p-4 bg-gray-50 min-h-screen space-y-4">
    {showHelp && (
      <GuidedTour
        steps={tourSteps}
        stepIndex={tourStep}
        onBack={() => setTourStep((step) => Math.max(step - 1, 0))}
        onClose={closeTour}
        onNext={handleTourNext}
      />
    )}

    {/* Encabezado Principal */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-left">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Equipos</h2>
        <p className="text-xs text-gray-500 font-medium mt-0.5">Listado general de dispositivos recibidos.</p>
      </div>

      <div data-tour-target="create" className={`flex flex-wrap items-center gap-2 ${tourHighlightClass(activeTourTarget === 'create')}`}>
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
          onClick={() => { setEditingEquipo(null); setShowForm(true); }}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Equipo</span>
        </button>
      </div>
    </div>

    {error && (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 text-left">
        {error}
      </div>
    )}

    {/* Formulario de Registro / Edición */}
    {showForm && (
      <div className="bg-white rounded-lg shadow-xs p-4 border border-indigo-100 animate-in fade-in slide-in-from-top-2">
        <h3 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2 flex items-center gap-2 text-left">
          <User className="w-4 h-4 text-indigo-600" />
          {editingEquipo ? 'Editar Equipo' : 'Registro de Nuevo Equipo'}
        </h3>
        <EquipoForm 
          onSubmit={handleSubmit} 
          onCancel={() => { setShowForm(false); setEditingEquipo(null); }} 
          initialData={editingEquipo} 
          clientes={clientes}
          onClientQueryChange={setClienteSearch}
          equipos={equipos}
          preSelectedClient={preSelectedClient}
          tiposSugeridos={tiposSugeridos}
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
          placeholder="Buscar por nombre del cliente..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all" 
        />
      </div>
    </div>

    {/* Tabla de Equipos */}
    <div
      data-tour-target="table"
      className={`bg-white rounded-lg shadow-xs border border-gray-200 overflow-hidden ${tourHighlightClass(activeTourTarget === 'table')}`}
    >
      {loading || (equiposQuery.isLoading && !equipos.length) ? (
        <div className="p-6 text-center text-xs font-semibold text-gray-500">Consultando servidor...</div>
      ) : (
        <Table
          columns={columnas}
          data={filteredEquipos}
          onLoadMore={() => equiposQuery.fetchNextPage()}
          hasMore={equiposQuery.hasNextPage}
          isLoadingMore={equiposQuery.isFetchingNextPage}
        />
      )}
    </div>
  </div>
);
};

export default Equipos;
