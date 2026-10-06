import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileDown } from 'lucide-react';
import { administracionService, errorText } from '../services/administracionService';
import { AdminPage, AdminSection, AdminField, AdminButton, AdminNotice, AdminDataTable, inputClass, formatAdminDate } from '../components/AdministrationUI';
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
  const columns = [{ accessor: 'fecha_movimiento', header: 'Fecha', render: (r) => formatAdminDate(r.fecha_movimiento) }, { accessor: 'usuario_nombre', header: 'Usuario', render: (r) => r.usuario_nombre || 'Sistema' }, { accessor: 'tabla', header: 'Módulo' }, { accessor: 'operacion', header: 'Acción' }, { accessor: 'observacion', header: 'Motivo' }, { accessor: 'datos', header: 'Detalle', render: (r) => <details><summary className="cursor-pointer font-semibold text-indigo-600">Ver cambios</summary><div className="mt-2 min-w-64 space-y-2"><p className="text-xs font-bold">Antes</p><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-2 text-xs">{JSON.stringify(r.datos_anteriores, null, 2)}</pre><p className="text-xs font-bold">Después</p><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-2 text-xs">{JSON.stringify(r.datos_nuevos, null, 2)}</pre></div></details> }];
  return <AdminPage title="Auditoría" description="Movimientos con fecha, usuario y detalle del cambio. Las contraseñas y los tokens se ocultan." actions={<Link to="/admin/reportes?tipo=auditoria" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600"><FileDown size={16} />Reporte de auditoría</Link>}>
    <AdminNotice error message={error} /><AdminSection title="Filtrar movimientos"><form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied({ ...filters }); }} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AdminField label="Desde"><input className={inputClass} type="date" value={filters.fecha_inicio || ''} onChange={(e) => change('fecha_inicio', e.target.value)} /></AdminField><AdminField label="Hasta"><input className={inputClass} type="date" min={filters.fecha_inicio || undefined} value={filters.fecha_fin || ''} onChange={(e) => change('fecha_fin', e.target.value)} /></AdminField>
      <AdminField label="Módulo"><select className={inputClass} value={filters.tabla || ''} onChange={(e) => change('tabla', e.target.value)}><option value="">Todos</option>{result?.tablas.map((t) => <option key={t}>{t}</option>)}</select></AdminField>
      <AdminField label="Buscar usuario o motivo"><input className={inputClass} value={filters.buscar || ''} maxLength={100} onChange={(e) => change('buscar', e.target.value)} /></AdminField></div><AdminButton type="submit" disabled={loading}><Search size={16} />Consultar movimientos</AdminButton></form></AdminSection>
    <AdminSection title="Historial" description={result ? `${result.meta.total} movimientos encontrados` : undefined}>{loading ? <p className="text-sm text-slate-500">Cargando movimientos…</p> : result && <AdminDataTable rows={result.data} columns={columns} server page={page} pageSize={20} total={result.meta.total} onPageChange={setPage} />}</AdminSection>
  </AdminPage>;
}
