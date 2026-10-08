export const sortClientesByName = (clientes = []) =>
  [...clientes].sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }));

export const normalizeDiagnosticos = (diagnosticos = [], equipos = [], clientes = []) => {
  const equiposById = new Map(equipos.map((equipo) => [String(equipo.id_equipo), equipo]));
  const clientesById = new Map(clientes.map((cliente) => [String(cliente.id_cliente), cliente]));

  return diagnosticos.map((diagnostico) => {
    const equipoFromList = equiposById.get(String(diagnostico.equipo_id || diagnostico.equipo?.id_equipo));
    const equipo = { ...(equipoFromList || {}), ...(diagnostico.equipo || {}) };
    const cliente =
      diagnostico.equipo?.cliente ||
      diagnostico.cliente ||
      equipoFromList?.cliente ||
      clientesById.get(String(equipo.cliente_id || diagnostico.cliente_id));

    return {
      ...diagnostico,
      equipo: {
        ...equipo,
        cliente,
      },
    };
  });
};

export const filterDiagnosticos = (diagnosticos = [], searchTerm = '', filterTecnico = 'TODOS') => {
  const term = searchTerm.toLowerCase();

  return diagnosticos
    .filter((diagnostico) => {
      const matchesSearch =
        diagnostico.equipo?.cliente?.nombre?.toLowerCase().includes(term) ||
        diagnostico.equipo?.modelo?.toLowerCase().includes(term) ||
        diagnostico.equipo?.tipo?.toLowerCase().includes(term) ||
        String(diagnostico.id_diagnostico).includes(searchTerm);

      const tieneTecnico = Boolean(diagnostico.tecnico_id || diagnostico.id_tecnico);
      const matchesTecnicoFilter =
        filterTecnico === 'SIN_ASIGNAR' ? !tieneTecnico : filterTecnico === 'ASIGNADOS' ? tieneTecnico : true;

      return matchesSearch && matchesTecnicoFilter;
    })
    .sort((a, b) => Number(b.id_diagnostico || 0) - Number(a.id_diagnostico || 0));
};
