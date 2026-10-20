import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../../src/app/prismaClient.js';
import { getMyAccount, updateMyAccount } from '../../src/controllers/admin_pro/administracionController.js';

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('Mi cuenta consulta al usuario autenticado y devuelve su identidad y perfil técnico sin credenciales', async () => {
  const originalFind = prisma.usuarios.findUnique, originalQuery = prisma.$queryRaw;
  let lookup;
  try {
    prisma.usuarios.findUnique = async (query) => {
      lookup = query;
      return { id_usuario: 7, nombre_usuario: 'tecnico_prueba', nombre_persona: null,
        contrasena_hash: 'dato-privado', sesion_version: 2, correo_electronico: 'prueba@example.test', rol: 'Tecnico', activo: true,
        tecnico: { id_tecnico: 4, nombre: 'Nombre técnico registrado', especialidad: 'Microelectrónica', horario: '08:00–17:00', contacto: 'Contacto interno', disponibilidad: 'DISPONIBLE' } };
    };
    prisma.$queryRaw = async () => [];
    const res = response();
    await getMyAccount({ user: { id: 7 }, query: { id: 99 } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(lookup.where, { id_usuario: 7 });
    assert.equal(lookup.include.tecnico.select.especialidad, true);
    assert.equal(res.body.data.nombre_mostrado, 'Nombre técnico registrado');
    assert.equal(res.body.data.tecnico.especialidad, 'Microelectrónica');
    assert.equal(res.body.data.correo_electronico, 'prueba@example.test');
    assert.equal('contrasena_hash' in res.body.data, false);
    assert.equal('sesion_version' in res.body.data, false);
  } finally { prisma.usuarios.findUnique = originalFind; prisma.$queryRaw = originalQuery; }
});

test('Mi cuenta responde 404 si la cuenta ya no existe', async () => {
  const originalFind = prisma.usuarios.findUnique;
  try {
    prisma.usuarios.findUnique = async () => null;
    const res = response();
    await getMyAccount({ user: { id: 7 } }, res);
    assert.equal(res.statusCode, 404);
  } finally { prisma.usuarios.findUnique = originalFind; }
});

test('cambiar el nombre propio actualiza el técnico vinculado sin cambiar su especialidad', async () => {
  const originalTransaction = prisma.$transaction;
  const hash = await bcrypt.hash('contraseña-de-prueba', 4);
  let technicianUpdate;
  const updated = { id_usuario: 7, nombre_usuario: 'tecnico_prueba', nombre_persona: 'Nombre actualizado', correo_electronico: 'prueba@example.test', rol: 'Tecnico', activo: true };
  try {
    prisma.$transaction = async (callback) => callback({
      $queryRaw: async () => [],
      usuarios: {
        findUnique: async () => ({ ...updated, contrasena_hash: hash }),
        update: async () => updated,
      },
      tecnicos: {
        updateMany: async (query) => { technicianUpdate = query; return { count: 1 }; },
        findUnique: async () => ({ id_tecnico: 4, nombre: 'Nombre actualizado', especialidad: 'Microelectrónica' }),
      },
    });
    const res = response();
    await updateMyAccount({ user: { id: 7 }, body: { ...updated, password_actual: 'contraseña-de-prueba' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(technicianUpdate, { where: { usuario_id: 7 }, data: { nombre: 'Nombre actualizado' } });
    assert.equal(res.body.data.nombre_mostrado, 'Nombre actualizado');
    assert.equal(res.body.data.tecnico.especialidad, 'Microelectrónica');
  } finally { prisma.$transaction = originalTransaction; }
});

test('guardar el correo no sustituye un nombre técnico existente por el usuario de acceso', async () => {
  const originalTransaction = prisma.$transaction;
  const hash = await bcrypt.hash('contraseña-de-prueba', 4);
  let nameWrites = 0;
  try {
    prisma.$transaction = async (callback) => callback({
      $queryRaw: async () => [],
      usuarios: {
        findUnique: async () => ({ contrasena_hash: hash }),
        update: async () => ({ id_usuario: 7, rol: 'Tecnico', nombre_usuario: 'tecnico_prueba', nombre_persona: null }),
      },
      tecnicos: {
        updateMany: async () => { nameWrites += 1; },
        findUnique: async () => ({ nombre: 'Nombre técnico registrado', especialidad: 'Microelectrónica' }),
      },
    });
    const res = response();
    await updateMyAccount({ user: { id: 7 }, body: { nombre_usuario: 'tecnico_prueba', nombre_persona: '', correo_electronico: 'nuevo@example.test', password_actual: 'contraseña-de-prueba' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(nameWrites, 0);
    assert.equal(res.body.data.nombre_mostrado, 'Nombre técnico registrado');
  } finally { prisma.$transaction = originalTransaction; }
});
