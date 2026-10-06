import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { mapDiagnostico, mapOrden, mapSolicitud } from '../utils/tecnicoMappers';

export const useTecnicoDashboard = (user, { activeTab, page, search, periodo, grupo, estado, prioridad }) => {
  const client = useQueryClient();
  const baseKey = ['tecnico', user?.username];
  const enabled = Boolean(user?.username);
  const params = { page, pageSize: 20, search, periodo, grupo, estado, prioridad };
  const kind = activeTab.startsWith('diagnosticos') ? 'diagnostico' : 'orden';
  const completed = activeTab.endsWith('completadas') || activeTab.endsWith('completados');
  const summary = useQuery({ queryKey: [...baseKey, 'resumen', periodo], enabled,
    queryFn: async ({ signal }) => (await api.get('/tecnicos/resumen', { params: { periodo }, signal })).data.data });
  const list = useQuery({ queryKey: [...baseKey, 'lista', activeTab, params], enabled: enabled && activeTab !== 'resumen',
    queryFn: async ({ signal }) => {
      const endpoint = activeTab === 'repuestos' ? '/tecnicos/solicitudes'
        : '/tecnicos/mis-' + (kind === 'diagnostico' ? 'diagnosticos' : 'ordenes') + '/' + encodeURIComponent(user.username);
      const response = await api.get(endpoint, { params: { ...params, grupo: completed ? 'completados' : grupo || 'activos' }, signal });
      const mapper = activeTab === 'repuestos' ? mapSolicitud : kind === 'diagnostico' ? mapDiagnostico : mapOrden;
      return { items: (response.data.data || []).map(mapper), meta: response.data.meta };
    },
  });
  const invalidate = () => client.invalidateQueries({ queryKey: baseKey });
  const mutation = useMutation({ mutationFn: async ({ method, url, data }) => api[method](url, data), onSuccess: invalidate });
  const mutate = (method, url, data) => mutation.mutateAsync({ method, url, data });
  return { items: list.data?.items || [], meta: list.data?.meta || { page, total: 0, hasMore: false },
    stats: summary.data || {}, loading: list.isFetching, summaryLoading: summary.isFetching,
    error: list.error || summary.error || mutation.error, busy: mutation.isPending,
    actions: {
      reload: () => { if (activeTab !== 'resumen') list.refetch(); summary.refetch(); }, invalidate,
      iniciarDiagnostico: (id) => mutate('patch', '/tecnicos/diagnosticos/' + id + '/iniciar'),
      guardarDiagnostico: (id, data) => mutate('put', '/tecnicos/diagnosticos/' + id, {
        diagnostico_real: data.diagnostico, solucion_propuesta: data.solucion, presupuesto_estimado: data.presupuesto,
        moneda_presupuesto: data.moneda_presupuesto,
      }),
      guardarBorrador: (id, data) => mutate('put', '/tecnicos/diagnosticos/' + id + '/borrador', data),
      cambiarEstadoOrden: (id, data) => mutate('patch', '/tecnicos/ordenes/' + id + '/estado', data),
      solicitarRepuesto: (id, data) => mutate('post', '/tecnicos/ordenes/' + id + '/repuestos', data),
    },
  };
};
