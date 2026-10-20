import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { attachKeyboardWorkflow, isGroupOnePath } from '../../src/features/shared/components/keyboardWorkflow.js';
import { handleFormNavigationKeyDown } from '../../src/features/shared/components/formKeyboardNavigation.js';

const fixture = (html) => {
  const dom = new JSDOM(`<main data-keyboard-workspace>${html}</main>`, { pretendToBeVisual: true });
  const { window } = dom, { document } = window;
  window.HTMLElement.prototype.getClientRects = function () {
    return this.closest('[hidden],[inert],[aria-hidden="true"]') || this.style.display === 'none' ? [] : [{}];
  };
  const root = document.querySelector('main');
  root.addEventListener('keydown', handleFormNavigationKeyDown);
  const key = (element, value, extra = {}) => {
    element.focus();
    const event = new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...extra });
    element.dispatchEvent(event);
    return event;
  };
  const tick = () => new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  return { window, document, root, key, tick, close: () => dom.window.close() };
};

test('el grupo uno incluye sus pantallas compartidas y excluye los otros módulos', () => {
  for (const path of ['/recepcion', '/recepcion/clientes', '/servicio-cliente/nueva-orden', '/servicio-cliente/facturacion', '/bodega/compras', '/tecnico', '/secretaria/equipos', '/contabilidad/facturacion']) assert.equal(isGroupOnePath(path), true, path);
  for (const path of ['/reclamos', '/servicio-cliente/reclamos', '/garantias', '/tecnico-jefe', '/admin/usuarios', '/login', '/tecnico/mi-cuenta']) assert.equal(isGroupOnePath(path), false, path);
});

test('Enter llega a Guardar sin activarlo ni pasar por Cancelar; Alt permite recorrer ambas acciones', async () => {
  const f = fixture('<form><input id="first"><input readonly><button type="button" data-keyboard-skip>Opciones</button><button id="cancel" type="button">Cancelar</button><button id="save" type="submit">Guardar</button></form>');
  let clicked = false;
  f.document.querySelector('#cancel').onclick = () => { clicked = true; };
  f.key(f.document.querySelector('#first'), 'Enter'); await f.tick();
  assert.equal(f.document.activeElement.id, 'save'); assert.equal(clicked, false);
  f.key(f.document.querySelector('#cancel'), 'ArrowDown', { altKey: true }); await f.tick();
  assert.equal(f.document.activeElement.id, 'save');
  f.close();
});

test('listas, fechas, números y casillas conservan flechas y teclas nativas; textarea conserva saltos', () => {
  const f = fixture('<form><select><option>Uno</option><option>Dos</option></select><input type="number"><input type="date"><input type="checkbox"><textarea></textarea><button>Guardar</button></form>');
  for (const field of f.root.querySelectorAll('select,input')) assert.equal(f.key(field, 'ArrowDown').defaultPrevented, false);
  for (const field of f.root.querySelectorAll('select,input[type=date]')) assert.equal(f.key(field, 'Enter').defaultPrevented, false);
  assert.equal(f.key(f.root.querySelector('input[type=checkbox]'), ' ').defaultPrevented, false);
  assert.equal(f.key(f.root.querySelector('textarea'), 'Enter').defaultPrevented, false);
  f.close();
});

test('los controles deshabilitados por fieldset y los paneles ocultos no detienen el recorrido', async () => {
  const f = fixture('<form><input id="first"><fieldset disabled><input></fieldset><div hidden><input></div><input tabindex="-1"><button id="save">Guardar</button></form>');
  f.key(f.root.querySelector('#first'), 'Enter'); await f.tick();
  assert.equal(f.document.activeElement.id, 'save'); f.close();
});

test('los paneles sin form y las búsquedas también permiten navegación con Alt+flechas', async () => {
  const f = fixture('<input id="search"><button id="new" type="button">Nuevo</button><section data-keyboard-form><input id="receiver"><button id="confirm" data-keyboard-primary type="button">Confirmar</button></section>');
  f.key(f.root.querySelector('#search'), 'ArrowDown', { altKey: true });
  assert.equal(f.document.activeElement.id, 'new');
  f.key(f.root.querySelector('#receiver'), 'Enter'); await f.tick();
  assert.equal(f.document.activeElement.id, 'confirm'); f.close();
});

