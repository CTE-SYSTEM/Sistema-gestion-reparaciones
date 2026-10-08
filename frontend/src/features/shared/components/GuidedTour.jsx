// frontend/src/features/secretaria/components/shared/GuidedTour.jsx

import { X } from 'lucide-react';

export const tourHighlightClass = (isActive) =>
  isActive
    ? 'relative z-[60] rounded-xl bg-white ring-4 ring-indigo-400 ring-offset-4 ring-offset-white shadow-2xl transition-all'
    : '';

export const GuidedTour = ({ steps, stepIndex, onBack, onClose, onNext }) => {
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  if (!step) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/55" />
      <div className="fixed bottom-6 right-6 z-[70] w-[min(92vw,390px)] rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Paso {stepIndex + 1} de {steps.length}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-gray-900">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title="Cerrar tutorial"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm leading-6 text-gray-600">{step.text}</p>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={stepIndex === 0}
            className="rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Atras
          </button>
          <button type="button" onClick={onNext} className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
            {isLast ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </>
  );
};
