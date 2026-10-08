import React, { useEffect, useState } from 'react';
import Table from '../../../components/Table';
import { Edit, HelpCircle, Plus, Search, Trash2, X } from 'lucide-react';
import { GuidedTour, tourHighlightClass } from '../../shared/components/GuidedTour';
import {
  createTipoRepuesto,
  deleteTipoRepuesto,
  getTiposRepuesto,
  updateTipoRepuesto,
} from '../services/tiposRepuestoService';
import { useInfiniteAreaList } from '../../shared/hooks/useInfiniteAreaList';

const emptyTipo = {
  nombre_tipo: '',
  electronico: '',
};

const normalizeText = (value = '') => String(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

const tourSteps = [
  { target: 'create', title: '1. Crear tipo', text: 'Nuevo Tipo abre el formulario para registrar una categoria de repuesto.' },
  { target: 'form', title: '2. Tipo y electronico', text: 'Escribe el tipo de pieza y el equipo relacionado para que Repuestos muestre sugerencias claras.' },
  { target: 'search', title: '3. Buscar', text: 'Filtra por tipo o electronico para evitar crear categorias repetidas.' },
  { target: 'table', title: '4. Revisar usos', text: 'La tabla muestra cuantos repuestos estan unidos a cada tipo.' },
  { target: 'actions', title: '5. Editar o eliminar', text: 'Edita nombres mal escritos. Solo se puede eliminar si no hay repuestos unidos.' },
];



const TipoRepuestoForm = ({ 
  initialData = null, 
  onCancel, 
  onSubmit, 
  activeTourTarget = '', 
  sugerenciasTipos = [], 
  sugerenciasElectronicos = [] 
}) => {
  const [formData, setFormData] = useState({
    nombre_tipo: initialData?.nombre_tipo || '',
    electronico: initialData?.electronico || '',
  });

  useEffect(() => {
    setFormData({
      nombre_tipo: initialData?.nombre_tipo || '',
      electronico: initialData?.electronico || '',
    });
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      nombre_tipo: normalizeText(formData.nombre_tipo),
      electronico: normalizeText(formData.electronico),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <div data-tour-target="form" className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${tourHighlightClass(activeTourTarget === 'form')}`}>
        
        {/* CORRECCIÓN EXCELENTE: Ahora Tipo de repuesto también tiene datalist dinámico */}
        <div>
          <Field 
            label="Tipo de repuesto" 
            name="nombre_tipo" 
            value={formData.nombre_tipo} 
            onChange={handleChange} 
            placeholder="Selecciona o escribe (Ej: Batería, Pantalla)..." 
            list="lista-nombres-tipo"
            required 
            autoComplete="off"
          />
          <datalist id="lista-nombres-tipo">
            {sugerenciasTipos.map((tipoName, index) => (
              <option key={index} value={tipoName} />
            ))}
          </datalist>
        </div>
        
        {/* Autocompletado del Electrónico relacionado */}
        <div>
          <Field 
            label="Electrónico relacionado" 
            name="electronico" 
            value={formData.electronico} 
            onChange={handleChange} 
            placeholder="Selecciona o escribe (Ej: Laptop, Teléfono)..." 
            list="lista-electronicos"
            required
            autoComplete="off" 
          />
          <datalist id="lista-electronicos">
            {sugerenciasElectronicos.map((electro, index) => (
              <option key={index} value={electro} />
            ))}
          </datalist>
        </div>
      </div>
      
      <div className="flex justify-end gap-3 border-t pt-4">
        <button type="button" onClick={onCancel} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
          Cancelar
        </button>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm">
          {initialData ? 'Actualizar Tipo' : 'Guardar Tipo'}
        </button>
      </div>
    </form>
  );
};

const Field = ({ label, className = '', ...props }) => (
  <div className={className}>
    <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
    <input {...props} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
  </div>
);

const TiposRepuesto = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingTipo, setEditingTipo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const tiposQuery = useInfiniteAreaList({
    queryKey: ['bodega', 'tipos-repuesto'],
    queryFn: getTiposRepuesto,
    search: searchTerm,
  });
  const tipos = tiposQuery.rows;
  const loadTipos = () => tiposQuery.refetch();

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
    setEditingTipo(null);
    setShowForm(true);
    setTourStep(0);
    setShowHelp(true);
  };

  const closeTour = () => {
    setShowHelp(false);
    setTourStep(0);
    setShowForm(false);
    setEditingTipo(null);
  };

  const handleTourNext = () => {
    if (tourStep === tourSteps.length - 1) {
      closeTour();
      return;
    }
    if (tourSteps[tourStep + 1]?.target === 'search') {
      setShowForm(false);
      setEditingTipo(null);
    }
    setTourStep((step) => step + 1);
  };

  const handleSubmit = async (data) => {
    setLoading(true);
    setError(null);
    try {
      if (editingTipo) {
        await updateTipoRepuesto(editingTipo.id_tipo_repuesto, data);
      } else {
        await createTipoRepuesto(data || emptyTipo);
      }

      setShowForm(false);
      setEditingTipo(null);
      await loadTipos();
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al guardar el tipo de repuesto');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que quieres eliminar este tipo de repuesto?')) return;
    setLoading(true);
    setError(null);
    try {
      await deleteTipoRepuesto(id);
      await loadTipos();
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al eliminar el tipo de repuesto');
    } finally {
      setLoading(false);
    }
  };

  const filteredTipos = tipos;

  const columnas = [
    { header: 'ID', accessor: 'id_tipo_repuesto', contentClassName: 'whitespace-nowrap leading-relaxed' },
    { header: 'Tipo de repuesto', accessor: 'nombre_tipo', contentClassName: 'whitespace-nowrap leading-relaxed font-semibold text-gray-700' },
    { header: 'Electrónico', accessor: 'electronico', contentClassName: 'whitespace-nowrap leading-relaxed text-gray-600' },
    {
      header: 'Repuestos unidos',
      accessor: 'repuestos',
      contentClassName: 'whitespace-nowrap leading-relaxed font-medium',
      render: (row) => (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${row._count?.repuestos > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
          {row._count?.repuestos ?? 0} piezas
        </span>
      ),
    },
    {
      header: 'Acciones',
      accessor: 'acciones',
      contentClassName: 'whitespace-nowrap leading-relaxed',
      render: (row) => (
        <div className="flex gap-2">
          <div data-tour-target="actions" className={`flex gap-2 ${tourHighlightClass(activeTourTarget === 'actions')}`}>
            <button type="button" onClick={() => { setEditingTipo(row); setShowForm(true); }} className="rounded p-1 text-blue-600 hover:bg-blue-50 transition-colors" title="Editar" aria-label={`Editar tipo ${row.id_tipo_repuesto}`}>
              <Edit className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => handleDelete(row.id_tipo_repuesto)} className="rounded p-1 text-red-600 hover:bg-red-50 transition-colors" title="Eliminar" aria-label={`Eliminar tipo ${row.id_tipo_repuesto}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ),
    },
  ];

  return (
  <div className="min-h-screen bg-gray-50 p-6 text-left">
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
      <div>
        <h2 className="text-3xl font-black text-gray-800 tracking-tight">Tipos de Repuesto</h2>
        <p className="text-sm font-medium text-gray-500 italic mt-0.5">Clasifica repuestos y relaciona cada tipo con el electrónico correspondiente.</p>
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
          onClick={() => { setEditingTipo(null); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Tipo</span>
        </button>
      </div>
    </div>

    {error && (
      <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded-r-lg flex items-center gap-2">
        <span>{error}</span>
      </div>
    )}

    {/* Formulario Modal/Desplegable */}
    {showForm && (
      <div className="mb-8 rounded-2xl border border-indigo-100 bg-white p-6 shadow-xl animate-in fade-in zoom-in duration-200">
        <h3 className="mb-4 text-base font-bold text-gray-800">
          {editingTipo ? 'Editar Tipo de Repuesto' : 'Nuevo Tipo de Repuesto'}
        </h3>
        <TipoRepuestoForm
          initialData={editingTipo}
          onCancel={() => { setShowForm(false); setEditingTipo(null); }}
          onSubmit={handleSubmit}
          activeTourTarget={activeTourTarget}
          sugerenciasTipos={[
            ...new Set(tipos.map((t) => t.nombre_tipo).filter(Boolean)),
          ]}
          sugerenciasElectronicos={[
            ...new Set(tipos.map((t) => t.electronico).filter(Boolean)),
          ]}
        />
      </div>
    )}

    {/* Buscador */}
    <div data-tour-target="search" className={`mb-6 ${tourHighlightClass(activeTourTarget === 'search')}`}>
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por tipo o electrónico (Ej: Laptop, Batería, Teléfono)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      </div>
    </div>

    {/* Tabla */}
    <div data-tour-target="table" className={`rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden ${tourHighlightClass(activeTourTarget === 'table')}`}>
      {loading || tiposQuery.isLoading ? (
        <div className="p-12 text-center text-xs font-bold text-indigo-600 flex justify-center items-center gap-2">
          <span>Cargando categorías...</span>
        </div>
      ) : (
        <Table
          columns={columnas}
          data={filteredTipos}
          onLoadMore={() => tiposQuery.fetchNextPage()}
          hasMore={tiposQuery.hasNextPage}
          isLoadingMore={tiposQuery.isFetchingNextPage}
        />
      )}
    </div>
  </div>
);
};

export default TiposRepuesto;
