import React, { useState, useMemo } from 'react';

const defaultContentClassName = 'max-w-[220px] whitespace-normal break-words leading-relaxed';

const Table = ({
  columns,
  data = [],
  sortable = false,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}) => {
  // Estado para controlar qué columna ordena y en qué sentido ('asc' o 'desc')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Manejador del clic en las cabeceras (solo se ejecuta si sortable es true)
  const handleSort = (accessor) => {
    if (!accessor) return;

    let direction = 'asc';
    if (sortConfig.key === accessor && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: accessor, direction });
  };

  // Procesamos los datos: si "sortable" es true, aplica el algoritmo; si no, devuelve los datos planos originales
  const processedData = useMemo(() => {
    // Si la propiedad sortable no está activa, o no se ha hecho clic en ninguna columna, va por la normal
    if (!sortable || sortConfig.key === null) {
      return data;
    }

    let sortableItems = [...data];
    sortableItems.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // 1. Normalización para valores nulos, vacíos o guiones
      if (aValue === undefined || aValue === null || aValue === '-') aValue = '';
      if (bValue === undefined || bValue === null || bValue === '-') bValue = '';

      // 2. Limpieza para valores de moneda (ej: "$ 150.00")
      if (typeof aValue === 'string' && aValue.includes('$')) {
        aValue = Number(aValue.replace(/[^0-9.-]+/g, '')) || 0;
        bValue = Number(bValue.replace(/[^0-9.-]+/g, '')) || 0;
      }

      // 3. Limpieza para fechas en formato de texto local (ej: DD/MM/AAAA)
      if (typeof aValue === 'string' && aValue.includes('/') && aValue.split('/').length === 3) {
        const partsA = aValue.split('/');
        const partsB = bValue.split('/');
        aValue = new Date(partsA[2], partsA[1] - 1, partsA[0]).getTime() || 0;
        bValue = new Date(partsB[2], partsB[1] - 1, partsB[0]).getTime() || 0;
      }

      // 4. Comparación puramente numérica (cantidades, IDs, stocks)
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // 5. Comparación de texto estándar (alfabético)
      const strA = aValue.toString().toLowerCase();
      const strB = bValue.toString().toLowerCase();

      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sortableItems;
  }, [data, sortConfig, sortable]);

  const handleScroll = (event) => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;
    const element = event.currentTarget;
    const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 120;
    if (nearBottom) onLoadMore();
  };

  return (
    <div
      className="table-shell w-full min-w-0 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm custom-scrollbar max-h-[calc(100dvh-12rem)]"
      onScroll={handleScroll}
    >
      <table className="w-full min-w-max table-auto border-collapse">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-gray-100 bg-gray-50/50">
            {columns.map((c, index) => {
              const accessorKey = c.accessor;
              const isSorted = sortConfig.key === accessorKey;
              
              // Es interactiva si el componente tiene "sortable", si la columna tiene accessor y no es la de acciones
              const isColumnSortable = sortable && !!accessorKey && accessorKey !== 'acciones';

              return (
                <th 
                  key={accessorKey || c.header || index} 
                  onClick={() => isColumnSortable && handleSort(accessorKey)}
                  className={`px-3 py-3 text-left text-[13px] font-semibold text-gray-400 uppercase tracking-tight whitespace-nowrap sm:px-6 sm:py-4 select-none ${
                    isColumnSortable ? 'cursor-pointer hover:bg-gray-100/70 hover:text-gray-600 transition-colors' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{c.header}</span>
                    {/* El icono de filtro solo aparece si la columna permite ordenamiento */}
                    {isColumnSortable && (
                      <span className={`text-[10px] transition-colors ${isSorted ? 'text-indigo-600 font-bold' : 'text-gray-300'}`}>
                        {isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {processedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-10 text-center text-gray-400 font-light">
                No hay registros disponibles
              </td>
            </tr>
          ) : (
            processedData.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/30 transition-all duration-200">
                {columns.map((c, colIndex) => (
                  <td 
                    key={c.accessor || c.header || colIndex} 
                    className={`min-w-0 px-3 py-3 text-sm text-gray-600 align-top sm:px-5 sm:py-3.5 ${c.cellClassName || ''}`}
                  >
                    <div className={c.contentClassName || defaultContentClassName}>
                      {c.render ? c.render(row) : (row[c.accessor] !== undefined && row[c.accessor] !== null ? row[c.accessor] : '-')}
                    </div>
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {onLoadMore && (isLoadingMore || hasMore) && (
        <div className="border-t border-gray-100 px-4 py-2 text-center text-xs font-medium text-gray-400">
          {isLoadingMore ? 'Cargando más registros...' : 'Desplázate para cargar más registros'}
        </div>
      )}
    </div>
  );
};

export default Table;
