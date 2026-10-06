import React from 'react';
import { CierreOrdenModal, DiagnosticoModal, SolicitarRepuestoModal } from '../TecnicoModals';

export const TecnicoDashboardModals = ({
  modalRepuesto,
  modalDiagnostico,
  modalCierre,
  repuestosCatalogo,
  onCloseRepuesto,
  onCloseDiagnostico,
  onCloseCierre,
  onSolicitarRepuesto,
  onGuardarDiagnostico,
  onGuardarBorrador,
  onCerrarOrden,
}) => (
  <>
    {modalRepuesto && (
      <SolicitarRepuestoModal
        orden={modalRepuesto}
        repuestos={repuestosCatalogo}
        onClose={onCloseRepuesto}
        onSubmit={onSolicitarRepuesto}
      />
    )}
    {modalDiagnostico && (
      <DiagnosticoModal
        orden={modalDiagnostico}
        readOnly={modalDiagnostico.readOnly}
        onClose={onCloseDiagnostico}
        onSubmit={onGuardarDiagnostico}
        onSaveDraft={onGuardarBorrador}
      />
    )}
    {modalCierre && (
      <CierreOrdenModal
        orden={modalCierre.orden}
        estado={modalCierre.estado}
        onClose={onCloseCierre}
        onSubmit={onCerrarOrden}
      />
    )}
  </>
);
