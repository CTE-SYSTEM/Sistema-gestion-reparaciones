import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ADMIN_SETTINGS, validateSettings, validateNewPassword, redactAuditData } from '../../src/utils/adminPolicy.js';
import { nextBackupDate, validateBackupLocation } from '../../src/utils/backupSchedule.js';
import { dateRange, positiveId } from '../../src/utils/adminFilters.js';

test('La configuración parcial conserva los demás valores y no muta los originales', () => {
  const values = validateSettings({ negocio: { garantia_meses: 6 }, reglas: { password_minimo: 12 } });
  assert.equal(values.negocio.garantia_meses, 6); assert.equal(values.reglas.password_minimo, 12);
  assert.deepEqual(values.respaldos, DEFAULT_ADMIN_SETTINGS.respaldos);
  assert.equal(DEFAULT_ADMIN_SETTINGS.negocio.garantia_meses, 3);
});
test('Se rechazan parámetros desconocidos, coerciones y horarios imposibles', () => {
  for (const values of [{ roles: {} }, { negocio: { password: 'clave' } }, { reglas: { password_minimo: 4 } },
    { negocio: { garantia_meses: '6' } }, { respaldos: { habilitado: 'false' } }, { respaldos: { hora: '24:00' } },
    { respaldos: { dia_mes: 31 } }, { negocio: { margen_repuesto_porcentaje: -1 } }]) {
    assert.throws(() => validateSettings(values), { status: 400 });
  }
});

test('El administrador configura plazo y disponibilidad de correcciones excepcionales', () => {
  const values = validateSettings({ reglas: { correccion_cierre_horas: 48, correccion_excepcional_habilitada: false } });
  assert.equal(values.reglas.correccion_cierre_horas, 48);
  assert.equal(values.reglas.correccion_excepcional_habilitada, false);
  assert.throws(() => validateSettings({ reglas: { correccion_cierre_horas: 0 } }), { status: 400 });
  assert.throws(() => validateSettings({ reglas: { correccion_excepcional_habilitada: 'false' } }), { status: 400 });
});
test('Contraseñas cumplen el mínimo configurado y el límite real de bcrypt', () => {
  assert.throws(() => validateNewPassword('1234'), { status: 400 });
  assert.throws(() => validateNewPassword('        '), { status: 400 });
  assert.throws(() => validateNewPassword('abcdefgh', 12), { status: 400 });
  assert.throws(() => validateNewPassword('á'.repeat(37)), { status: 400 });
  assert.equal(validateNewPassword('á'.repeat(36)), 'á'.repeat(36));
});
test('Auditoría elimina contraseñas, hashes y tokens incluso en estructuras antiguas', () => {
  assert.deepEqual(redactAuditData({ nombre: 'Ana', contrasena_hash: 'hash', detalles: [{ password: 'x', token: 'x', correo: 'a@example.test' }] }),
    { nombre: 'Ana', detalles: [{ correo: 'a@example.test' }] });
});
test('Programación usa la fecha de Nicaragua y cruza días, semanas y años', () => {
  const base = { ...DEFAULT_ADMIN_SETTINGS.respaldos };
  assert.equal(nextBackupDate(base, new Date('2026-12-31T23:30:00Z')).toISOString(), '2027-01-01T08:00:00.000Z');
  assert.equal(nextBackupDate({ ...base, frecuencia: 'diaria' }, new Date('2026-09-29T03:00:00Z')).toISOString(), '2026-09-29T08:00:00.000Z');
  assert.equal(nextBackupDate({ ...base, frecuencia: 'diaria' }, new Date('2026-09-29T08:00:00Z')).toISOString(), '2026-09-30T08:00:00.000Z');
  assert.equal(nextBackupDate({ ...base, frecuencia: 'semanal', dia_semana: 1 }, new Date('2026-09-29T10:00:00Z')).toISOString(), '2026-10-05T08:00:00.000Z');
  assert.equal(nextBackupDate({ ...base, habilitado: false }), null);
});
test('Fechas incluyen el día final en Nicaragua y rechazan intervalos inválidos', () => {
  const range = dateRange({ fecha_inicio: '2026-09-29', fecha_fin: '2026-09-29' });
  assert.equal(range.where.gte.toISOString(), '2026-09-29T06:00:00.000Z');
  assert.equal(range.where.lt.toISOString(), '2026-09-30T06:00:00.000Z');
  assert.throws(() => dateRange({ fecha_inicio: '2026-02-30' }), { status: 400 });
  assert.throws(() => dateRange({ fecha_inicio: '2026-10-01', fecha_fin: '2026-09-29' }), { status: 400 });
});
test('Identificadores y rutas impiden accesos ambiguos y salir del directorio', () => {
  for (const value of ['1 OR 1=1', '-1', '1.2', '9007199254740992']) assert.throws(() => positiveId(value, 'ID', false), { status: 400 });
  for (const [month, file] of [['2026-13', 'copy.dump'], ['2026-09', '../copy.dump'], ['2026-09', 'C:\\copy.dump'], ['2026-09', 'x/secret']]) assert.throws(() => validateBackupLocation(month, file), { status: 400 });
  validateBackupLocation('2026-09', 'db_dump_123.dump');
});
