import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeNotifications } from '../../../hooks/useRealtimeNotifications';
import { supervisionService as service } from '../services/supervisionService';

const empty = { trabajos: [], tecnicos: [], repuestos: [], catalogo: [], intervenciones: [], indicadores: {} };

export function useSupervision(user) {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const request = useRef(0);
  const detailRequest = useRef(0);
  const role = String(user?.rol || '').replace(/[\s_-]/g, '').toLowerCase();
  const allowed = ['tecnicojefe', 'administrador', 'adminpro'].includes(role);

  const reload = useCallback(async () => {
    if (!allowed) { setLoading(false); return; }
    const current = ++request.current;
    try {
      const response = await service.resumen();
      if (current === request.current) { setData(response.data.data); setError(''); }
    } catch (err) {
      if (current === request.current) setError(err.response?.data?.error || 'No se pudo cargar la supervisión del taller.');
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [allowed]);

  useEffect(() => { setLoading(true); reload(); return () => { request.current++; detailRequest.current++; }; }, [reload, user?.id]);
  const realtime = useRealtimeNotifications({ enabled: allowed, persistent: true, onRefresh: reload,
    refreshOnConnect: true, refreshIntervalMs: 60000, refreshOnlyDisconnected: true });
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const closeDialog = () => { if (busy) return; detailRequest.current++; setDialog(null); setDetail(null); setFormError(''); };
  const open = async (action, row) => {
    const current = ++detailRequest.current;
    setFormError(''); setDetail(null); setDialog({ action, row });
    if (!['detalle', 'historial_repuesto'].includes(action)) return;
    setDetailLoading(true);
    try {
      const response = await service.detalle(action === 'historial_repuesto' ? 'orden' : row.tipo, action === 'historial_repuesto' ? row.orden_id : row.id);
      if (current === detailRequest.current) setDetail(response.data.data);
    } catch (err) {
      if (current === detailRequest.current) setFormError(err.response?.data?.error || 'No se pudo consultar el detalle.');
    } finally { if (current === detailRequest.current) setDetailLoading(false); }
  };

  const submit = async (values) => {
    if (!dialog || busy) return;
    setBusy(true); setFormError('');
    const { action, row } = dialog;
    try {
      let response;
      if (action === 'asignar') response = await service.asignar(row.tipo, row.id, values);
      else if (action === 'prioridad') response = await service.prioridad(row.tipo, row.id, values);
      else if (action === 'intervencion') response = await service.intervenir(row.tipo, row.id, values);
      else if (action === 'reasignar') response = await service.intervenir(row.tipo, row.id, { tecnico_id: values.tecnico_id, motivo: values.motivo, tipo: 'REASIGNACION' });
      else if (action === 'disponibilidad') response = await service.disponibilidad(row.id_tecnico, values);
      else if (action === 'irreparable') response = await service.irreparable(row.id, values);
      else response = await service.repuesto(row.id_detalle_repuesto, action, values);
      setNotice(response.data.message || 'Cambio registrado correctamente.');
      setDialog(null); setDetail(null);
      await reload();
      await realtime.reloadNotifications();
    } catch (err) { setFormError(err.response?.data?.error || 'No se pudo registrar el cambio.'); }
    finally { setBusy(false); }
  };
  return { data, loading, error, notice, busy, dialog, detail, detailLoading, formError, allowed, reload, open, closeDialog, submit, realtime };
}
