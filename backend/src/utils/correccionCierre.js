import { fail, motivoObligatorio } from './tecnicoWorkflow.js';

export const PLAZO_CORRECCION_HORAS = 24;
const estadosCerrados = new Set(['FINALIZADO', 'ENTREGADO']);

export const cierreCorregible = (orden) => estadosCerrados.has(orden?.estado)
  || (orden?.estado === 'IRREPARABLE' && orden.irreparable_estado === 'APROBADO');

export const datosCorreccionCierre = (orden, reglas = {}, now = new Date()) => {
  if (!cierreCorregible(orden)) return null;
  const cierre = orden.fecha_finalizacion || orden.fecha_cierre;
  if (!cierre || Number.isNaN(new Date(cierre).getTime())) return null;
  const plazoHoras = reglas.correccion_cierre_horas ?? PLAZO_CORRECCION_HORAS;
  const limite = new Date(new Date(cierre).getTime() + plazoHoras * 3600000);
  return {
    fecha_limite: limite,
    plazo_horas: plazoHoras,
    requiere_excepcion: now.getTime() > limite.getTime(),
    permite_excepcion: reglas.correccion_excepcional_habilitada !== false,
    puede_editar_informe: orden.estado === 'FINALIZADO' && !orden.fecha_entrega && !orden.facturas?.length,
  };
};

export const validarCorreccionCierre = (orden, payload, reglas = {}, now = new Date()) => {
  const datos = datosCorreccionCierre(orden, reglas, now);
  if (!datos) fail(409, 'Esta orden no admite correcciones de cierre');
  const motivo = motivoObligatorio(payload?.motivo);
  if (datos.requiere_excepcion && !datos.permite_excepcion) fail(409, 'El plazo de corrección ya venció y las excepciones están deshabilitadas');
  if (datos.requiere_excepcion && payload?.excepcion !== true) {
    fail(409, `Pasaron ${datos.plazo_horas} horas desde el cierre. Confirme que registra una corrección excepcional`);
  }
  return { ...datos, motivo, es_excepcion: datos.requiere_excepcion };
};
