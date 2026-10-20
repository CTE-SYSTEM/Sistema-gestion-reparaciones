const searchStep = ['Buscar y filtrar', 'Busca por código, cliente o equipo y combina los filtros. La paginación indica cuántas páginas tiene el resultado.', '.tecnico-filtros, .jefe-toolbar'];
const recordStep = (text) => ['Abrir el expediente', text, '.tecnico-orden-card, .jefe-table-wrap, .jefe-card'];
const guide = (title, text, selector) => ({ title: `Ayuda: ${title}`, description: 'Recorre los controles de esta sección. Puedes salir con Escape.', steps: [searchStep, ['Acciones de esta sección', text, selector], ['Ingreso con teclado', 'En formularios, Enter avanza y Shift+Enter retrocede. Alt+flechas cambia de campo. En notas, Enter agrega una línea y Ctrl+Enter avanza.', 'form']] });

export const technicianHelp = {
  resumen: { title: 'Mi trabajo', description: 'Organiza la jornada.', steps: [['Indicadores', 'Abre un indicador para ver los trabajos correspondientes.', '.jefe-stats'], ['Continuar trabajo', 'Inicia diagnósticos o reparaciones y revisa las piezas pendientes.', '.tecnico-jornada']] },
  diagnosticos: guide('Diagnósticos activos', 'Iniciar registra el comienzo real. Abre el expediente para consultar la recepción, las fotos y guardar el diagnóstico o un borrador.', '.jefe-table-wrap'),
  diagnosticos_completados: { title: 'Diagnósticos cerrados', description: 'Consulta informes completados y sus revisiones.', steps: [searchStep, recordStep('Abre el informe para consultar el resultado y el historial. Reabrir exige el motivo correspondiente.')] },
  ordenes: guide('Reparaciones activas', 'Inicia la reparación, registra avances y solicita piezas. Espera la aprobación y entrega física de cada pieza. Finalizar abre las pruebas y el cierre técnico.', '.tecnico-orden-card, .jefe-card'),
  ordenes_completadas: { title: 'Reparaciones cerradas', description: 'Finalizada indica cierre técnico; calidad, cobro y entrega tienen sus propios estados.', steps: [searchStep, recordStep('Abre el expediente para consultar pruebas, piezas, fotos y correcciones.')] },
  repuestos: guide('Solicitudes de piezas', 'Consulta si la pieza está pendiente, aprobada, entregada, rechazada o sin existencias. Una aprobación todavía requiere la entrega de Bodega.', '.jefe-table-wrap'),
};

export const chiefHelp = Object.fromEntries([
  ['resumen', 'Resumen del taller', 'Los indicadores abren asignaciones, seguimiento, repuestos y retrasos.', '.jefe-stats'],
  ['asignaciones', 'Asignaciones', 'Asignar elige al técnico responsable. Consulta carga y disponibilidad antes de confirmar; el técnico registra el inicio real.', '.jefe-table-wrap'],
  ['seguimiento', 'Seguimiento', 'Abre un trabajo para revisar avances y estados. Reasignar o intervenir requiere registrar el motivo.', '.jefe-table-wrap'],
  ['diagnosticos_cerrados', 'Diagnósticos cerrados', 'Consulta el informe completado y las revisiones. Las correcciones quedan en el historial del diagnóstico.', '.jefe-table-wrap'],
  ['ordenes_cerradas', 'Órdenes cerradas', 'Abre el expediente para ver cierre, calidad, piezas y correcciones. Entrega y facturación son etapas posteriores.', '.jefe-table-wrap'],
  ['tecnicos', 'Equipo técnico', 'Consulta disponibilidad, especialidades y carga antes de distribuir trabajos.', '.jefe-card'],
  ['repuestos', 'Repuestos', 'Vincula al catálogo y aprueba o rechaza con motivo. Una pieza sin vínculo o sin existencias sigue pendiente de solución; Bodega confirma la entrega.', '.jefe-table-wrap'],
  ['irreparables', 'Irreparables', 'Revisa la justificación técnica y guarda la decisión con su motivo antes de comunicarla al cliente.', '.jefe-table-wrap'],
  ['alertas', 'Pendientes y retrasos', 'Abre el trabajo para revisar cuánto tiempo lleva sin avance y resolver el bloqueo.', '.jefe-table-wrap'],
  ['intervenciones', 'Correcciones y excepciones', 'Abre el expediente asociado para ver qué cambió, quién lo hizo y el motivo guardado.', '.jefe-table-wrap'],
].map(([key, title, text, selector]) => [key, guide(title, text, selector)]));
