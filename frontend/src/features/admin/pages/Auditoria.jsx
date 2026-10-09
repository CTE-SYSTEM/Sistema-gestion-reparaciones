import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { administracionService, errorText } from '../services/administracionService';
import { AdminPage, AdminSection, AdminField, AdminButton, AdminNotice, AdminDataTable, inputClass, formatAdminDate } from '../components/AdministrationUI';
const FIELD_NAMES = { nombre_usuario: 'Usuario', nombre_persona: 'Nombre de la persona', rol: 'Perfil', activo: 'Cuenta activa', estado: 'Estado', calidad_estado: 'Estado de calidad', stock_actual: 'Existencia', cantidad: 'Cantidad', monto: 'Monto', total: 'Total', observacion: 'Observación', motivo: 'Motivo', fecha_entrega: 'Fecha de entrega', fecha_emision: 'Fecha de emisión', tecnico_id: 'Técnico asignado' };
const fieldLabel = (key) => FIELD_NAMES[key] || key.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const fieldValue = (value) => {
  if (value == null || value === '') return 'Sin dato';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.map(fieldValue).join(', ') || 'Sin datos';
  if (typeof value === 'object') return Object.entries(value).map(([key, nested]) => `${fieldLabel(key)}: ${fieldValue(nested)}`).join(' · ') || 'Sin datos';
  return String(value);
};
function AuditChanges({ before, after }) {
  const oldData = before && typeof before === 'object' && !Array.isArray(before) ? before : {};
  const newData = after && typeof after === 'object' && !Array.isArray(after) ? after : {};
  const keys = [...new Set([...Object.keys(oldData), ...Object.keys(newData)])].filter((key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]));
  return <details><summary className="cursor-pointer font-semibold text-indigo-600">Ver cambios</summary><div className="mt-2 min-w-64 space-y-2 rounded-lg bg-slate-50 p-3 text-xs">{keys.length ? keys.map((key) => <div key={key} className="border-b border-slate-200 pb-2 last:border-0"><strong className="block text-slate-800">{fieldLabel(key)}</strong><div className="mt-1 grid gap-1 sm:grid-cols-2"><span><span className="text-slate-500">Antes: </span>{fieldValue(oldData[key])}</span><span><span className="text-slate-500">Después: </span>{fieldValue(newData[key])}</span></div></div>) : <p className="text-slate-500">Este movimiento no cambió datos visibles.</p>}</div></details>;
}
export default function Auditoria() {
  const [filters, setFilters] = useState({}), [applied, setApplied] = useState({}), [page, setPage] = useState(1);
  const [result, setResult] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const version = useRef(0);
  useEffect(() => { const current = ++version.current; setLoading(true); setError('');
    administracionService.getAuditoria({ ...applied, page, limit: 20 }).then(({ data }) => { if (current === version.current) setResult(data); })
      .catch(async (e) => { if (current === version.current) setError(await errorText(e)); }).finally(() => { if (current === version.current) setLoading(false); });
    return () => { version.current++; };
  }, [applied, page]);
  const change = (key, value) => setFilters((old) => ({ ...old, [key]: value }));
  const columns = [{ accessor: 'fecha_movimiento', header: 'Fecha', render: (r) => formatAdminDate(r.fecha_movimiento) }, { accessor: 'usuario_nombre', header: 'Persona', render: (r) => r.usuario_nombre || 'Sistema' }, { accessor: 'modulo', header: 'Módulo' }, { accessor: 'tabla', header: 'Submódulo' }, { accessor: 'operacion', header: 'Acción' }, { accessor: 'observacion', header: 'Motivo' }, { accessor: 'datos', header: 'Detalle', render: (r) => <AuditChanges before={r.datos_anteriores} after={r.datos_nuevos} /> }];
  return <AdminPage title="Auditoría" description="Movimientos con fecha, usuario y detalle del cambio. Las contraseñas y los tokens se ocultan.">
    <AdminNotice error message={error} /><AdminSection title="Filtrar movimientos"><form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied({ ...filters }); }} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AdminField label="Desde"><input className={inputClass} type="date" value={filters.fecha_inicio || ''} onChange={(e) => change('fecha_inicio', e.target.value)} /></AdminField><AdminField label="Hasta"><input className={inputClass} type="date" min={filters.fecha_inicio || undefined} value={filters.fecha_fin || ''} onChange={(e) => change('fecha_fin', e.target.value)} /></AdminField>
      <AdminField label="Módulo"><select className={inputClass} value={filters.modulo || ''} onChange={(e) => setFilters((old) => ({ ...old, modulo: e.target.value, tabla: '' }))}><option value="">Todos</option>{result?.modulos?.map((m) => <option key={m.nombre} value={m.nombre}>{m.nombre}</option>)}</select></AdminField>
      <AdminField label="Submódulo"><select className={inputClass} value={filters.tabla || ''} onChange={(e) => change('tabla', e.target.value)}><option value="">Todos</option>{(filters.modulo ? result?.modulos?.find((m) => m.nombre === filters.modulo)?.submodulos || [] : result?.tablas || []).map((t) => <option key={t}>{t}</option>)}</select></AdminField>
      <AdminField label="Persona"><select className={inputClass} value={filters.usuario_id || ''} onChange={(e) => change('usuario_id', e.target.value)}><option value="">Todas</option>{result?.usuarios?.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{u.usuario_nombre || `Usuario #${u.usuario_id}`}</option>)}</select></AdminField>
      <AdminField label="Buscar usuario o motivo"><input className={inputClass} value={filters.buscar || ''} maxLength={100} onChange={(e) => change('buscar', e.target.value)} /></AdminField></div><AdminButton type="submit" disabled={loading}><Search size={16} />Consultar movimientos</AdminButton></form></AdminSection>
    <AdminSection title="Historial" description={result ? `${result.meta.total} movimientos encontrados` : undefined}>{loading ? <p className="text-sm text-slate-500">Cargando movimientos…</p> : result && <AdminDataTable rows={result.data} columns={columns} server page={page} pageSize={20} total={result.meta.total} onPageChange={setPage} />}</AdminSection>
  </AdminPage>;
}
