import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleFormNavigationKeyDown } from '../../src/features/shared/components/formKeyboardNavigation.js';

const originalWindow = globalThis.window;
afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

// Se simulan las medidas de visibilidad; estas pruebas cubren decisiones de teclado,
// no el diseño visual ni la distribución de elementos en un navegador.
const formFixture = (definitions = ['INPUT', 'INPUT', 'BUTTON']) => {
  let focused = null;
  const form = { querySelectorAll: () => fields };
  const fields = definitions.map((definition, index) => {
    const options = typeof definition === 'string' ? { tagName: definition } : definition;
    const element = {
      disabled: false, tabIndex: 0, type: 'text', dataset: {}, ...options,
      matches: () => ['INPUT', 'SELECT', 'TEXTAREA'].includes(options.tagName),
      closest: (selector) => selector === 'form' ? form : (options.hidden ? {} : null),
      getClientRects: () => options.invisible ? [] : [{}],
      focus: () => { focused = index; },
    };
    return element;
  });
  globalThis.window = { requestAnimationFrame: (callback) => callback() };
  return {
    fields, focused: () => focused,
    key: (index, key, overrides = {}) => {
      const event = { target: fields[index], key, preventDefault() { this.defaultPrevented = true; }, ...overrides };
      handleFormNavigationKeyDown(event);
      return event;
    },
  };
};

test('Enter avanza sin enviar y Shift+Enter vuelve al campo anterior', () => {
  const form = formFixture();
  assert.equal(form.key(0, 'Enter').defaultPrevented, true);
  assert.equal(form.focused(), 1);
  form.key(1, 'Enter', { shiftKey: true });
  assert.equal(form.focused(), 0);
});

test('Enter omite campos deshabilitados, ocultos y fuera de navegación', () => {
  const form = formFixture(['INPUT', { tagName: 'INPUT', disabled: true }, { tagName: 'INPUT', hidden: true },
    { tagName: 'INPUT', tabIndex: -1 }, { tagName: 'INPUT', invisible: true }, 'BUTTON']);
  form.key(0, 'Enter');
  assert.equal(form.focused(), 5);
});

test('flechas arriba y abajo cambian campo de entrada; izquierda conserva el cursor', () => {
  const form = formFixture();
  form.key(0, 'ArrowDown');
  assert.equal(form.focused(), 1);
  form.key(1, 'ArrowUp');
  assert.equal(form.focused(), 0);
  assert.equal(form.key(0, 'ArrowLeft').defaultPrevented, undefined);
});

test('textarea conserva Enter para escribir; Ctrl+Enter y Alt+flecha permiten avanzar', () => {
  const form = formFixture(['TEXTAREA', 'SELECT', 'BUTTON']);
  assert.equal(form.key(0, 'Enter').defaultPrevented, undefined);
  assert.equal(form.focused(), null);
  form.key(0, 'Enter', { ctrlKey: true });
  assert.equal(form.focused(), 1);
  assert.equal(form.key(1, 'ArrowDown').defaultPrevented, undefined);
  form.key(1, 'ArrowDown', { altKey: true });
  assert.equal(form.focused(), 2);
});

test('autocompletado, archivos y composición de texto conservan sus propias teclas', () => {
  const form = formFixture([{ tagName: 'INPUT', dataset: { autocompleteInput: 'true' } }, { tagName: 'INPUT', type: 'file' }, 'INPUT']);
  assert.equal(form.key(0, 'Enter').defaultPrevented, undefined);
  assert.equal(form.key(1, 'Enter').defaultPrevented, undefined);
  assert.equal(form.key(2, 'Enter', { isComposing: true }).defaultPrevented, undefined);
  assert.equal(form.focused(), null);
});

test('no salta fuera del formulario al retroceder desde el primer campo', () => {
  const form = formFixture();
  form.key(0, 'Enter', { shiftKey: true });
  assert.equal(form.focused(), null);
});
