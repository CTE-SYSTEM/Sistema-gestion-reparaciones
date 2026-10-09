import test from 'node:test';
import assert from 'node:assert/strict';
import { isR2Key, PHOTO_STORAGE_STAGES, r2EquipmentFolderFromKey, r2ServiceKey } from '../../src/services/archivos/fotoStorage.js';

const equipo = { id_equipo: 42, tipo: 'Monitor', marca: 'Sámsung', modelo: 'Odyssey / G5' };

test('cada tipo de foto queda dentro del equipo descriptivo y su etapa', () => {
  for (const [tipoArchivo, { folder, kind }] of Object.entries(PHOTO_STORAGE_STAGES)) {
    const key = r2ServiceKey({ kind, serviceId: 18, equipo, tipoArchivo, ext: '.jpg' });
    assert.ok(key.startsWith(`fotos/equipos/monitor-samsung-odyssey-g5-equipo-42/${folder}/${kind}-18-`));
    assert.match(key, /\d{2}-\d{2}-\d{2}_\d{2}-\d{2}-[0-9a-f]{8}\.jpg$/);
    assert.equal(key.split('/').length, 5);
    assert.ok(isR2Key(key));
    assert.ok(!key.startsWith('r2/') && !key.startsWith('servicios/'));
  }
});

test('mantiene las visitas en la misma carpeta y distingue sus fotos sin sobrescribir', () => {
  const params = { kind: 'diagnostico', equipo, tipoArchivo: 'FOTO_RECEPCION', ext: '.png' };
  const first = r2ServiceKey({ ...params, serviceId: 18 });
  const second = r2ServiceKey({ ...params, serviceId: 19 });
  assert.ok(first.startsWith('fotos/equipos/monitor-samsung-odyssey-g5-equipo-42/recepcion/diagnostico-18-'));
  assert.ok(second.startsWith('fotos/equipos/monitor-samsung-odyssey-g5-equipo-42/recepcion/diagnostico-19-'));
  assert.equal(r2EquipmentFolderFromKey(first), r2EquipmentFolderFromKey(second));
  assert.notEqual(first, r2ServiceKey({ ...params, serviceId: 18 }));
});

test('reutiliza la carpeta del equipo cuando se corrige su descripción o cambia de etapa', () => {
  const existingKey = r2ServiceKey({ kind: 'diagnostico', serviceId: 18, equipo, tipoArchivo: 'FOTO_RECEPCION', ext: '.png' });
  const corrected = { ...equipo, tipo: 'Pantalla', marca: 'Samsung', modelo: 'Odyssey G7' };
  const key = r2ServiceKey({ kind: 'orden', serviceId: 19, equipo: corrected, tipoArchivo: 'FOTO_REPARACION', ext: '.jpg', existingKey });
  assert.ok(key.startsWith('fotos/equipos/monitor-samsung-odyssey-g5-equipo-42/reparacion/orden-19-'));
  assert.equal(r2EquipmentFolderFromKey(key, 42), r2EquipmentFolderFromKey(existingKey, 42));
  assert.equal(r2EquipmentFolderFromKey(key, 43), null);
});

test('usa DD-MM-AA y HH-mm de Nicaragua y distingue fotos subidas en el mismo minuto', () => {
  const params = { kind: 'diagnostico', serviceId: 27, equipo, tipoArchivo: 'FOTO_RECEPCION', ext: '.jpg', uploadedAt: new Date('2026-09-28T02:03:04.123Z') };
  const first = r2ServiceKey(params);
  assert.match(first, /\/diagnostico-27-27-09-26_20-03-[0-9a-f]{8}\.jpg$/);
  assert.ok(isR2Key(first));
  assert.notEqual(first, r2ServiceKey(params));
  const midnight = r2ServiceKey({ ...params, uploadedAt: new Date('2026-09-27T06:00:00.000Z') });
  assert.match(midnight, /-27-09-26_00-00-[0-9a-f]{8}\.jpg$/);
  assert.throws(() => r2ServiceKey({ ...params, uploadedAt: new Date('inválida') }), /Fecha de subida inválida/);
});

