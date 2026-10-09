import React, { useEffect, useState } from 'react';
import Table from '../../../components/Table';
import { equiposAdminService } from '../services';

const columns = [
  { header: 'ID', accessor: 'id_equipo' },
  { header: 'Cliente', accessor: 'cliente' },
  { header: 'Tipo', accessor: 'tipo' },
  { header: 'Marca', accessor: 'marca' },
  { header: 'Modelo', accessor: 'modelo' },
  { header: 'Serie', accessor: 'numero_serie' },
  { header: 'Estado', accessor: 'estado' },
  {
    header: 'Acciones',
    accessor: 'acciones',
    render: (row) => (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={row.onEdit}
          className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 shadow-sm"
        >
          Editar
        </button>
      </div>
    ),
  },
];

const fetchEquipos = async (setEquipos, setLoading, setError) => {
  setLoading(true);
  try {
    const res = await equiposAdminService.getEquipos();
    const data = res.data;
    if (data.data) {
      setEquipos(
        data.data.map((e) => ({
          id_equipo: e.id_equipo,
          cliente: e.cliente?.nombre || '-',
          tipo: e.tipo || '-',
          marca: e.marca || '-',
          modelo: e.modelo || '-',
          numero_serie: e.numero_serie || '-',
          estado: e.diagnosticos?.[0]?.estado_del_diagnostico || '-',
          full: e,
        }))
      );
    } else {
      setError('No se pudo cargar la información de equipos');
    }
  } catch (e) {
    setError('Error de red o servidor');
  }
  setLoading(false);
};

export default function EquiposAvanzado() {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchError, setSearchError] = useState('');
  const showHelp = false;
  
  const [editingEquipo, setEditingEquipo] = useState(null);
  const [equipoEditLoading, setEquipoEditLoading] = useState(false);
  const [equipoEditMessage, setEquipoEditMessage] = useState('');

  useEffect(() => {
    fetchEquipos(setEquipos, setLoading, setError);
  }, []);

  const normalizeTerm = (term) => term.trim().toLowerCase();

  const openEquipoEdit = (equipo) => {
    setEditingEquipo({
      id_equipo: equipo.id_equipo,
      tipo: equipo.tipo === '-' ? '' : equipo.tipo,
      marca: equipo.marca === '-' ? '' : equipo.marca,
      modelo: equipo.modelo === '-' ? '' : equipo.modelo,
      numero_serie: equipo.numero_serie === '-' ? '' : equipo.numero_serie,
    });
    setEquipoEditMessage('');
  };

  const handleActualizarEquipo = async (event) => {
    event.preventDefault();
    if (!editingEquipo) return;

    setEquipoEditLoading(true);
    setEquipoEditMessage('');
    try {
      await equiposAdminService.updateEquipo(editingEquipo.id_equipo, {
        tipo: editingEquipo.tipo,
        marca: editingEquipo.marca,
        modelo: editingEquipo.modelo,
        numero_serie: editingEquipo.numero_serie,
      });
      setEquipoEditMessage('Equipo actualizado correctamente.');
      fetchEquipos(setEquipos, setLoading, setError);
      setTimeout(() => setEditingEquipo(null), 800);
    } catch (err) {
      setEquipoEditMessage(err.response?.data?.error || 'No se pudo actualizar el equipo.');
    } finally {
      setEquipoEditLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchText(value);
    if (/^\d+$/.test(value.trim()) && Number(value.trim()) <= 0) {
      setSearchError('Ingrese un ID de equipo válido mayor a 0');
    } else {
      setSearchError('');
    }
  };

  const clearFilters = () => {
    setSearchText('');
    setSearchError('');
  };

  const filteredEquipos = equipos.filter((equipo) => {
    const term = normalizeTerm(searchText);
    const matchesSearch = !term || [
      equipo.id_equipo?.toString(),
      equipo.cliente,
      equipo.tipo,
      equipo.marca,
      equipo.modelo,
      equipo.numero_serie,
      equipo.estado,
    ].some((field) => field?.toString().toLowerCase().includes(term));

    return matchesSearch;
  });

  const equiposWithActions = filteredEquipos.map((equipo) => ({
    ...equipo,
    onEdit: () => openEquipoEdit(equipo),
  }));

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión avanzada de equipos</h1>
          <p className="text-gray-400 text-sm mt-0.5">Busca equipos y revisa su estado actual en tiempo real.</p>
        </div>
      </div>

      {/* Grid Superior de Métricas */}
      <div className="grid gap-4 grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Encontrados</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{equiposWithActions.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filtros Activos</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{searchText ? 'Sí' : 'No'}</p>
        </div>
      </div>

      {/* Sección Filtros y Tabla Principal */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-5">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Equipos en taller</h2>
            <p className="text-sm text-gray-400">Usa los criterios globales para ganar precisión en la búsqueda.</p>
          </div>
          
          {/* Barra de Controles Organizada */}
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <input
                value={searchText}
                onChange={handleSearchChange}
                placeholder="Buscador inteligente: ID, cliente, tipo, marca, modelo, serie o estado..."
                className="w-full rounded-xl border border-gray-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100/50 transition"
              />
            </div>
            <div>
              <button
                type="button"
                onClick={clearFilters}
                className="w-full inline-flex items-center justify-center rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
                title="Limpiar filtros"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {searchError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{searchError}</div>}
        {loading && <div className="text-gray-400 text-center py-6">Cargando catálogo de equipos...</div>}
        {error && <div className="text-red-600 bg-red-50 p-4 rounded-xl">{error}</div>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            {equiposWithActions.length === 0 ? (
              <div className="text-center py-8 text-gray-400 bg-slate-50 rounded-xl border border-dashed border-gray-200">
                No se encontraron equipos que coincidan con los filtros aplicados.
              </div>
            ) : (
              <Table columns={columns} data={equiposWithActions} sortable />
            )}
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {editingEquipo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-800">Editar equipo</h3>
              <p className="text-sm text-gray-400">Equipo #{editingEquipo.id_equipo}</p>
            </div>

            <form onSubmit={handleActualizarEquipo} className="space-y-4">
              {[
                ['tipo', 'Tipo'],
                ['marca', 'Marca'],
                ['modelo', 'Modelo'],
                ['numero_serie', 'Número de serie'],
              ].map(([name, label]) => (
                <label key={name} className="block">
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                  <input
                    type="text"
                    value={editingEquipo[name] || ''}
                    onChange={(e) => setEditingEquipo((prev) => ({ ...prev, [name]: e.target.value }))}
                    className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50"
                  />
                </label>
              ))}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEquipo(null)}
                  className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={equipoEditLoading}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-400"
                >
                  {equipoEditLoading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>

              {equipoEditMessage && <div className="text-center text-sm font-semibold text-indigo-600">{equipoEditMessage}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
