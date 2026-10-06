import { Edit3, Filter, Search, ShieldAlert } from 'lucide-react';
import { EstadoBadge, PrioridadBadge } from './badges';
import { tourHighlightClass } from './constants';

const TableRow = ({ diagnostico, onEdit, onPhotos, onHistory, onDetails }) => {
  const tieneTecnico = Boolean(diagnostico.tecnico_id || diagnostico.id_tecnico);

  return (
    <tr className="hover:bg-indigo-50/30 transition-colors">
      <td className="px-4 py-3 font-mono font-bold text-indigo-600">#{diagnostico.id_diagnostico}</td>
      <td className="px-4 py-3 font-medium text-gray-900">{diagnostico.equipo?.cliente?.nombre || 'N/A'}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-bold text-gray-700">{diagnostico.equipo?.modelo || 'Sin modelo'}</span>
          <span className="text-[10px] uppercase text-gray-400">{diagnostico.equipo?.marca || 'Sin marca'}</span>
          <span className="text-xs font-bold text-indigo-600">{diagnostico.equipo?.tipo || 'Sin tipo'}</span>
        </div>
      </td>
      <td className="px-4 py-3 max-w-xs truncate">{diagnostico.falla_reportada}</td>
      <td className="px-4 py-3 text-center"><PrioridadBadge prioridad={diagnostico.prioridad || 'Normal'} /></td>
      <td className="px-4 py-3 text-center"><EstadoBadge estado={diagnostico.estado_del_diagnostico || diagnostico.estado} /></td>
      <td className="px-4 py-3 text-right">
        <button type="button" onClick={() => onDetails(diagnostico)} className="mr-1 rounded border px-2 py-1 text-xs text-indigo-700">Recepción</button>
        <button type="button" onClick={() => onPhotos(diagnostico.id_diagnostico)} className="mr-1 rounded border px-2 py-1 text-xs text-indigo-700">Fotos</button>
        <button type="button" onClick={() => onHistory(diagnostico.id_diagnostico)} className="mr-1 rounded border px-2 py-1 text-xs text-indigo-700">Historial</button>
        {tieneTecnico ? (
          <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-xs font-semibold" title="Asignado a tecnico. No editable.">
            <ShieldAlert className="w-4 h-4" /> Asignado
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onEdit(diagnostico)}
            className="p-2 text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-indigo-200 transition-all shadow-sm hover:shadow"
            title="Editar Registro"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
};

export const DiagnosticosTable = ({
  activeTourTarget,
  diagnosticos,
  filterTecnico,
  loading,
  onEdit,
  onPhotos,
  onHistory,
  onDetails,
  onFilterChange,
  onSearchChange,
  searchTerm,
  onLoadMore,
  hasMore,
  isLoadingMore,
}) => (
  <section data-tour-target="table" className={`space-y-4 ${tourHighlightClass(activeTourTarget === 'table')}`}>
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <h3 className="text-lg font-bold text-gray-700">Registros Recientes</h3>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por ID, cliente o modelo..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm bg-white"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div className="relative w-full sm:w-48">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
          <select
            value={filterTecnico}
            onChange={(event) => onFilterChange(event.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm font-medium text-gray-700 appearance-none cursor-pointer"
          >
            <option value="TODOS">Todos los registros</option>
            <option value="SIN_ASIGNAR">Sin Tecnico (Editables)</option>
            <option value="ASIGNADOS">Ya Asignados</option>
          </select>
        </div>
      </div>
    </div>

    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <div
        className="secretaria-table-shell max-h-[70vh] overflow-auto custom-scrollbar"
        onScroll={(event) => {
          if (!onLoadMore || !hasMore || isLoadingMore) return;
          const element = event.currentTarget;
          if (element.scrollTop + element.clientHeight >= element.scrollHeight - 120) onLoadMore();
        }}
      >
        <table className="min-w-max w-full text-sm text-left text-gray-500">
          <thead className="sticky top-0 z-10 text-xs text-gray-700 uppercase bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-bold">ID</th>
              <th className="px-4 py-3 font-bold">Cliente</th>
              <th className="px-4 py-3 font-bold">Equipo</th>
              <th className="px-4 py-3 font-bold">Falla</th>
              <th className="px-4 py-3 font-bold text-center">Prioridad</th>
              <th className="px-4 py-3 font-bold text-center">Estado</th>
              <th className="px-4 py-3 font-bold text-right">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {diagnosticos.length > 0 ? (
              diagnosticos.map((diagnostico) => (
                <TableRow key={diagnostico.id_diagnostico} diagnostico={diagnostico} onEdit={onEdit} onPhotos={onPhotos} onHistory={onHistory} onDetails={onDetails} />
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-4 py-10 text-center text-gray-400 italic bg-gray-50/50">
                  {loading ? 'Cargando datos...' : 'No se encontraron diagnosticos que coincidan con los filtros.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {(isLoadingMore || hasMore) && (
          <div className="border-t border-gray-100 px-4 py-2 text-center text-xs font-medium text-gray-400">
            {isLoadingMore ? 'Cargando más registros...' : 'Desplázate para cargar más registros'}
          </div>
        )}
      </div>
    </div>
  </section>
);
