import { fieldSelector, isAvailable } from './formKeyboardNavigation.js';

export const isGroupOnePath = (path) => /^\/(recepcion|bodega)(\/|$)/.test(path)
  || /^\/servicio-cliente(\/|$)/.test(path) && !path.endsWith('/reclamos')
  || path === '/tecnico'
  || ['/contabilidad/facturacion', '/admin/flujo-atencion'].includes(path)
  || /^\/secretaria\/(clientes|equipos|diagnostico|orden-directa|nueva-orden|flujo-atencion|facturacion|repuestos|tipos-repuesto|compras|proveedores)$/.test(path);

export const isGroupTwoPath = (path) => ['/tecnico-jefe', '/calidad', '/reclamos', '/garantias', '/garantias/reclamos', '/servicio-cliente/reclamos'].includes(path);
export const isGroupThreePath = (path) => /^\/(admin|contabilidad|secretaria)(\/|$)/.test(path)
  || ['/', '/mi-cuenta', '/tecnico/mi-cuenta', '/tecnico-jefe/mi-cuenta'].includes(path);
export const isKeyboardPath = (path) => isGroupOnePath(path) || isGroupTwoPath(path) || isGroupThreePath(path);

const scopesSelector = 'form, [data-keyboard-form], [role="dialog"], dialog[open]';
const entries = (scope) => Array.from(scope.querySelectorAll(fieldSelector)).filter(isAvailable);
const rememberOpener = (opener) => ({ opener, id: opener?.id, key: opener?.getAttribute('data-keyboard-id'), label: opener?.getAttribute('aria-label'), text: opener?.textContent.trim() });
const restoreOpener = (root, record) => {
  if (record.opener?.isConnected && isAvailable(record.opener)) return record.opener;
  return entries(root).find((element) => record.id && element.id === record.id
    || record.key && element.getAttribute('data-keyboard-id') === record.key
    || record.label && element.getAttribute('aria-label') === record.label
    || !record.id && !record.key && !record.label && record.text && element.matches('button,a') && element.textContent.trim() === record.text);
};
const focusFirst = (scope) => {
  const fields = entries(scope);
  const preferred = fields.find((field) => field.hasAttribute('autofocus'))
    || fields.find((field) => field.matches('input,select,textarea') && !field.readOnly && field.type !== 'file')
    || fields[0];
  preferred?.focus();
};

