// Frontend/src/components/shared/PageHelp.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { helpByPath, defaultHelp } from './DataHelpSecretaria';

export const tourHighlightClass = (isActive) =>
  isActive
    ? 'relative z-50 !bg-white !text-indigo-600 font-bold ring-4 ring-indigo-500/80 shadow-2xl transition-all duration-200'
    : '';

const localHelpPaths = new Set([
  // Rutas donde no se deba mostrar la ayuda
]);

const resolveHelp = (pathname) => {
  if (localHelpPaths.has(pathname)) return null;

  // 1. Coincidencia exacta
  if (helpByPath[pathname]) {
    return helpByPath[pathname];
  }
  if (pathname.endsWith('/mi-cuenta')) return helpByPath['/mi-cuenta'];

  // 2. Coincidencia por prefijo
  // Soporta IDs dinámicos como /admin/ordenes/123
  const matchingPath = Object.keys(helpByPath)
    .filter((path) => path !== '/')
    .sort((a, b) => b.length - a.length)
    .find((path) => pathname.startsWith(path));

  return matchingPath ? helpByPath[matchingPath] : defaultHelp;
};

/**
 * Tutorial reutilizable para cualquier página.
 *
 * Props:
 * - steps: [
 *     {
 *       target: 'summary',
 *       title: 'Título',
 *       text: 'Descripción'
 *     }
 *   ]
 * - stepIndex
 * - onBack
 * - onClose
 * - onNext
 */
export const GuidedTour = ({
  steps = [],
  stepIndex = 0,
  onBack,
  onClose,
  onNext,
}) => {
  if (!steps.length) return null;

  const safeStepIndex = Math.min(
    Math.max(stepIndex, 0),
    steps.length - 1
  );

  const currentStep = steps[safeStepIndex];

  if (!currentStep) return null;

  const isFirst = safeStepIndex === 0;
  const isLast = safeStepIndex === steps.length - 1;

  const progress = `${safeStepIndex + 1}/${steps.length}`;

  return (
    <>
      {/* Fondo oscuro */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Tarjeta del tutorial */}
      <div className="fixed right-6 top-20 z-50 w-[min(380px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              Paso {progress}
            </p>

            <h2 className="mt-1 text-base font-bold text-slate-900">
              {currentStep.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Cerrar ayuda"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-xs font-medium text-slate-500">
          Tutorial guiado de esta pantalla.
        </p>

        <p className="rounded-xl border border-indigo-100 bg-indigo-50 p-3.5 text-xs font-medium leading-relaxed text-slate-700">
          {currentStep.text}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isFirst}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Atrás
          </button>

          <div className="flex gap-1.5">
            {steps.map((step, index) => (
              <span
                key={`${step.target}-${index}`}
                className={`h-2 rounded-full transition-all ${
                  index === safeStepIndex
                    ? 'w-4 bg-indigo-600'
                    : 'w-2 bg-slate-200'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            {isLast ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </>
  );
};

/**
 * Ayuda automática basada en la ruta.
 *
 * Se puede usar simplemente:
 *
 * <PageHelp />
 */
const PageHelp = ({ compact = false }) => {
  const { pathname } = useLocation();

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const help = useMemo(
    () => resolveHelp(pathname),
    [pathname]
  );

  useEffect(() => {
    setOpen(false);
    setStepIndex(0);
  }, [pathname]);

  if (!help) return null;

  const isLast = stepIndex === help.steps.length - 1;
  const [stepTitle, stepText] = help.steps[stepIndex];
  const progress = `${stepIndex + 1}/${help.steps.length}`;

  const startTour = () => {
    setStepIndex(0);
    setOpen(true);
  };

  const closeTour = () => {
    setOpen(false);
    setStepIndex(0);
  };

  const nextStep = () => {
    if (isLast) {
      closeTour();
      return;
    }

    setStepIndex((value) => value + 1);
  };

  return (
    <section className={compact ? '' : 'mb-6'}>
      <div
        className={
          compact
            ? 'flex justify-end'
            : 'mb-3 flex justify-end'
        }
      >
        <button
          type="button"
          onClick={startTour}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          title="Iniciar tutorial guiado"
        >
          <HelpCircle className="h-4 w-4 text-indigo-600" />
          Ayuda
        </button>
      </div>

      {open && (
        <>
          {/* Fondo oscuro */}
          <div
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[1px] transition-opacity"
            onClick={closeTour}
          />

          {/* Tarjeta de ayuda */}
          <div className="fixed right-6 top-20 z-50 w-[min(380px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xl transition-all">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                  Paso {progress}
                </p>

                <h2 className="mt-1 text-base font-bold text-slate-900">
                  {stepTitle}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeTour}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title="Cerrar ayuda"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-3 text-xs font-medium text-slate-500">
              {help.description}
            </p>

            <p className="rounded-xl border border-indigo-100 bg-indigo-50 p-3.5 text-xs font-medium leading-relaxed text-slate-700">
              {stepText}
            </p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setStepIndex((value) => Math.max(value - 1, 0))
                }
                disabled={stepIndex === 0}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Atrás
              </button>

              <div className="flex gap-1.5">
                {help.steps.map((step, index) => (
                  <span
                    key={step[0]}
                    className={`h-2 rounded-full transition-all ${
                      index === stepIndex
                        ? 'w-4 bg-indigo-600'
                        : 'w-2 bg-slate-200'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                {isLast ? 'Finalizar' : 'Siguiente'}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default PageHelp;