test('crear y editar reciben foco y cancelar vuelve al botón que abrió el formulario', async () => {
  const f = fixture('<button id="new" type="button">Nuevo</button><div id="host"></div>');
  const cleanup = attachKeyboardWorkflow(f.root); await f.tick();
  const opener = f.root.querySelector('#new'); opener.focus(); opener.click();
  f.root.querySelector('#host').innerHTML = '<form><input id="name"><button id="cancel" type="button">Cancelar</button></form>';
  await f.tick(); assert.equal(f.document.activeElement.id, 'name');
  f.root.querySelector('#cancel').focus(); f.root.querySelector('form').remove();
  await f.tick(); assert.equal(f.document.activeElement, opener);
  cleanup(); f.close();
});

test('editar otro registro con el formulario abierto vuelve al primer campo', async () => {
  const f = fixture('<button data-keyboard-open="true" id="edit" type="button">Editar</button><form><input id="name"><input id="phone"></form>');
  const cleanup = attachKeyboardWorkflow(f.root); await f.tick();
  f.root.querySelector('#phone').focus();
  f.root.querySelector('#edit').click(); await f.tick();
  assert.equal(f.document.activeElement.id, 'name');
  f.root.querySelector('form').remove();
  f.root.querySelector('#edit').outerHTML = '<button id="edit" data-keyboard-open="true" type="button">Editar</button>';
  await f.tick();
  assert.equal(f.document.activeElement.id, 'edit'); cleanup(); f.close();
});

test('ventanas técnicas mantienen Tab dentro y Escape activa solamente Cerrar', async () => {
  const f = fixture('<button id="open">Abrir</button><div id="host"></div>');
  const cleanup = attachKeyboardWorkflow(f.root); await f.tick();
  f.root.querySelector('#open').focus(); f.root.querySelector('#open').click();
  f.root.querySelector('#host').innerHTML = '<div role="dialog"><button id="close" type="button" aria-label="Cerrar diagnóstico">X</button><form><textarea id="report"></textarea><button id="save" type="submit">Guardar</button></form></div>';
  const close = f.root.querySelector('#close'); close.onclick = () => f.root.querySelector('[role=dialog]').remove();
  await f.tick(); assert.equal(f.document.activeElement.id, 'report');
  assert.equal(f.key(f.root.querySelector('#save'), 'Tab').defaultPrevented, true);
  assert.equal(f.document.activeElement, close);
  f.key(close, 'Tab', { shiftKey: true }); assert.equal(f.document.activeElement.id, 'save');
  f.key(f.root.querySelector('#report'), 'Escape'); await f.tick();
  assert.equal(f.root.querySelector('[role=dialog]'), null);
  assert.equal(f.document.activeElement.id, 'open'); cleanup(); f.close();
});

test('Escape con un autocompletado abierto no cierra la ventana', async () => {
  const f = fixture('<div role="dialog"><button id="close" aria-label="Cerrar">X</button><input role="combobox" aria-expanded="true"></div>');
  let closed = false; f.root.querySelector('#close').onclick = () => { closed = true; };
  const cleanup = attachKeyboardWorkflow(f.root); await f.tick();
  f.key(f.root.querySelector('input'), 'Escape'); assert.equal(closed, false);
  cleanup(); f.close();
});

test('un error de guardado se anuncia y recibe el foco sin reenviar', async () => {
  const f = fixture('<form><input><button id="save">Guardar</button></form>');
  const cleanup = attachKeyboardWorkflow(f.root); await f.tick();
  f.root.querySelector('form').dispatchEvent(new f.window.Event('submit', { bubbles: true, cancelable: true }));
  const alert = f.document.createElement('p'); alert.setAttribute('role', 'alert'); alert.textContent = 'No se pudo guardar'; f.root.append(alert);
  await f.tick(); assert.equal(f.document.activeElement, alert); cleanup(); f.close();
});

test('Enter en un selector no dispara un guardado implícito, pero Enter desde Guardar sí lo permite', async () => {
  const f = fixture('<form><select><option>Una</option></select><button id="save" type="submit">Guardar</button></form>');
  const cleanup = attachKeyboardWorkflow(f.root); await f.tick();
  const form = f.root.querySelector('form');
  f.key(f.root.querySelector('select'), 'Enter');
  const implicit = new f.window.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(implicit); assert.equal(implicit.defaultPrevented, true);
  f.key(f.root.querySelector('#save'), 'Enter');
  const explicit = new f.window.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(explicit); assert.equal(explicit.defaultPrevented, false);
  cleanup(); f.close();
});

