const fieldSelector = 'input:not([type="hidden"]):not([type="file"]), select, textarea, button[type="submit"]';

const isAvailable = (element) => !element.disabled
  && element.tabIndex !== -1
  && !element.closest('[hidden], [aria-hidden="true"]')
  && element.getClientRects().length > 0;

export const focusAdjacentFormField = (current, direction = 1) => {
  const form = current.closest('form');
  if (!form) return;
  window.requestAnimationFrame(() => {
    const fields = Array.from(form.querySelectorAll(fieldSelector)).filter(isAvailable);
    const currentIndex = fields.indexOf(current);
    if (currentIndex < 0) return;
    const next = fields[currentIndex + direction];
    next?.focus();
  });
};

export const handleFormNavigationKeyDown = (event) => {
  if (event.defaultPrevented || event.isComposing) return;
  const target = event.target;
  if (!target.matches?.('input, select, textarea') || target.type === 'file' || target.dataset.autocompleteInput) return;

  let direction = 0;
  if (event.key === 'Enter') {
    if (target.tagName === 'TEXTAREA' && !event.ctrlKey && !event.metaKey) return;
    direction = event.shiftKey ? -1 : 1;
  } else if (event.altKey && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) {
    direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1;
  } else if (target.tagName === 'INPUT' && !event.altKey && !event.ctrlKey && !event.metaKey
    && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    direction = event.key === 'ArrowDown' ? 1 : -1;
  }

  if (!direction) return;
  event.preventDefault();
  focusAdjacentFormField(target, direction);
};
