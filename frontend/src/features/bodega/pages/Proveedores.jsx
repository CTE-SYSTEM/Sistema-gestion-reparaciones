import React, { useEffect, useState } from 'react';
import Table from '../../../components/Table';
import { Edit, HelpCircle, Plus, Search, Trash2, X } from 'lucide-react';
import { GuidedTour, tourHighlightClass } from '../../shared/components/GuidedTour';
import { createProveedor, deleteProveedor, getProveedores, updateProveedor } from '../services/proveedoresService';
import { useInfiniteAreaList } from '../../shared/hooks/useInfiniteAreaList';

const normalizeText = (value = '') => String(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
const isValidEmail = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const tourSteps = [
  { target: 'create', title: '1. Crear proveedor', text: 'Nuevo Proveedor abre el formulario para registrar tiendas o suplidores.' },
  { target: 'identity', title: '2. Identificacion', text: 'Nombre es obligatorio. Telefono y correo ayudan a evitar compras mal asociadas.' },
  { target: 'details', title: '3. Direccion y notas', text: 'Agrega direccion, web y notas utiles sobre calidad, horarios o condiciones.' },
  { target: 'search', title: '4. Buscar', text: 'Filtra antes de crear para evitar proveedores duplicados.' },
  { target: 'table', title: '5. Revisar proveedores', text: 'La tabla permite comprobar contacto, web, direccion y notas.' },
  { target: 'actions', title: '6. Editar o desactivar', text: 'Edita datos mal escritos o desactiva proveedores que ya no se usan.' },
];



const ProveedorForm = ({ onSubmit, onCancel, initialData = null, activeTourTarget = '' }) => {
  const [formData, setFormData] = useState({
    nombre: initialData?.nombre || '',
    telefono: initialData?.telefono || '',
    direccion: initialData?.direccion || '',
    correo: initialData?.correo || '',
    web: initialData?.web || '',
    notas: initialData?.notas || '',
    nombre_contacto: initialData?.nombre_contacto || '',
    horario_atencion: initialData?.horario_atencion || '',
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setFormData({
      nombre: initialData?.nombre || '',
      telefono: initialData?.telefono || '',
      direccion: initialData?.direccion || '',
      correo: initialData?.correo || '',
      web: initialData?.web || '',
      notas: initialData?.notas || '',
      nombre_contacto: initialData?.nombre_contacto || '',
      horario_atencion: initialData?.horario_atencion || '',
    });
    setFormError('');
  }, [initialData]);

  const handleChange = (event) => {
    setFormError('');
    setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      nombre: normalizeText(formData.nombre),
      telefono: normalizeText(formData.telefono),
      direccion: normalizeText(formData.direccion),
      correo: normalizeText(formData.correo),
      web: normalizeText(formData.web),
      notas: normalizeText(formData.notas),
      nombre_contacto: normalizeText(formData.nombre_contacto),
      horario_atencion: normalizeText(formData.horario_atencion),
    };

    if (!payload.nombre) {
      setFormError('El nombre del proveedor es obligatorio.');
      return;
    }

    if (!isValidEmail(payload.correo)) {
      setFormError('El correo no tiene un formato valido.');
      return;
    }

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div data-tour-target="identity" className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${tourHighlightClass(activeTourTarget === 'identity')}`}>
        <Field label="Nombre" name="nombre" value={formData.nombre} onChange={handleChange} required maxLength={80} />
        <Field label="Telefono" name="telefono" value={formData.telefono} onChange={handleChange} maxLength={30} />
        <Field label="Correo" name="correo" type="email" value={formData.correo} onChange={handleChange} maxLength={120} />
        <Field label="Web" name="web" value={formData.web} onChange={handleChange} placeholder="proveedor.com" maxLength={160} />
        <Field label="Persona de contacto" name="nombre_contacto" value={formData.nombre_contacto} onChange={handleChange} maxLength={100} />
        <Field label="Horario de atención" name="horario_atencion" value={formData.horario_atencion} onChange={handleChange} maxLength={120} />
      </div>

      <div data-tour-target="details" className={tourHighlightClass(activeTourTarget === 'details')}>
        <Field label="Direccion" name="direccion" value={formData.direccion} onChange={handleChange} maxLength={180} />
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <textarea name="notas" value={formData.notas} onChange={handleChange} rows={3} maxLength={300} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{formError}</div>}

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
        <button type="submit" className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">{initialData ? 'Actualizar' : 'Guardar'}</button>
      </div>
    </form>
  );
};

const Field = ({ label, className = '', ...props }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input {...props} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
  </div>
);

const Proveedores = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const proveedoresQuery = useInfiniteAreaList({
    queryKey: ['bodega', 'proveedores'],
    queryFn: getProveedores,
    search: searchTerm,
  });
  const proveedores = proveedoresQuery.rows;
  const loadProveedores = () => proveedoresQuery.refetch();

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
    setEditingProveedor(null);
    setShowForm(true);
    setTourStep(0);
    setShowHelp(true);
  };

  const closeTour = () => {
    setShowHelp(false);
    setTourStep(0);
    setShowForm(false);
    setEditingProveedor(null);
  };

  const handleTourNext = () => {
    if (tourStep === tourSteps.length - 1) {
      closeTour();
      return;
    }
    if (tourSteps[tourStep + 1]?.target === 'search') {
      setShowForm(false);
      setEditingProveedor(null);
    }
    setTourStep((step) => step + 1);
  };

  const handleSubmit = async (data) => {
    setLoading(true);
    setError(null);
    try {
      if (editingProveedor) await updateProveedor(editingProveedor.id_proveedor, data);
      else await createProveedor(data);
      setShowForm(false);
      setEditingProveedor(null);
      await loadProveedores();
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al guardar el proveedor');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Seguro que quieres desactivar este proveedor?')) return;
    setLoading(true);
    setError(null);
    try {
      await deleteProveedor(id);
      await loadProveedores();
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al desactivar el proveedor');
    } finally {
      setLoading(false);
    }
  };

  const columnas = [
    { header: 'ID', accessor: 'id_proveedor' },
    { header: 'Nombre', accessor: 'nombre' },
    { header: 'Contacto', accessor: 'nombre_contacto' },
    { header: 'Horario', accessor: 'horario_atencion' },
    { header: 'Telefono', accessor: 'telefono', render: (row) => row.telefono || '-' },
    { header: 'Correo', accessor: 'correo', render: (row) => row.correo || '-' },
    {
      header: 'Web',
      accessor: 'web',
      render: (row) => row.web ? (
        <a href={row.web} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block max-w-[150px]">
          {row.web}
        </a>
      ) : '-',
    },
    {
      header: 'Direccion',
      accessor: 'direccion',
      render: (row) => <p className="min-w-[200px] whitespace-normal break-words">{row.direccion || '-'}</p>,
    },
    {
      header: 'Notas',
      accessor: 'notas',
      render: (row) => <p className="italic text-gray-500 min-w-[150px] whitespace-normal">{row.notas || '-'}</p>,
    },
    {
      header: 'Acciones',
      accessor: 'acciones',
      render: (row) => (
        <div data-tour-target="actions" className={`flex gap-2 whitespace-nowrap ${tourHighlightClass(activeTourTarget === 'actions')}`}>
          <button type="button" onClick={() => { setEditingProveedor(row); setShowForm(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Editar" aria-label={`Editar proveedor ${row.id_proveedor}`}><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => handleDelete(row.id_proveedor)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Desactivar" aria-label={`Desactivar proveedor ${row.id_proveedor}`}><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const filteredProveedores = proveedores;

  return (
  <div className="p-6 bg-gray-50 min-h-screen">
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
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="text-left">
        <h2 className="text-3xl font-black text-gray-800 tracking-tight">Gestión de Proveedores</h2>
        <p className="text-sm font-medium text-gray-500 italic mt-0.5">Campos reales: nombre, teléfono, dirección, correo, web y notas.</p>
      </div>

      <div data-tour-target="create" className={`flex flex-wrap gap-3 ${tourHighlightClass(activeTourTarget === 'create')}`}>
        <button
          type="button"
          onClick={startTour}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-xs transition-all"
          title="Iniciar tutorial guiado"
        >
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <span>Ayuda</span>
        </button>

        <button
          type="button"
          onClick={() => { setEditingProveedor(null); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Proveedor</span>
        </button>
      </div>
    </div>

    {error && (
      <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded-r-lg flex items-center gap-2 text-left">
        <span>{error}</span>
      </div>
    )}

    {/* Formulario Modal/Desplegable */}
    {showForm && (
      <div className="mb-8 bg-white rounded-2xl shadow-xl border border-indigo-100 p-6 animate-in fade-in zoom-in duration-200 text-left">
        <h3 className="text-base font-bold mb-4 text-gray-800">
          {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        </h3>
        <ProveedorForm
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingProveedor(null); }}
          initialData={editingProveedor}
          activeTourTarget={activeTourTarget}
        />
      </div>
    )}

    {/* Buscador */}
    <div data-tour-target="search" className={`mb-6 ${tourHighlightClass(activeTourTarget === 'search')}`}>
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar proveedores..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      </div>
    </div>

    {/* Tabla */}
    <div data-tour-target="table" className={`bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden ${tourHighlightClass(activeTourTarget === 'table')}`}>
      {loading || proveedoresQuery.isLoading ? (
        <div className="p-12 text-center text-xs font-bold text-indigo-600 flex justify-center items-center gap-2">
          <span>Cargando...</span>
        </div>
      ) : (
        <Table
          columns={columnas}
          data={filteredProveedores}
          onLoadMore={() => proveedoresQuery.fetchNextPage()}
          hasMore={proveedoresQuery.hasNextPage}
          isLoadingMore={proveedoresQuery.isFetchingNextPage}
        />
      )}
    </div>
  </div>
);
};

export default Proveedores;
