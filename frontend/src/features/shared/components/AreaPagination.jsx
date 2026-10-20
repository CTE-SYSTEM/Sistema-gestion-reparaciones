import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function AreaPagination({ page, onPageChange, meta = {}, loading, label }) {
  const pages = Math.max(1, Math.ceil((meta.total || 0) / (meta.pageSize || 10)));
  const buttonClass =
    'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40';
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500"
    >
      <span>
        {meta.total || 0} registros · Página {page} de {pages} · {meta.pageSize || 10} por página
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={buttonClass}
        >
          <ChevronLeft size={14} />
          Anterior
        </button>
        <button
          type="button"
          disabled={loading || page >= pages}
          onClick={() => onPageChange(page + 1)}
          className={buttonClass}
        >
          Siguiente
          <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}
