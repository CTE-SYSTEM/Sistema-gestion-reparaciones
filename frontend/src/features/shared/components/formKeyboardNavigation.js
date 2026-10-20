export const fieldSelector = 'input:not([type="hidden"]), select, textarea, button, a[href], summary, [tabindex]';

export const isAvailable = (element) => !element.disabled
  && !element.matches?.(':disabled')
  && element.tabIndex !== -1
  && !element.closest('[hidden], [aria-hidden="true"], [inert]')
  && element.getClientRects().length > 0;

export const keyboardScope = (element) => element.closest('form, [data-keyboard-form]');

export const focusAdjacentFormField = (current, direction = 1, allActions = false) => {
  const form = keyboardScope(current);
  if (!form) return;
  const view = current.ownerDocument?.defaultView || window;
  view.requestAnimationFrame(() => {
    const fields = Array.from(form.querySelectorAll(fieldSelector)).filter((field) =>
      isAvailable(field) && (!field.readOnly || field === current) && !field.closest?.('[data-keyboard-skip]')
      && (allActions || field.tagName !== 'BUTTON' || field.type !== 'button' || field.hasAttribute?.('data-keyboard-primary')));
    const currentIndex = fields.indexOf(current);
    if (currentIndex < 0) return;
    const next = fields[currentIndex + direction];
    next?.focus();
  });
};

export const handleFormNavigationKeyDown = (event) => {
  if (event.defaultPrevented || event.isComposing) return;
  const target = event.target;
  if (!target.matches?.('input, select, textarea, button, a[href], summary') || event.keyCode === 229) return;
  if (!keyboardScope(target) && !target.closest('[data-keyboard-workspace]')) return;
  const altNavigation = event.altKey && !event.ctrlKey && !event.metaKey
    && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key);
  if (event.altKey && !event.ctrlKey && !event.metaKey && ['Home', 'End'].includes(event.key) && keyboardScope(target)) {
    const fields = Array.from(keyboardScope(target).querySelectorAll(fieldSelector)).filter(isAvailable);
    const destination = event.key === 'Home' ? fields.find((field) => field.matches('input,select,textarea') && !field.readOnly)
      : fields.find((field) => field.matches('button[type="submit"],button:not([type]),[data-keyboard-primary]'));
    if (destination) { event.preventDefault(); destination.focus(); }
    return;
  }
  if (target.dataset.autocompleteInput || target.getAttribute?.('role') === 'combobox') return;
  if (altNavigation) {
    const scope = keyboardScope(target) || target.closest('[data-keyboard-workspace]');
    event.preventDefault();
    if (keyboardScope(target)) focusAdjacentFormField(target, ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1, true);
    else {
      const fields = Array.from(scope.querySelectorAll(fieldSelector)).filter(isAvailable);
      fields[fields.indexOf(target) + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1)]?.focus();
    }
    return;
  }
  // Botones, listas y campos especiales conservan sus propias teclas.
  if (!target.matches?.('input, textarea') || !keyboardScope(target) || target.hasAttribute?.('list')
    || ['file', 'checkbox', 'radio', 'range', 'color', 'date', 'time', 'month', 'week', 'datetime-local'].includes(target.type)) return;

  let direction = 0;
  if (event.key === 'Enter') {
    if (target.tagName === 'TEXTAREA' && !event.ctrlKey && !event.metaKey) return;
    if (target.tagName !== 'TEXTAREA' && (event.ctrlKey || event.metaKey || event.altKey)) return;
    direction = event.shiftKey ? -1 : 1;
  } else if (target.tagName === 'INPUT' && !event.altKey && !event.ctrlKey && !event.metaKey
    && ['text', 'search', 'email', 'tel', 'url', 'password'].includes(target.type)
    && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    direction = event.key === 'ArrowDown' ? 1 : -1;
  }

  if (!direction) return;
  event.preventDefault();
  focusAdjacentFormField(target, direction);
};
