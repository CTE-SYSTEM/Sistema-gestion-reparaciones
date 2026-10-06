const assert = require('node:assert/strict');
const { chromium } = require(process.env.CTE_PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CTE_BROWSER_EXECUTABLE ? { executablePath: process.env.CTE_BROWSER_EXECUTABLE } : {}) });
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => { sessionStorage.setItem('token', 'sesion-sintetica'); sessionStorage.setItem('cte_user', JSON.stringify({ username: 'secretaria_sintetica', rol: 'Secretaria' })); });
    let notices = [{ id: '11111111-2222-3333-4444-555555555555', timestamp: new Date().toISOString(), title: 'Informe recibido durante la ausencia',
      message: 'El diagnóstico #42 está listo.', type: 'diagnostico_completado', entity: { kind: 'diagnostico', id: 42 } }];
    const mutations = [], errors = [];
    await context.route('**/socket.io/**', (route) => route.abort());
    await context.route('**/api/**', async (route) => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      if (request.method() !== 'GET') {
        assert.equal(pathname, '/api/notificaciones/leidas'); mutations.push(request.postDataJSON()); notices = [];
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: pathname === '/api/notificaciones' ? notices : [], meta: { page: 1, total: 0, hasMore: false } }) });
    });
    const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://localhost:5173/secretaria/clientes', { waitUntil: 'domcontentloaded' });
    const bell = page.getByRole('button', { name: 'Abrir notificaciones', exact: true }); await bell.waitFor();
    await bell.click(); await page.getByText('Informe recibido durante la ausencia', { exact: true }).waitFor();
    await page.reload(); await bell.click(); await page.getByText('Informe recibido durante la ausencia', { exact: true }).waitFor();
    assert.equal(await page.getByText('Informe recibido durante la ausencia', { exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
    await page.getByText('Informe recibido durante la ausencia', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(mutations.length, 1); assert.deepEqual(mutations[0].ids, ['11111111-2222-3333-4444-555555555555']);
    await page.reload(); await bell.click(); await page.getByText('Sin eventos recientes.', { exact: true }).waitFor();
    assert.deepEqual(errors, []); console.log(JSON.stringify({ passed: true, offlineHistory: 'recovered', reload: 'preserved', readReceipt: 'preserved', realWrites: 0 }));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
