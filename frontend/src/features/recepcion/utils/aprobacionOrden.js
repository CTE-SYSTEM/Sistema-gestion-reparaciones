const ESTADOS_CON_DOCUMENTO_ENVIADO = ['DOCUMENTO_ENVIADO', 'ESPERANDO_RESPUESTA'];

export function prepararAprobacionOrden(diagnostico, { estadoContacto, observacionRespuesta, montoAutorizado }) {
  if (!diagnostico?.id_diagnostico) return { error: 'No se puede crear la orden: diagnóstico inválido.' };
  if (!diagnostico.equipo?.cliente?.id_cliente || !diagnostico.equipo?.id_equipo) {
    return { error: 'No se puede crear la orden: faltan datos del cliente o del equipo.' };
  }
  if (!diagnostico.diagnostico_real || Number(diagnostico.presupuesto_estimado || 0) <= 0) {
    return { error: 'Revise el informe técnico y el presupuesto antes de aprobar.' };
  }

  const estado = estadoContacto ?? diagnostico.estado_contacto ?? 'PENDIENTE_CONTACTAR';
  if (!ESTADOS_CON_DOCUMENTO_ENVIADO.includes(estado)) {
    return { error: 'Selecciona «Documento enviado» o «Esperando respuesta» para registrar el envío al aprobar.' };
  }

  const monto = Number(montoAutorizado);
  if (!Number.isFinite(monto) || monto <= 0) {
    return { error: 'Indica el monto autorizado en córdobas, mayor que cero.' };
  }

  return {
    guardarContacto: estado !== diagnostico.estado_contacto || observacionRespuesta !== undefined,
    contacto: {
      estado_contacto: estado,
      observacion_respuesta: observacionRespuesta ?? diagnostico.observacion_respuesta ?? '',
    },
    orden: {
      diagnostico_id: diagnostico.id_diagnostico,
      monto_autorizado: monto,
    },
  };
}
