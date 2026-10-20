import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { attachKeyboardWorkflow, isGroupTwoPath, isKeyboardPath } from '../../src/features/shared/components/keyboardWorkflow.js';
import { handleFormNavigationKeyDown } from '../../src/features/shared/components/formKeyboardNavigation.js';
import { focusLookupResult, handleChoiceNavigationKeyDown } from '../../src/features/shared/components/choiceKeyboardNavigation.js';

const fixture = (html) => {
  const dom = new JSDOM(`<main data-keyboard-workspace>${html}</main>`, { pretendToBeVisual: true });
  const { window } = dom, { document } = window;
  window.HTMLElement.prototype.getClientRects = function () {
    return this.closest('[hidden],[inert],[aria-hidden="true"]') ? [] : [{}];
  };
  const root = document.querySelector('main');
  root.addEventListener('keydown', handleFormNavigationKeyDown);
  const key = (element, value, extra = {}) => {
    element.focus();
    const event = new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...extra });
    element.dispatchEvent(event); return event;
  };
  const tick = () => new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  return { window, document, root, key, tick, close: () => window.close() };
};

test('grupo dos activa supervisión y posventa en todas sus direcciones compartidas', () => {
  for (const path of ['/tecnico-jefe', '/calidad', '/reclamos', '/garantias', '/garantias/reclamos', '/servicio-cliente/reclamos']) {
    assert.equal(isGroupTwoPath(path), true, path); assert.equal(isKeyboardPath(path), true, path);
  }
  for (const path of ['/tecnico-jefe/mi-cuenta', '/admin/garantias', '/contabilidad/movimientos', '/secretaria']) assert.equal(isGroupTwoPath(path), false, path);
  assert.equal(isKeyboardPath('/login'), false);
  assert.equal(isKeyboardPath('/recepcion/clientes'), true);
});

test('revalidar una garantía enfoca Meses al abrir y vuelve a su fila al cerrar', async () => {
  const f = fixture('<button id="open" data-keyboard-id="garantia-3">Revalidar vigencia</button><section hidden data-keyboard-form><input id="months" type="number"><input><button type="button" data-keyboard-primary>Guardar</button></section>');
  const dispose = attachKeyboardWorkflow(f.root); await f.tick();
  const open = f.root.querySelector('#open'), scope = f.root.querySelector('section'); open.focus(); open.click(); scope.hidden = false;
  await f.tick(); assert.equal(f.document.activeElement.id, 'months');
  // Un navegador desenfoca controles de un panel oculto; jsdom requiere reproducirlo.
  f.document.body.tabIndex = -1; f.document.body.focus(); scope.hidden = true; await f.tick();
  assert.equal(f.document.activeElement.id, 'open');
  dispose(); f.close();
});

test('Calidad ofrece la decisión habilitada con Alt+Fin sin aprobar ni devolver automáticamente', async () => {
  const f = fixture('<section data-keyboard-form><select><option>Falla</option></select><textarea id="evidence"></textarea><input id="part"><button disabled type="button" data-keyboard-primary>Aprobar</button><button id="return" type="button" data-keyboard-primary>Devolver</button></section>');
  let saved = false; f.root.querySelector('#return').onclick = () => { saved = true; };
  f.key(f.root.querySelector('#evidence'), 'Enter'); assert.equal(saved, false);
  f.key(f.root.querySelector('#evidence'), 'Enter', { ctrlKey: true }); await f.tick(); assert.equal(f.document.activeElement.id, 'part');
  f.key(f.root.querySelector('#part'), 'End', { altKey: true });
  assert.equal(f.document.activeElement.id, 'return'); assert.equal(saved, false); f.close();
});

test('las flechas recorren clientes y equipos sin seleccionar hasta pulsar su acción', () => {
  const f = fixture('<div id="choices"><button id="a">Cliente A</button><button disabled>Oculto</button><button id="b">Cliente B</button></div>');
  const choices = f.root.querySelector('#choices'); choices.addEventListener('keydown', handleChoiceNavigationKeyDown);
  let selected = false; f.root.querySelector('#b').onclick = () => { selected = true; };
  f.key(f.root.querySelector('#a'), 'ArrowDown'); assert.equal(f.document.activeElement.id, 'b'); assert.equal(selected, false);
  f.key(f.root.querySelector('#b'), 'ArrowRight'); assert.equal(f.document.activeElement.id, 'a');
  f.key(f.root.querySelector('#a'), 'End'); assert.equal(f.document.activeElement.id, 'b');
  assert.equal(f.key(f.root.querySelector('#b'), 'Enter').defaultPrevented, false); f.close();
});

test('la carga de órdenes continúa en la primera elegible y no interrumpe otra escritura', () => {
  const f = fixture('<button id="equipment">Elegir equipo</button><textarea id="description"></textarea><section id="orders"><input disabled type="radio"><input id="eligible" type="radio"></section>');
  const origin = f.root.querySelector('#equipment'), orders = f.root.querySelector('#orders'); origin.focus();
  focusLookupResult(orders, origin); assert.equal(f.document.activeElement.id, 'eligible');
  f.root.querySelector('#description').focus(); focusLookupResult(orders, origin);
  assert.equal(f.document.activeElement.id, 'description'); f.close();
});

test('sin órdenes elegibles se enfoca la explicación y se conservan las opciones bloqueadas', () => {
  const f = fixture('<button id="equipment">Equipo</button><section><p tabindex="-1" data-keyboard-empty>Se exige entrega y factura</p><input disabled type="radio"></section>');
  const origin = f.root.querySelector('#equipment'); origin.focus(); focusLookupResult(f.root.querySelector('section'), origin);
  assert.equal(f.document.activeElement.textContent, 'Se exige entrega y factura'); assert.equal(f.root.querySelector('input').disabled, true); f.close();
});

test('al recargar casos con botones iguales vuelve al reclamo correcto por su identidad', async () => {
  const f = fixture('<button data-keyboard-id="caso-1">Ver caso</button><button id="case2" data-keyboard-id="caso-2">Ver caso</button><div id="host"></div>');
  const dispose = attachKeyboardWorkflow(f.root); await f.tick();
  const opener = f.root.querySelector('#case2'); opener.focus(); opener.click();
  f.root.querySelector('#host').innerHTML = '<form><textarea></textarea></form>'; await f.tick();
  opener.remove(); f.root.querySelector('form').remove();
  f.root.insertAdjacentHTML('beforeend', '<button id="restored" data-keyboard-id="caso-2">Ver caso</button>');
  await f.tick(); assert.equal(f.document.activeElement.id, 'restored'); dispose(); f.close();
});

test('cerrar un caso que desaparece de Activos deja el foco en la búsqueda', async () => {
  const f = fixture('<input type="search" id="search"><button id="case">Ver caso</button><div id="host"></div>');
  const dispose = attachKeyboardWorkflow(f.root); await f.tick();
  const opener = f.root.querySelector('#case'); opener.focus(); opener.click();
  f.root.querySelector('#host').innerHTML = '<form><textarea></textarea></form>'; await f.tick();
  f.root.querySelector('form').remove(); await f.tick(); assert.equal(f.document.activeElement.id, 'case');
  opener.remove(); await f.tick(); assert.equal(f.document.activeElement.id, 'search');
  dispose(); f.close();
});
