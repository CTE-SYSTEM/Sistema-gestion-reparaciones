import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { attachKeyboardWorkflow, isGroupThreePath, isKeyboardPath } from '../../src/features/shared/components/keyboardWorkflow.js';
import { handleFormNavigationKeyDown } from '../../src/features/shared/components/formKeyboardNavigation.js';

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

test('grupo tres incluye administración, finanzas, Secretaría y la cuenta compartida', () => {
  for (const path of ['/', '/admin', '/admin/usuarios', '/admin/reglas', '/admin/respaldos', '/admin/historial-equipo', '/contabilidad', '/contabilidad/movimientos', '/contabilidad/reportes', '/secretaria', '/secretaria/clientes', '/mi-cuenta', '/tecnico/mi-cuenta', '/tecnico-jefe/mi-cuenta']) {
    assert.equal(isGroupThreePath(path), true, path); assert.equal(isKeyboardPath(path), true, path);
  }
  for (const path of ['/login', '/recuperar-password', '/foto-temporal/abc', '/administrador-falso', '/contabilidad-extra']) assert.equal(isKeyboardPath(path), false, path);
});

test('Guardar y Continuar espera a que el formulario de destino habilite sus campos', async () => {
  const f = fixture('<form><button type="button">Cancelar</button><fieldset disabled><input id="client"><select><option>Equipo</option></select></fieldset></form>');
  const dispose = attachKeyboardWorkflow(f.root); await f.tick();
  assert.equal(f.document.activeElement, f.document.body);
  f.root.querySelector('fieldset').disabled = false; await f.tick();
  assert.equal(f.document.activeElement.id, 'client'); dispose(); f.close();
});

test('una carga adicional que deshabilita los campos recupera el foco al terminar', async () => {
  const f = fixture('<form><fieldset><input id="client"><input></fieldset></form>');
  const dispose = attachKeyboardWorkflow(f.root); await f.tick(); assert.equal(f.document.activeElement.id, 'client');
  const fields = f.root.querySelector('fieldset'); fields.disabled = true;
  f.document.body.tabIndex = -1; f.document.body.focus(); await f.tick();
  fields.disabled = false; await f.tick(); assert.equal(f.document.activeElement.id, 'client');
  dispose(); f.close();
});

test('agregar una tarifa enfoca el nombre nuevo sin dividir el formulario principal', async () => {
  const f = fixture('<form><input id="limit"><button id="add" type="button" data-keyboard-open="#new-rate">Agregar tarifa</button><div id="rows"></div><input id="reason"><button id="save">Guardar cambios</button></form>');
  const dispose = attachKeyboardWorkflow(f.root); await f.tick();
  f.root.querySelector('#add').onclick = () => {
    f.root.querySelector('#rows').innerHTML = '<div id="new-rate"><input id="rate-name"><input id="amount" type="number"></div>';
    // React prepara el destino de la siguiente fila antes del siguiente frame.
    f.root.querySelector('#add').dataset.keyboardOpen = '#next-rate';
  };
  f.root.querySelector('#add').focus(); f.root.querySelector('#add').click(); await f.tick();
  assert.equal(f.document.activeElement.id, 'rate-name');
  f.key(f.root.querySelector('#rate-name'), 'Enter'); await f.tick(); assert.equal(f.document.activeElement.id, 'amount');
  f.key(f.root.querySelector('#amount'), 'Enter'); await f.tick(); assert.equal(f.document.activeElement.id, 'reason');
  dispose(); f.close();
});

test('quitar la última tarifa vuelve a Agregar y no deja el foco en el cuerpo', async () => {
  const f = fixture('<form><section id="rates"><button id="add" type="button">Agregar tarifa</button><div id="row"><input><button id="remove" type="button" data-keyboard-open="#rates">Quitar</button></div></section><input id="reason"></form>');
  const dispose = attachKeyboardWorkflow(f.root); await f.tick();
  const remove = f.root.querySelector('#remove'); remove.onclick = () => f.root.querySelector('#row').remove();
  remove.focus(); remove.click(); await f.tick(); assert.equal(f.document.activeElement.id, 'add');
  dispose(); f.close();
});

test('una confirmación de restauración sólo enfoca Cargar; nunca la ejecuta al avanzar', async () => {
  const f = fixture('<div role="dialog"><section data-keyboard-form><input id="confirmation" value="RESTAURAR"><button type="button">Cancelar</button><button id="restore" type="button" data-keyboard-primary>Cargar versión</button></section></div>');
  let restored = false; f.root.querySelector('#restore').onclick = () => { restored = true; };
  f.key(f.root.querySelector('#confirmation'), 'Enter'); await f.tick();
  assert.equal(f.document.activeElement.id, 'restore'); assert.equal(restored, false); f.close();
});

test('una restauración no confirmada conserva su acción bloqueada al usar atajos', () => {
  const f = fixture('<section data-keyboard-form><input id="confirmation"><button type="button">Cancelar</button><button disabled type="button" data-keyboard-primary>Cargar versión</button></section>');
  const confirmation = f.root.querySelector('#confirmation');
  f.key(confirmation, 'End', { altKey: true }); assert.equal(f.document.activeElement, confirmation);
  assert.equal(f.root.querySelector('[data-keyboard-primary]').disabled, true); f.close();
});

test('editar otra orden reutiliza el panel y vuelve a sus selectores', async () => {
  const f = fixture('<button id="edit" data-keyboard-open="#editor">Ver / Editar</button><section id="editor" data-keyboard-form><select id="status"><option>Pendiente</option></select><select id="tech"><option>Sin asignar</option></select><button data-keyboard-primary type="button">Aplicar cambios</button></section>');
  const dispose = attachKeyboardWorkflow(f.root); await f.tick();
  f.root.querySelector('#tech').focus(); f.root.querySelector('#edit').click(); await f.tick();
  assert.equal(f.document.activeElement.id, 'status'); dispose(); f.close();
});

test('reportes y movimientos respetan los límites de sus formularios y las fechas nativas', async () => {
  const f = fixture('<form><select id="report"><option>Reporte</option></select><input type="date" id="from"><button id="consult">Consultar</button></form><form><input id="amount" type="number"><button id="record">Registrar movimiento</button></form>');
  assert.equal(f.key(f.root.querySelector('#from'), 'Enter').defaultPrevented, false);
  f.key(f.root.querySelector('#from'), 'End', { altKey: true }); assert.equal(f.document.activeElement.id, 'consult');
  f.key(f.root.querySelector('#amount'), 'Enter'); await f.tick(); assert.equal(f.document.activeElement.id, 'record'); f.close();
});

test('las ventanas administrativas mantienen Tab dentro y Escape vuelve al botón de la fila', async () => {
  const f = fixture('<button id="edit">Editar equipo</button><div id="host"></div>');
  const dispose = attachKeyboardWorkflow(f.root); await f.tick();
  f.root.querySelector('#edit').focus(); f.root.querySelector('#edit').click();
  f.root.querySelector('#host').innerHTML = '<div role="dialog" aria-modal="true"><form><input id="model"><button id="cancel" type="button">Cancelar</button><button id="save">Guardar</button></form></div>';
  f.root.querySelector('#cancel').onclick = () => f.root.querySelector('[role=dialog]').remove();
  await f.tick(); assert.equal(f.document.activeElement.id, 'model');
  f.key(f.root.querySelector('#save'), 'Tab'); assert.equal(f.document.activeElement.id, 'model');
  f.key(f.root.querySelector('#model'), 'Escape'); await f.tick(); assert.equal(f.document.activeElement.id, 'edit');
  dispose(); f.close();
});
