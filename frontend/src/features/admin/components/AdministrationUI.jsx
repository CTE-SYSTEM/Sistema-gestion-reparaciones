import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50';
export function AdminPage({ title, description, children, actions, backTo = '/admin', backLabel = 'Administración' }) {
  const page = useRef(null);
  useLayoutEffect(() => { page.current?.closest('main')?.scrollTo({ top: 0 }); }, []);
  return <div ref={page} className="mx-auto max-w-7xl space-y-6 p-4">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><Link to={backTo} className="text-xs font-bold text-indigo-600">{backLabel} /</Link>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-800">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p></div>{actions}
    </header>{children}
  </div>;
}
export function AdminSection({ title, description, children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    {title && <div className="mb-4"><h2 className="text-lg font-bold text-slate-800">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>}{children}
  </section>;
}
export function AdminButton({ children, secondary = false, danger = false, className = '', ...props }) {
  return <button type="button" {...props} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${danger ? 'bg-red-50 text-red-700 hover:bg-red-100' : secondary ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'} ${className}`}>{children}</button>;
}
export function AdminNotice({ message, error = false }) {
  if (!message) return null;
  const Icon = error ? AlertCircle : CheckCircle2;
  return <div role={error ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" /><span>{message}</span></div>;
}
export function AdminField({ label, hint, children }) {
  return <label className="block space-y-1.5"><span className="block text-sm font-semibold text-slate-700">{label}</span>{children}{hint && <span className="block text-xs text-slate-500">{hint}</span>}</label>;
}
export const formatAdminDate = (value) => value ? new Date(value).toLocaleString('es-NI', { timeZone: 'America/Managua' }) : '—';
export const formatBytes = (value) => Number(value) >= 1048576 ? `${(Number(value) / 1048576).toFixed(1)} MB` : `${(Number(value || 0) / 1024).toFixed(1)} KB`;
export const displayCell = (value) => {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:/.test(value)) return formatAdminDate(value);
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};
export function AdminDataTable({ rows, columns, page = 1, onPageChange, pageSize = 20, total = rows.length, server = false, empty = 'No hay registros para los filtros seleccionados.' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const visible = server ? rows : rows.slice((page - 1) * pageSize, page * pageSize);
  return <div>
    {!rows.length ? <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">{empty}</p> :
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
        <thead><tr className="border-b border-slate-200 bg-slate-50">{columns.map((c) => <th key={c.accessor} scope="col" className="whitespace-nowrap px-3 py-3 text-xs font-bold text-slate-600">{c.header}</th>)}</tr></thead>
        <tbody>{visible.map((row, i) => <tr key={row.id_auditoria || row.id_usuario || `${page}-${i}`} className="border-b border-slate-100 align-top hover:bg-slate-50">{columns.map((c) => <td key={c.accessor} className="max-w-sm break-words px-3 py-3 text-slate-700">{c.render ? c.render(row) : displayCell(row[c.accessor])}</td>)}</tr>)}</tbody>
      </table></div>}
    {onPageChange && total > pageSize && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
      <span>{total} registros · Página {page} de {pages}</span>
      <div className="flex gap-2"><AdminButton secondary disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></AdminButton>
        <AdminButton secondary disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Página siguiente"><ChevronRight size={16} /></AdminButton></div>
    </div>}
  </div>;
}