test('una respuesta tardía no roba el foco a quien está escribiendo en la búsqueda', async () => {
  const f = fixture('<input id="search"><div id="results"></div>');
  const cleanup = attachKeyboardWorkflow(f.root);
  f.root.querySelector('#search').focus();
  f.root.querySelector('#results').innerHTML = '<article data-keyboard-form><input id="row"></article>';
  await f.tick(); assert.equal(f.document.activeElement.id, 'search'); cleanup(); f.close();
});

test('las sugerencias nativas datalist conservan Enter y flechas y admiten Alt para avanzar', async () => {
  const f = fixture('<form><input list="names"><datalist id="names"><option value="Laptop"></datalist><input id="next"></form>');
  const input = f.root.querySelector('input');
  assert.equal(f.key(input, 'ArrowDown').defaultPrevented, false);
  assert.equal(f.key(input, 'Enter').defaultPrevented, false);
  f.key(input, 'ArrowDown', { altKey: true }); await f.tick();
  assert.equal(f.document.activeElement.id, 'next'); f.close();
});

test('Alt+Fin enfoca Guardar sin enviar y Alt+Inicio vuelve al primer campo', () => {
  const f = fixture('<form><input id="first"><select><option>Una</option></select><input type="file"><button type="button">Cancelar</button><button id="save" type="submit">Guardar</button></form>');
  let submitted = false; f.root.querySelector('form').onsubmit = () => { submitted = true; };
  f.key(f.root.querySelector('select'), 'End', { altKey: true });
  assert.equal(f.document.activeElement.id, 'save'); assert.equal(submitted, false);
  f.key(f.root.querySelector('#save'), 'Home', { altKey: true });
  assert.equal(f.document.activeElement.id, 'first'); f.close();
});

test('al volver del formulario espera a que reaparezca la fila para restaurar el foco', async () => {
  const f = fixture('<input id="search" placeholder="Buscar"><button id="edit" aria-label="Editar cliente 1" data-keyboard-open>Editar</button><div id="host"></div>');
  const cleanup = attachKeyboardWorkflow(f.root); await f.tick();
  f.root.querySelector('#edit').focus(); f.root.querySelector('#edit').click();
  f.root.querySelector('#host').innerHTML = '<form><input id="name"></form>'; await f.tick();
  f.root.querySelector('form').remove(); f.root.querySelector('#edit').remove(); await f.tick();
  assert.equal(f.document.activeElement.id, 'search');
  f.root.querySelector('#host').innerHTML = '<button id="new-edit" aria-label="Editar cliente 1">Editar</button>'; await f.tick();
  assert.equal(f.document.activeElement.id, 'new-edit');
  cleanup(); f.close();
});

test('guardar un borrador conserva el foco al volver a habilitar el botón', async () => {
  const f = fixture('<form><textarea></textarea><button id="draft" type="button">Guardar borrador</button><button type="submit">Completar</button></form>');
  const cleanup = attachKeyboardWorkflow(f.root); await f.tick();
  const draft = f.root.querySelector('#draft'); draft.focus(); draft.click(); draft.disabled = true;
  // jsdom no reproduce el desenfoque nativo al deshabilitar el botón.
  f.document.body.tabIndex = -1; f.document.body.focus();
  await f.tick(); assert.equal(f.document.activeElement, f.document.body);
  draft.disabled = false; await f.tick(); assert.equal(f.document.activeElement, draft);
  cleanup(); f.close();
});

test('un seguimiento recreado tras guardar vuelve a su acción aunque cambie el texto', async () => {
  const f = fixture('<input placeholder="Buscar"><section data-keyboard-form><input><button id="save" type="button" data-keyboard-primary data-keyboard-id="seguimiento-1">Guardar seguimiento</button></section>');
  const cleanup = attachKeyboardWorkflow(f.root); await f.tick();
  const save = f.root.querySelector('#save'); save.focus(); save.click();
  f.root.querySelector('section').remove(); await f.tick();
  f.root.insertAdjacentHTML('beforeend', '<section data-keyboard-form><input><button id="saved" type="button" data-keyboard-id="seguimiento-1">Seguimiento actualizado</button></section>');
  await f.tick(); assert.equal(f.document.activeElement.id, 'saved');
  cleanup(); f.close();
});
