export const DIAGNOSTICO_ESTADOS = ['PENDIENTE', 'INGRESADO', 'ASIGNADO', 'EN_REVISION', 'DIAGNOSTICADO', 'COMPLETADO', 'APROBADO', 'RECHAZADO'];
export const ORDEN_ESTADOS = ['PENDIENTE', 'ASIGNADO', 'APROBADO', 'EN_REPARACION', 'ESPERANDO_PIEZA', 'FINALIZADO', 'IRREPARABLE', 'ENTREGADO', 'CANCELADO'];
export const CONTACTO_ESTADOS = ['PENDIENTE_CONTACTAR', 'DOCUMENTO_ENVIADO', 'ESPERANDO_RESPUESTA', 'APROBADO', 'RECHAZADO', 'SIN_RESPUESTA'];
export const EQUIPO_ESTADOS_DIAGNOSTICO = ['EN_TALLER', 'ESPERANDO_RETIRO', 'RETIRADO_SIN_REPARAR'];
export const RECEPCION_OPCIONES = {
  estado_cargador: ['ENTREGADO', 'NO_ENTREGADO', 'NO_INCLUIDO', 'NO_VERIFICADO'],
  estado_accesorios: ['COMPLETOS', 'INCOMPLETOS', 'SIN_ACCESORIOS', 'NO_VERIFICADOS'],
  estado_fisico: ['SIN_DANOS', 'DANOS_LEVES', 'DANOS_GRAVES', 'NO_VERIFICADO'],
  estado_encendido: ['ENCIENDE', 'NO_ENCIENDE', 'INTERMITENTE', 'NO_PROBADO'],
  estado_alimentacion: ['FUNCIONA', 'NO_FUNCIONA', 'INTERMITENTE', 'NO_PROBADA'],
  estado_acceso: ['NO_REQUIERE', 'ENTREGADO', 'NO_ENTREGADO', 'NO_VERIFICADO'],
};
export const RESULTADOS_ORDEN = ['REPARADO', 'IRREPARABLE'];
export const REPUESTO_ESTADOS = ['PENDIENTE', 'APROBADO', 'DENEGADO'];
export const ENTREGA_REPUESTO_ESTADOS = ['PENDIENTE', 'ENTREGADO'];
export const PRIORIDADES = ['Normal', 'Alta', 'Urgente', 'NORMAL', 'ALTA', 'URGENTE'];
export const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta'];

export const normalizeOptionalText = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

export const parsePositiveId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const parseNonNegativeMoney = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return 0;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    const error = new Error(`${fieldName} debe ser un numero mayor o igual a cero`);
    error.statusCode = 400;
    throw error;
  }
  return Math.round(numberValue * 100) / 100;
};

export const assertInList = (value, allowed, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  if (!allowed.includes(value)) {
    const error = new Error(`${fieldName} no es valido`);
    error.statusCode = 400;
    throw error;
  }
  return value;
};
