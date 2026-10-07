import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../../index.js';

test('La entrada de Vercel sirve la API y protege el cron de respaldos', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.equal((await home.json()).name, 'SGR Backend');
    const cron = await fetch(`${base}/api/internal/backup-schedule`);
    assert.equal(cron.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
