import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PHOTO_BYTES, selectNewPhotos, uploadPhotoBatch } from '../src/features/secretaria/components/shared/photoQueue.js';

const file = (name, overrides = {}) => ({ name, size: 1024, type: 'image/jpeg', lastModified: 10, ...overrides });

test('agregar otra tanda conserva la selección y omite el mismo archivo', () => {
  const first = file('frente.jpg');
  const second = file('serie.jpg');
  const selected = [{ id: 'first', file: first, status: 'pending' }];
  const result = selectNewPhotos([first, second, second], selected);
  assert.deepEqual(result.accepted, [second]);
  assert.equal(result.duplicates, 2);
  assert.deepEqual(selected.map((photo) => photo.file), [first]);
});

test('rechaza formatos, archivos vacíos y tamaños inválidos antes de subir', () => {
  const limit = file('limite.png', { type: 'image/png', size: MAX_PHOTO_BYTES });
  const result = selectNewPhotos([
    file('documento.pdf', { type: 'application/pdf' }),
    file('vacia.jpg', { size: 0 }),
    file('grande.webp', { type: 'image/webp', size: MAX_PHOTO_BYTES + 1 }),
    limit,
  ]);
  assert.deepEqual(result.accepted, [limit]);
  assert.equal(result.rejected.length, 3);
});

test('una foto fallida no bloquea las demás y el reintento omite las guardadas', async () => {
  const photos = ['a', 'b', 'c'].map((id) => ({ id, file: file(`${id}.jpg`), status: 'pending' }));
  const state = new Map(photos.map((photo) => [photo.id, photo]));
  const change = (id, patch) => state.set(id, { ...state.get(id), ...patch });
  const attempts = [];
  const first = await uploadPhotoBatch(photos, async (photo, progress) => {
    attempts.push(photo.id);
    progress(100);
    if (photo.id === 'b') throw { response: { data: { error: 'Sin conexión' } } };
  }, change);
  assert.deepEqual(attempts, ['a', 'b', 'c']);
  assert.equal(first.totalUploaded, 2);
  assert.equal(state.get('b').status, 'failed');
  assert.equal(state.get('b').error, 'Sin conexión');
  attempts.length = 0;
  const retry = await uploadPhotoBatch([...state.values()], async (photo) => attempts.push(photo.id), change);
  assert.deepEqual(attempts, ['b']);
  assert.equal(retry.totalUploaded, 3);
  assert.equal(retry.failed.length, 0);
});

test('enviar el 100% de bytes aún requiere confirmación para marcar Guardada', async () => {
  const photo = { id: 'a', file: file('foto.jpg'), status: 'pending' };
  let current = photo;
  let confirm;
  const batch = uploadPhotoBatch([photo], async (_photo, progress) => {
    progress(100);
    await new Promise((resolve) => { confirm = resolve; });
  }, (_id, patch) => { current = { ...current, ...patch }; });
  assert.equal(current.progress, 100);
  assert.equal(current.status, 'uploading');
  confirm();
  await batch;
  assert.equal(current.status, 'uploaded');
});