test('sigue leyendo los dos formatos anteriores y reutiliza su carpeta para los nombres nuevos', () => {
  const existingKeys = [
    'celular/samsung-galaxy-a32-equipo-21/recepcion/diagnostico-27-1203d4dd-02ea-431f-8bd7-d0d2eb72897a.jpg',
    'celular/samsung-galaxy-a32-equipo-21/recepcion/diagnostico-27-2026-09-27_18-01-44-055-96376409.png',
  ];
  for (const existingKey of existingKeys) {
    assert.ok(isR2Key(existingKey));
    assert.equal(r2EquipmentFolderFromKey(existingKey, 21), 'celular/samsung-galaxy-a32-equipo-21');
    const key = r2ServiceKey({ kind: 'diagnostico', serviceId: 27, equipo: { id_equipo: 21, tipo: 'Teléfono', marca: 'Samsung', modelo: 'Galaxy A32' }, tipoArchivo: 'FOTO_DIAGNOSTICO', ext: '.jpg', existingKey });
    assert.ok(key.startsWith('fotos/equipos/celular-samsung-galaxy-a32-equipo-21/diagnostico/diagnostico-27-'));
  }
});

test('equipos idénticos tienen carpetas distintas y no reutilizan la carpeta de otro', () => {
  const params = { kind: 'diagnostico', serviceId: 18, equipo, tipoArchivo: 'FOTO_RECEPCION', ext: '.jpg' };
  const first = r2ServiceKey(params);
  const second = r2ServiceKey({ ...params, equipo: { ...equipo, id_equipo: 43 }, existingKey: first });
  assert.ok(second.startsWith('fotos/equipos/monitor-samsung-odyssey-g5-equipo-43/recepcion/'));
  assert.notEqual(r2EquipmentFolderFromKey(first), r2EquipmentFolderFromKey(second));
});

test('normaliza nombres largos, caracteres de ruta y datos no especificados', () => {
  const params = { kind: 'diagnostico', serviceId: 18, tipoArchivo: 'FOTO_RECEPCION', ext: '.jpg' };
  const key = r2ServiceKey({ ...params, equipo: { id_equipo: 42, tipo: '../', marca: 'a'.repeat(47) + '/otra', modelo: null } });
  assert.ok(key.startsWith(`fotos/equipos/sin-tipo-${'a'.repeat(47)}-sin-modelo-equipo-42/recepcion/`));
  assert.ok(isR2Key(key));
  assert.equal(r2EquipmentFolderFromKey(`../${key}`), null);
});

test('rechaza una etapa que no pertenece al diagnóstico u orden', () => {
  assert.throws(() => r2ServiceKey({ kind: 'orden', serviceId: 18, equipo, tipoArchivo: 'FOTO_RECEPCION', ext: '.jpg' }));
  assert.throws(() => r2ServiceKey({ kind: 'diagnostico', serviceId: 18, equipo, tipoArchivo: 'DESCONOCIDA', ext: '.jpg' }));
  assert.throws(() => r2ServiceKey({ kind: 'diagnostico', serviceId: 0, equipo, tipoArchivo: 'FOTO_RECEPCION', ext: '.jpg' }));
  assert.throws(() => r2ServiceKey({ kind: 'diagnostico', serviceId: 18, equipo, tipoArchivo: 'FOTO_RECEPCION', ext: '../archivo' }));
});

test('distingue las claves nuevas y antiguas de las fotos locales', () => {
  assert.ok(isR2Key('r2/servicios/equipos/equipo-42/ingresos/foto.jpg'));
  assert.ok(isR2Key('entrega/orden-18/equipo-42-foto.jpg'));
  assert.equal(isR2Key('foto-local.jpg'), false);
  assert.equal(isR2Key('recepcion.jpg'), false);
  assert.equal(isR2Key(null), false);
});