// Gestiona sólo el foco y las ventanas; no guarda, cancela ni crea registros por sí mismo.
export const attachKeyboardWorkflow = (root) => {
  const doc = root.ownerDocument, win = doc.defaultView;
  let opener = null, pendingOpen = true, pendingSubmit = false, implicitEnter = false, frame = null;
  let scopes = new Map(), alerts = new Set();
  let pendingReturn = null;
  let busyAction = null;
  let waitingScope = null;
  let waitingField = null;
  let lastFocused = null;
  const rememberFocus = (event) => { lastFocused = event.target; };
  const schedule = () => {
    if (frame !== null) return;
    frame = win.requestAnimationFrame(scan);
  };
  const scan = () => {
    frame = null;
    const visible = Array.from(root.querySelectorAll(scopesSelector)).filter((scope) =>
      !scope.closest('[hidden], [aria-hidden="true"], [inert]') && scope.getClientRects().length);
    const added = visible.filter((scope) => !scopes.has(scope));
    const removed = [...scopes].filter(([scope]) => !visible.includes(scope));
    const previous = scopes;
    scopes = new Map(visible.map((scope) => [scope, previous.get(scope) || rememberOpener(opener)]));
    if (added.length && pendingOpen) {
      waitingScope = added.find((scope) => scope.matches('[role="dialog"],dialog')) || added[0];
    } else if (removed.length && (doc.activeElement === doc.body || !doc.activeElement?.isConnected)) {
      const returnTo = removed.map(([, record]) => restoreOpener(root, record)).reverse().find(Boolean);
      const fallback = entries(root).find((field) => field.matches('input[type="search"],input[placeholder]')) || entries(root)[0];
      (returnTo || fallback)?.focus();
      if (!returnTo && fallback) pendingReturn = { record: removed[0][1], fallback };
    }
    if (waitingScope && visible.includes(waitingScope)) {
      const fields = entries(waitingScope);
      const hasEditable = fields.some((field) => field.matches('input,select,textarea') && !field.readOnly && field.type !== 'file');
      const waitingForFields = waitingScope.querySelector('input:not([type="hidden"]):not([readonly]),select,textarea:not([readonly])') && !hasEditable;
      const typingElsewhere = doc.activeElement?.matches('input,select,textarea') && !waitingScope.contains(doc.activeElement);
      if (typingElsewhere || fields.length && !waitingForFields) {
        if (!typingElsewhere && !waitingScope.contains(doc.activeElement)) focusFirst(waitingScope);
        waitingScope = null; pendingOpen = false;
      }
    } else if (waitingScope) waitingScope = null;
    if (waitingField) {
      if (doc.activeElement === doc.body && waitingField.isConnected && isAvailable(waitingField)) {
        waitingField.focus(); waitingField = null;
      } else if (doc.activeElement !== doc.body && doc.activeElement !== waitingField) waitingField = null;
    }
    if (pendingReturn && doc.activeElement === pendingReturn.fallback) {
      const restored = restoreOpener(root, pendingReturn.record);
      if (restored) { restored.focus(); pendingReturn = null; }
    }
    if (busyAction && doc.activeElement === doc.body) {
      const recovered = restoreOpener(root, busyAction);
      if (recovered) { recovered.focus(); busyAction = null; }
    }
    if (doc.activeElement === doc.body && lastFocused && !lastFocused.isConnected) {
      const fallback = entries(root).find((field) => field.matches('input[type="search"],input[placeholder]')) || entries(root)[0];
      fallback?.focus();
    }
    const nextAlerts = new Set(root.querySelectorAll('[role="alert"]'));
    const freshError = [...nextAlerts].find((alert) => (!alerts.has(alert) || pendingSubmit) && alert.getClientRects().length);
    if (freshError && pendingSubmit) {
      const invalid = root.querySelector('input:invalid,select:invalid,textarea:invalid,[aria-invalid="true"]');
      if (invalid && isAvailable(invalid)) invalid.focus();
      else { freshError.setAttribute('tabindex', '-1'); freshError.focus(); }
      pendingSubmit = false;
    }
    alerts = nextAlerts;
  };
  const activate = (event) => {
    waitingField = null;
    const action = event.target.closest('button,a,summary,[role="button"]');
    if (!action) { busyAction = null; pendingReturn = null; return; }
    waitingScope = null;
    busyAction = action.closest(scopesSelector) ? rememberOpener(action) : null;
    const activeScope = action.closest(scopesSelector);
    if (activeScope && !scopes.get(activeScope)?.opener) scopes.set(activeScope, rememberOpener(action));
    if (action.hasAttribute('data-keyboard-primary')) pendingSubmit = true;
    const parentForm = action.closest('form');
    opener = action.type === 'submit' && parentForm ? scopes.get(parentForm)?.opener || action : action;
    pendingReturn = null;
    pendingOpen = true;
    if (event.detail > 0 || !doc.activeElement?.matches('input,select,textarea')) implicitEnter = false;
    // Editar puede reutilizar un formulario que ya estaba abierto.
    if (action.hasAttribute('data-keyboard-open')) {
      const target = action.dataset.keyboardOpen;
      win.requestAnimationFrame(() => {
      const scope = root.querySelector(target && target !== 'true' ? target : 'form,[data-keyboard-form]');
      if (scope && scope.getClientRects().length) {
        if (scope.matches(scopesSelector)) scopes.set(scope, rememberOpener(action));
        focusFirst(scope);
      }
      });
    }
    schedule();
  };
  const rememberKey = (event) => {
    waitingField = null;
    if (waitingScope && !waitingScope.contains(event.target)) { waitingScope = null; pendingOpen = false; }
    if (doc.activeElement !== doc.body) busyAction = null;
    pendingReturn = null;
    implicitEnter = event.key === 'Enter' && event.target.matches('input,select,textarea');
  };
  const submit = (event) => {
    if (implicitEnter && doc.activeElement?.matches('input,select,textarea')) {
      event.preventDefault(); event.stopPropagation(); implicitEnter = false; return;
    }
    pendingSubmit = true;
    schedule();
  };
  const invalid = (event) => {
    const form = event.target.closest('form');
    const first = form?.querySelector('input:invalid,select:invalid,textarea:invalid');
    first?.focus();
  };
  const keydown = (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    const dialog = event.target.closest('[role="dialog"],dialog[open]');
    if (!dialog || !root.contains(dialog)) return;
    if (event.key === 'Tab') {
      const fields = entries(dialog);
      if (fields.length && (!dialog.contains(doc.activeElement) || event.shiftKey && doc.activeElement === fields[0]
        || !event.shiftKey && doc.activeElement === fields.at(-1))) {
        event.preventDefault(); (event.shiftKey ? fields.at(-1) : fields[0]).focus();
      }
    } else if (event.key === 'Escape') {
      if (event.target.getAttribute('aria-expanded') === 'true') return;
      const close = Array.from(dialog.querySelectorAll('button')).find((button) => !button.disabled && (
        button.hasAttribute('data-keyboard-close') || /cerrar/i.test(button.getAttribute('aria-label') || '')
        || /^(cancelar|cerrar|volver)$/i.test(button.textContent.trim())));
      if (close) { event.preventDefault(); event.stopPropagation(); close.click(); }
    }
  };
  root.addEventListener('click', activate, true);
  root.addEventListener('focusin', rememberFocus);
  root.addEventListener('keydown', rememberKey, true);
  root.addEventListener('submit', submit, true);
  root.addEventListener('invalid', invalid, true);
  root.addEventListener('keydown', keydown);
  const observer = new win.MutationObserver((changes) => {
    if (lastFocused?.matches('input,select,textarea') && changes.some((change) => change.attributeName === 'disabled'
      && (change.target === lastFocused || change.target.contains(lastFocused)))) waitingField = lastFocused;
    schedule();
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'inert', 'class', 'disabled'] });
  schedule();
  return () => {
    observer.disconnect();
    if (frame !== null) win.cancelAnimationFrame(frame);
    root.removeEventListener('click', activate, true);
    root.removeEventListener('focusin', rememberFocus);
    root.removeEventListener('keydown', rememberKey, true);
    root.removeEventListener('submit', submit, true);
    root.removeEventListener('invalid', invalid, true);
    root.removeEventListener('keydown', keydown);
  };
};
