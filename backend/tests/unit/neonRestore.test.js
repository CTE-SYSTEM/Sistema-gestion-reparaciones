import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreNeonSnapshot } from '../../src/services/neonSnapshots.js';

test('La restauración de Neon apunta solo a la rama configurada y solicita finalizar el cambio', async () => {
  const keys = ['NEON_API_KEY', 'NEON_PROJECT_ID', 'NEON_BRANCH_ID'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    process.env.NEON_API_KEY = 'token-de-prueba';
    process.env.NEON_PROJECT_ID = 'proyecto-prueba';
    process.env.NEON_BRANCH_ID = 'rama-principal';
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return { ok: true, text: async () => JSON.stringify({ branch: { id: 'rama-restaurada' } }) };
    };
    await assert.rejects(restoreNeonSnapshot({ id: 'snapshot-1', project: 'otro-proyecto', branch: 'rama-principal' }), { status: 409 });
    assert.equal(calls.length, 0);
    await restoreNeonSnapshot({ id: 'snapshot-1', project: 'proyecto-prueba', branch: 'rama-principal' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://console.neon.tech/api/v2/projects/proyecto-prueba/snapshots/snapshot-1/restore');
    assert.deepEqual(JSON.parse(calls[0].options.body), { target_branch_id: 'rama-principal', finalize_restore: true });
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
