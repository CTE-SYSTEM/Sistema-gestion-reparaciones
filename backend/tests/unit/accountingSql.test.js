import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { Prisma } from '@prisma/client';
import prisma from '../../src/app/prismaClient.js';
import { getAccountingSummary, getAccountingActivity, getCurrentReceivables } from '../../src/services/contabilidadService.js';

// Prueba optativa contra PostgreSQL local. Solo crea tablas temporales dentro de
// una transacción que se revierte; nunca lee ni modifica registros del taller.
test('caja, cartera, filtros y paginación concilian en PostgreSQL', { skip: process.env.ACCOUNTING_SQL_TEST !== '1' }, async () => {
  const container = JSON.parse(execFileSync('docker', ['inspect', 'postgres_cte'], { encoding: 'utf8' }))[0];
  const env = Object.fromEntries(container.Config.Env.map(value => { const i=value.indexOf('='); return [value.slice(0,i),value.slice(i+1)]; }));
  const client = new pg.Client({ host: '127.0.0.1', port: 5432, user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, database: env.POSTGRES_DB });
  const originalQuery = prisma.$queryRaw, originalTransaction = prisma.$transaction;
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await client.query(`
      CREATE TEMP TABLE "Usuarios" (id_usuario int PRIMARY KEY,nombre_persona text,nombre_usuario text);
      CREATE TEMP TABLE "MovimientosContables" (id_movimiento int PRIMARY KEY,fecha_registro timestamp,tipo text,monto numeric,metodo text,referencia text,motivo text,factura_id int,reclamo_id int,usuario_id int);
      CREATE TEMP TABLE "Compras" (id_compra int PRIMARY KEY,fecha_obtencion timestamp,cantidad int,costo_unitario numeric,metodo_pago text,documento text);
      CREATE TEMP TABLE "Facturas" (id_factura int PRIMARY KEY,fecha_emision timestamp,total numeric,metodo_pago text,orden_id int,diagnostico_id int);
      CREATE TEMP TABLE "Ordenes" (id_orden int PRIMARY KEY,diagnostico_id int);
      CREATE TEMP TABLE "Diagnosticos" (id_diagnostico int PRIMARY KEY,equipo_id int);
      CREATE TEMP TABLE "Equipos" (id_equipo int PRIMARY KEY,cliente_id int);
      CREATE TEMP TABLE "Clientes" (id_cliente int PRIMARY KEY,nombre text);
      INSERT INTO "Usuarios" VALUES (1,'Contadora de prueba','cuenta_prueba');
      INSERT INTO "Clientes" VALUES (1,'Cliente de prueba');
      INSERT INTO "Equipos" VALUES (1,1);
      INSERT INTO "Diagnosticos" VALUES (1,1);
      INSERT INTO "Facturas" VALUES (1,'2025-12-20 12:00',500,'Pendiente',NULL,1),(2,'2026-01-12 12:00',1000,'Pendiente',NULL,1),(3,'2026-01-11 12:00',400,'Efectivo',NULL,1),(4,'2026-01-10 12:00',300,'Efectivo',NULL,1);
      INSERT INTO "MovimientosContables" VALUES
        (1,'2026-01-10 12:00','COBRO',300,'Efectivo',NULL,'Cobro registrado al emitir la factura',4,NULL,1),
        (2,'2026-01-13 12:00','COBRO',200,'Transferencia',NULL,'Abono',2,NULL,1),
        (3,'2026-01-13 13:00','OTRO_INGRESO',50,'Efectivo',NULL,'Ingreso adicional',NULL,NULL,1),
        (4,'2026-01-14 12:00','GASTO_OPERATIVO',80,'Efectivo',NULL,'Gasto de prueba',NULL,NULL,1),
        (5,'2026-02-01 12:00','DEVOLUCION',20,'Efectivo',NULL,'Devolución de prueba',3,NULL,1),
        (6,'2026-02-02 12:00','COSTO_RECLAMO',30,NULL,NULL,'Reclamo de prueba',NULL,1,1),
        (7,'2026-01-01 05:59','OTRO_INGRESO',9,'Efectivo',NULL,'Último minuto del año anterior',NULL,NULL,1);
      INSERT INTO "Compras" VALUES (1,'2026-02-03 12:00',2,60,'Tarjeta','Compra pagada de prueba'),(2,'2026-02-04 12:00',1,40,NULL,'Sin pago documentado');
    `);
    const query = async (strings, ...values) => {
      const sql = Array.isArray(strings) ? Prisma.sql(strings, ...values) : strings;
      return (await client.query(sql.text, sql.values)).rows;
    };
    prisma.$queryRaw = query;
    prisma.$transaction = callback => callback({ $queryRaw: query });
    const summary = await getAccountingSummary({ anio: 2026 });
    assert.equal(summary.totals.ingresos, 950);
    assert.equal(summary.totals.egresos, 250);
    assert.equal(summary.totals.neto, 700);
    assert.equal(summary.totals.facturado, 1700);
    assert.equal(summary.totals.cartera_total, 1320);
    assert.equal(summary.totals.por_cobrar, 820);
    assert.equal(summary.totals.facturas_pendientes, 3);
    assert.equal(summary.totals.compras_sin_pago, 40);
    assert.equal(summary.months[0].neto, 870);
    assert.equal(summary.months[1].acumulado, 700);
    const first = await getAccountingActivity({ anio: 2026, pageSize: 3 });
    const second = await getAccountingActivity({ anio: 2026, pageSize: 3, page: 2 });
    const all = await getAccountingActivity({ anio: 2026, pageSize: 3, page: 2 }, { complete: true });
    assert.equal(first.meta.total, 8);
    assert.equal(first.data.length, 3);
    assert.equal(second.data.length, 3);
    assert.ok(first.data.every(row => !second.data.some(other => other.id === row.id)));
    assert.equal(all.data.length, 8);
    assert.deepEqual(first.summary, second.summary);
    assert.equal(all.summary.neto, summary.totals.neto);
    assert.equal((await getAccountingActivity({ anio: 2026, tipo: 'COMPRA' })).summary.egresos, 120);
    assert.equal((await getAccountingActivity({ anio: 2026, metodo: 'SIN_METODO' })).meta.total, 1);
    assert.equal((await getAccountingActivity({ anio: 2026, factura_id: 2 })).summary.ingresos, 200);
    assert.equal((await getAccountingActivity({ anio: 2025 })).summary.ingresos, 9);
    const cartera = await getCurrentReceivables();
    assert.equal(cartera.reduce((sum,row) => sum+row.pendiente,0), 1320);
    assert.ok(cartera.some(row => row.fecha_emision.getUTCFullYear() === 2025));
  } finally {
    prisma.$queryRaw = originalQuery;
    prisma.$transaction = originalTransaction;
    await client.query('ROLLBACK');
    await client.end();
    await prisma.$disconnect();
  }
});
