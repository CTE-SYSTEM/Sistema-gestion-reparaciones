import { FileDown, FileText } from 'lucide-react';

const exportButtonBase = 'inline-flex h-9 min-w-[72px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-gray-400 disabled:shadow-none';

export function ExportButton({ children, format = 'excel', ...props }) {
  const tone = format === 'pdf'
    ? 'bg-slate-800 hover:bg-slate-900'
    : 'bg-emerald-600 hover:bg-emerald-700';
  const Icon = format === 'pdf' ? FileText : FileDown;

  return (
    <button
      type="button"
      className={`${exportButtonBase} ${tone}`}
      title={format === 'pdf' ? 'Exportar a PDF' : 'Exportar a Excel'}
      {...props}
    >
      <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}

export function ExportActions({ disabled, onExcel, onPdf }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ExportButton format="excel" onClick={onExcel} disabled={disabled}>
        Excel
      </ExportButton>
      <ExportButton format="pdf" onClick={onPdf} disabled={disabled}>
        PDF
      </ExportButton>
    </div>
  );
}
