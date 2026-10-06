// Verifica importes y aprobación con API simulada, sin modificar datos del taller.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CTE_PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CTE_BROWSER_EXECUTABLE ? { executablePath: process.env.CTE_BROWSER_EXECUTABLE } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-NI' });
    await context.addInitScript(() => { sessionStorage.setItem('token', 'sesion-sintetica'); sessionStorage.setItem('cte_user', JSON.stringify({ username: 'secretaria_sintetica', rol: 'Secretaria' })); });
    const orders = [], errors = [];
    const diagnostics = ['USD', 'NIO'].map((moneda, i) => ({ id_diagnostico: i + 1, estado_del_diagnostico: 'COMPLETADO', estado_contacto: 'DOCUMENTO_ENVIADO',
      diagnostico_real: 'Fuente averiada', falla_reportada: 'No enciende', presupuesto_estimado: i === 0 ? 125.50 : 500, moneda_presupuesto: moneda,
      equipo: { id_equipo: i + 1, marca: 'Prueba', modelo: moneda, cliente: { id_cliente: i + 1, nombre: 'Cliente sintético', telefono: '80000000' } } }));
    await context.route('**/socket.io/**', (route) => route.abort());
    await context.route('**/api/**', async (route) => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      if (request.method() !== 'GET') { assert.equal(pathname, '/api/ordenes'); orders.push(request.postDataJSON()); }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: pathname.endsWith('/diagnosticos-listos') ? diagnostics : [], meta: { page: 1, total: 2, hasMore: false } }) });
    });
    const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message)); page.on('dialog', (dialog) => dialog.accept());
    await page.goto('http://localhost:5173/secretaria/nueva-orden', { waitUntil: 'domcontentloaded' });
    await page.getByText('Presupuesto: US$ 125.50', { exact: true }).waitFor(); await page.getByText('Presupuesto: C$ 500.00', { exact: true }).waitFor();
    const amounts = page.getByLabel(/Monto autorizado \(C\$\)/);
    assert.equal(await amounts.nth(0).inputValue(), '', 'USD no se copia como monto autorizado en córdobas');
    assert.equal(await amounts.nth(1).inputValue(), '500', 'NIO mantiene la precarga existente');
    await page.getByRole('button', { name: 'Aprobar y Crear Orden', exact: true }).first().click();
    await page.getByText('Indica el monto autorizado en córdobas, mayor que cero.', { exact: true }).waitFor(); assert.equal(orders.length, 0);
    await amounts.nth(0).fill('4500');
    await Promise.all([page.waitForResponse((response) => new URL(response.url()).pathname === '/api/ordenes' && response.request().method() === 'POST'), page.getByRole('button', { name: 'Aprobar y Crear Orden', exact: true }).first().click()]);
    assert.equal(orders.length, 1); assert.equal(orders[0].monto_autorizado, 4500); assert.equal(orders[0].diagnostico_id, 1);
    assert.deepEqual(errors, []); console.log(JSON.stringify({ passed: true, currencies: ['NIO', 'USD'], authorizedAmount: 4500, realWrites: 0 }));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
