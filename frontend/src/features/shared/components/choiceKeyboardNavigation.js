import { isAvailable } from './formKeyboardNavigation.js';

export const handleChoiceNavigationKeyDown = (event) => {
  if (event.defaultPrevented || event.isComposing || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
  const choices = Array.from(event.currentTarget.querySelectorAll('button')).filter(isAvailable);
  const index = choices.indexOf(event.target);
  if (index < 0 || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1
    : (index + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1) + choices.length) % choices.length;
  choices[next]?.focus();
};

// La respuesta de una búsqueda sólo continúa el recorrido si no se empezó otra acción.
export const focusLookupResult = (container, origin) => {
  if (!container) return;
  const doc = container.ownerDocument;
  if (doc.activeElement !== origin && doc.activeElement !== doc.body) return;
  const next = Array.from(container.querySelectorAll('button,input')).find(isAvailable)
    || container.querySelector('[data-keyboard-empty]');
  next?.focus();
};
