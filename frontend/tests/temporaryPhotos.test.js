import test from 'node:test';
import assert from 'node:assert/strict';
import { receiveTemporaryPhotos } from '../src/features/shared/components/receiveTemporaryPhotos.js';
import { sendTemporaryPhotoBatch } from '../src/features/shared/pages/temporaryPhotoBatch.js';

test('la PC incorpora toda la tanda en una sola preparación aunque la cola cambie a ocupada', async () => {
  const received = new Set();
  const photos = ['uno', 'dos', 'tres'].map((id) => ({ id }));
  let available = true;
  const batches = [];
  const result = await receiveTemporaryPhotos(photos, {
    received,
    isAvailable: () => available,
    download: async ({ id }) => ({ name: `${id}.jpg` }),
    add: async (files) => {
      batches.push(files.map(({ name }) => name));
      available = false;
      return { accepted: files.length };
    },
  });
  assert.deepEqual(batches, [['uno.jpg', 'dos.jpg', 'tres.jpg']]);
  assert.deepEqual([...received], ['uno', 'dos', 'tres']);
  assert.equal(result.accepted, 3);
});

test('una descarga fallida no bloquea las siguientes y se reintenta después', async () => {
  const received = new Set();
  const photos = ['uno', 'dos', 'tres'].map((id) => ({ id }));
  let failFirst = true;
  const download = async ({ id }) => {
    if (id === 'uno' && failFirst) throw new Error('Sin conexión');
    return { name: `${id}.jpg` };
  };
  const batches = [];
  const options = { received, isAvailable: () => true, download, add: async (files) => {
    batches.push(files.map(({ name }) => name));
    return { accepted: files.length };
  } };
  const first = await receiveTemporaryPhotos(photos, options);
  assert.deepEqual([...received], ['dos', 'tres']);
  assert.equal(first.failed.length, 1);
  failFirst = false;
  await receiveTemporaryPhotos(photos, options);
  assert.deepEqual(batches, [['dos.jpg', 'tres.jpg'], ['uno.jpg']]);
  assert.equal(received.size, 3);
});

test('la PC reintenta la tanda cuando la selección está ocupada', async () => {
  const received = new Set();
  const photos = [{ id: 'uno' }, { id: 'dos' }];
  let canAdd = false;
  const options = { received, isAvailable: () => true, download: async ({ id }) => ({ name: id }), add: async () => canAdd ? { accepted: 2 } : false };
  assert.equal((await receiveTemporaryPhotos(photos, options)).interrupted, true);
  assert.equal(received.size, 0);
  canAdd = true;
  await receiveTemporaryPhotos(photos, options);
  assert.equal(received.size, 2);
});

test('una foto rechazada no bloquea nuevas fotos de la sesión', async () => {
  const received = new Set();
  const batches = [];
  const options = { received, isAvailable: () => true, download: async ({ id }) => ({ name: id }), add: async (files) => {
    batches.push(files.map(({ name }) => name));
    return { accepted: files.some(({ name }) => name === 'nueva') ? 1 : 0 };
  } };
  await receiveTemporaryPhotos([{ id: 'rechazada' }], options);
  await receiveTemporaryPhotos([{ id: 'rechazada' }, { id: 'nueva' }], options);
  assert.deepEqual(batches, [['rechazada'], ['nueva']]);
  assert.deepEqual([...received], ['rechazada', 'nueva']);
});

test('el teléfono sigue enviando después de una foto fallida', async () => {
  const uploaded = [];
  const counts = [];
  const files = ['uno.jpg', 'dos.jpg', 'tres.jpg'].map((name) => ({ name }));
  const result = await sendTemporaryPhotoBatch(files, {
    count: 0,
    maxPhotos: 12,
    prepare: async (file) => file,
    upload: async (file) => {
      if (file.name === 'dos.jpg') throw new Error('Foto dañada');
      uploaded.push(file.name);
      return { count: uploaded.length };
    },
    onProgress: () => {},
    onSent: ({ count }) => counts.push(count),
  });
  assert.deepEqual(uploaded, ['uno.jpg', 'tres.jpg']);
  assert.deepEqual(counts, [1, 2]);
  assert.equal(result.sent, 2);
  assert.deepEqual(result.failed, [{ name: 'dos.jpg', error: 'Foto dañada' }]);
});

test('el teléfono respeta las plazas restantes de la sesión', async () => {
  const result = await sendTemporaryPhotoBatch([{ name: 'uno.jpg' }, { name: 'dos.jpg' }], {
    count: 11,
    maxPhotos: 12,
    prepare: async (file) => file,
    upload: async () => ({ count: 12 }),
    onProgress: () => {},
    onSent: () => {},
  });
  assert.equal(result.sent, 1);
  assert.deepEqual(result.failed, [{ name: 'dos.jpg', error: 'La sesión ya tiene 12 fotos.' }]);
});
