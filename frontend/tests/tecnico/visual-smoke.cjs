// Interfaz con datos sintéticos: todas las rutas de API se simulan, sin escribir en el taller.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.CTE_PLAYWRIGHT_PATH || 'playwright');
const output = path.resolve(__dirname, '../../../tmp/tecnico');
const diagnostics = Array.from({ length: 23 }, (_, i) => ({ id_diagnostico: i + 1, equipo: { id_equipo: i + 1, tipo: 'Laptop', marca: 'Prueba', modelo: 'Modelo técnico ' + (i + 1) },
  falla_reportada: 'No enciende', estado_del_diagnostico: 'EN_REVISION', prioridad: 'Normal', fecha_hora: new Date().toISOString(), fecha_asignacion: new Date().toISOString(), fecha_inicio: new Date().toISOString(), detalle_accesorios: 'Cargador', estado_fisico: 'SIN_DANOS_VISIBLES' }));
const orden = { id_orden: 1, diagnostico_id: 1, diagnostico: diagnostics[0], estado: 'EN_REPARACION', prioridad: 'Normal', requiere_piezas: true, fecha_asignacion: new Date().toISOString(), fecha_inicio_reparacion: new Date().toISOString(), repuestos_usados: [], irreparable_estado: 'NO_SOLICITADO' };
const captures = [], failures = [], mutations = [];
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CTE_BROWSER_EXECUTABLE ? { executablePath: process.env.CTE_BROWSER_EXECUTABLE } : {}) });
  try {
    await fs.mkdir(output, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-NI' });
    await context.addInitScript(() => { sessionStorage.setItem('token', 'sesion-sintetica'); sessionStorage.setItem('cte_user', JSON.stringify({ username: 'tecnico_sintetico', rol: 'Tecnico' })); });
    await context.route('**/socket.io/**', (route) => route.abort());
    await context.route('**/api/**', async (route) => {
      const req = route.request(), url = new URL(req.url()), pathname = url.pathname;
      let data = { data: [] };
      if (req.method() !== 'GET') {
        const body = req.postDataJSON(); mutations.push({ pathname, body });
        if (pathname.endsWith('/borrador')) diagnostics[0].borrador_tecnico = body;
        if (/diagnosticos\/\d+$/.test(pathname)) { Object.assign(diagnostics[0], body, { estado_del_diagnostico: 'COMPLETADO', borrador_tecnico: null }); }
        if (pathname.endsWith('/avances')) data = { data: { id_avance: 1, observacion: body.observacion, fecha_hora: new Date().toISOString() } };
      } else if (pathname.endsWith('/resumen')) data = { data: { diagnosticos_activos: 23, ordenes_activas: 1, piezas_pendientes: 1, revision_jefe: 0, esperando_piezas: 0 } };
      else if (pathname.includes('/mis-diagnosticos/')) {
        const p = Number(url.searchParams.get('page') || 1), completed = url.searchParams.get('grupo') === 'completados';
        const rows = diagnostics.filter((d) => completed ? d.estado_del_diagnostico === 'COMPLETADO' : d.estado_del_diagnostico !== 'COMPLETADO');
        data = { data: rows.slice((p - 1) * 20, p * 20), meta: { page: p, total: rows.length, hasMore: p * 20 < rows.length } };
      } else if (pathname.includes('/mis-ordenes/')) data = { data: url.searchParams.get('grupo') === 'completados' ? [] : [orden], meta: { page: 1, total: 1, hasMore: false } };
      else if (pathname.endsWith('/catalogo')) data = { data: [{ id_repuesto: 25, nombre: 'Fuente compatible', descripcion: 'Para portátil', disponible: Number(url.searchParams.get('cantidad') || 1) <= 2 }], meta: { page: 1, total: 1, hasMore: false } };
      else if (pathname.endsWith('/solicitudes')) data = { data: [{ id_detalle_repuesto: 1, orden_id: 1, repuesto_id: 25, pieza_solicitada: 'Fuente compatible', cantidad_usada: 1, estado_aprobacion: 'APROBADO', estado_entrega: 'PENDIENTE', fecha_solicitud: new Date().toISOString() }], meta: { page: 1, total: 1, hasMore: false } };
      else if (/\/tecnicos\/(diagnosticos|ordenes)\/\d+$/.test(pathname)) data = { data: { registro: pathname.includes('/ordenes/') ? orden : diagnostics[0], historial: [], avances: [], asignaciones: [] } };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    const page = await context.newPage(); page.on('pageerror', (err) => failures.push(err.message));
    const shot = async (name, fullPage = true) => { const file = path.join(output, name + '.png'); await page.screenshot({ path: file, fullPage, animations: 'disabled' }); captures.push(file); };
    const go = async (name) => { await page.locator('.jefe-nav').getByRole('button', { name, exact: false }).click(); await page.getByRole('heading', { level: 1, name, exact: true }).waitFor(); };
    await page.goto('http://localhost:5173/tecnico', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: 'Mi trabajo' }).waitFor(); await shot('escritorio-resumen');
    await go('Diagnósticos activos'); await page.getByRole('button', { name: 'Registrar informe' }).first().waitFor();
    assert.equal(await page.locator('tbody tr').count(), 20);
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click(); await page.getByText('23 registros · Página 2').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 3, null, { timeout: 5000 });
    await page.waitForTimeout(350);
    assert.equal(await page.locator('tbody tr').count(), 3, 'La búsqueda inicial no reinicia la segunda página');
    await page.getByRole('button', { name: 'Anterior', exact: true }).click();
    await page.getByRole('button', { name: 'Registrar informe' }).first().click();
    await page.getByText('Guardar borrador', { exact: true }).waitFor();
    await page.locator('textarea').first().fill('Fuente averiada'); await page.locator('textarea').nth(1).fill('Sustituir fuente');
    assert.equal(await page.getByLabel('Moneda del presupuesto').inputValue(), 'NIO');
    await page.getByLabel('Moneda del presupuesto').selectOption('USD'); await page.getByLabel('Presupuesto estimado', { exact: true }).fill('125.50');
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click(); await page.getByText('Borrador guardado. El diagnóstico sigue en revisión.').waitFor();
    const saved = mutations.find((r) => r.pathname.endsWith('/borrador')).body; assert.equal(saved.moneda_presupuesto, 'USD'); assert.equal(Number(saved.presupuesto), 125.50);
    await shot('borrador-diagnostico'); await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('button', { name: 'Ver expediente', exact: true }).first().click();
    await page.getByRole('heading', { name: /Expediente técnico/ }).waitFor(); await page.getByRole('heading', { name: 'Condiciones de recepción' }).waitFor();
    await page.getByText('Presupuesto del borrador: US$ 125.50', { exact: true }).waitFor();
    await shot('expediente-tecnico');
    await page.getByLabel('Registrar avance técnico').fill('Se revisó la alimentación'); await page.getByRole('button', { name: 'Guardar avance', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar expediente' }).click();
    await page.getByRole('button', { name: 'Continuar informe', exact: true }).click();
    assert.equal(await page.getByLabel('Moneda del presupuesto').inputValue(), 'USD');
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByLabel('Moneda del presupuesto').scrollIntoViewIfNeeded(); await shot('movil-presupuesto-usd', false); await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Marcar Completado', exact: true }).click();
    await page.getByLabel('Moneda del presupuesto').waitFor({ state: 'hidden' });
    const completed = mutations.find((r) => /diagnosticos\/\d+$/.test(r.pathname)).body; assert.equal(completed.moneda_presupuesto, 'USD'); assert.equal(Number(completed.presupuesto_estimado), 125.50);
    await go('Diagnósticos completados'); await page.getByRole('button', { name: 'Ver expediente', exact: true }).first().click();
    await page.getByText('Presupuesto técnico: US$ 125.50', { exact: true }).waitFor(); await shot('informe-presupuesto-usd'); await page.getByRole('button', { name: 'Cerrar expediente' }).click();
    await go('Reparaciones activas'); await page.getByRole('button', { name: 'Finalizar y registrar pruebas' }).click();
    const encendido = page.getByLabel('Encendido al finalizar'); assert.equal(await encendido.inputValue(), '');
    await page.getByRole('button', { name: 'Guardar Finalizacion' }).click();
    assert.equal(await encendido.evaluate((el) => el.validity.valueMissing), true);
    await shot('pruebas-salida'); await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Solicitar pieza', exact: true }).click();
    await page.getByRole('button', { name: /Fuente compatible/ }).waitFor(); await page.getByRole('button', { name: /Fuente compatible/ }).click();
    await page.getByLabel('Cantidad', { exact: true }).fill('3');
    await page.getByText('Cantidad no disponible', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).isDisabled(), true);
    await page.getByLabel('Cantidad', { exact: true }).fill('2');
    await page.getByText('Disponible para la cantidad indicada', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Fuente compatible/ }).click();
    await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
    await go('Solicitudes de piezas'); await page.getByText('Pendiente de entrega', { exact: true }).waitFor(); await shot('seguimiento-piezas');
    await go('Diagnósticos completados'); await go('Reparaciones cerradas');
    await go('Diagnósticos activos'); await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await shot('tema-oscuro');
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Abrir navegación' }).click(); await shot('movil-navegacion'); await go('Mi trabajo');
    await page.waitForFunction(() => !document.querySelector('.jefe-sidebar')?.classList.contains('open'));
    await shot('movil-resumen');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2), false);
    assert.ok(mutations.some((r) => r.pathname.endsWith('/borrador'))); assert.ok(mutations.some((r) => r.pathname.endsWith('/avances')));
    assert.equal(failures.length, 0, failures.join('\n'));
    console.log(JSON.stringify({ passed: true, captures: captures.length, syntheticMutations: mutations.length, errors: failures }, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
