// Interfaz con API y sesión sintéticas: no escribe en el taller ni en R2.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.CTE_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.CTE_VISUAL_URL || 'http://localhost:5173';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname));
const output = path.resolve(__dirname, '../../../tmp/jefe-correcciones');
const now = new Date().toISOString(), captures = [], mutations = [], errors = [];
const techs = [1, 2].map((id) => ({ id_tecnico: id, nombre: 'Técnico ' + id, disponibilidad: 'DISPONIBLE', diagnosticos_activos: 0, ordenes_activas: 1, atrasados: 0 }));
const work = { key: 'orden-1', tipo: 'orden', id: 1, equipo_nombre: 'Laptop de prueba', cliente_nombre: 'Cliente sintético', tecnico: techs[0], estado: 'EN_REPARACION', prioridad: 'Normal', activo: true, puede_intervenir: true, ultimo_avance: now, horas_sin_avance: 0 };
const pieces = [
  [1, 'Fuente reservada', 'APROBADO', 'PENDIENTE', 2], [2, 'Cable rechazado', 'DENEGADO', 'PENDIENTE', 1],
  [3, 'Fuente con entrega errónea', 'APROBADO', 'ENTREGADO', 1], [4, 'Cable para devolver', 'APROBADO', 'ENTREGADO', 2],
  [5, 'Cable pendiente', 'PENDIENTE', 'PENDIENTE', 1],
].map(([id, name, approval, delivery, qty]) => ({ id_detalle_repuesto: id, orden_id: 1, repuesto_id: id, pieza_solicitada: name, repuesto: { id_repuesto: id, nombre: name }, cantidad_usada: qty,
  estado_aprobacion: approval, estado_entrega: delivery, fecha_solicitud: now, fecha_aprobacion: approval === 'APROBADO' ? now : null, fecha_entrega: delivery === 'ENTREGADO' ? now : null,
  tecnico_solicitante: techs[0], usuario_aprobador: approval === 'APROBADO' ? { nombre_usuario: 'jefe_sintetico' } : null }));
const data = { trabajos: [work], tecnicos: techs, repuestos: pieces, catalogo: pieces.map((p) => ({ ...p.repuesto, stock_disponible: 10 })), intervenciones: [], indicadores: {} };
const flags = (p) => Object.assign(p, { puede_revisar: p.estado_aprobacion === 'PENDIENTE', puede_entregar: p.estado_aprobacion === 'APROBADO' && p.estado_entrega === 'PENDIENTE',
  puede_corregir: p.estado_aprobacion !== 'DENEGADO' && p.estado_entrega === 'PENDIENTE', puede_retirar_aprobacion: p.estado_aprobacion === 'APROBADO' && p.estado_entrega === 'PENDIENTE',
  puede_reabrir: p.estado_aprobacion === 'DENEGADO', puede_corregir_entrega: p.estado_entrega === 'ENTREGADO', puede_devolver: p.estado_entrega === 'ENTREGADO' });
const types = { 'retirar-aprobacion': 'RETIRAR_APROBACION', reabrir: 'REABRIR_SOLICITUD', 'corregir-entrega': 'CORREGIR_ENTREGA', devolver: 'DEVOLUCION_REPUESTO', corregir: 'CORRECCION_REPUESTO' };
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CTE_BROWSER_EXECUTABLE ? { executablePath: process.env.CTE_BROWSER_EXECUTABLE } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-NI', reducedMotion: 'reduce' });
    await context.addInitScript(() => { sessionStorage.setItem('token', 'sesion-sintetica'); sessionStorage.setItem('cte_user', JSON.stringify({ username: 'jefe_sintetico', rol: 'TecnicoJefe' })); });
    await context.route('**/socket.io/**', (route) => route.abort());
    await context.route('**/api/**', async (route) => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      let response;
      if (request.method() === 'GET' && pathname === '/api/jefe-tecnico/resumen') { pieces.forEach(flags); response = { data }; }
      else if (request.method() === 'GET' && pathname === '/api/jefe-tecnico/ordenes/1') response = { data: { registro: { repuestos_usados: pieces }, intervenciones: data.intervenciones, historial_estados: [], asignaciones: [] } };
      else if (request.method() !== 'GET') {
        const body = request.postDataJSON(); mutations.push({ pathname, body });
        const partMatch = pathname.match(/^\/api\/jefe-tecnico\/repuestos\/(\d+)\/([^/]+)$/);
        if (partMatch) {
          const p = pieces.find((p) => p.id_detalle_repuesto === Number(partMatch[1])), action = partMatch[2];
          assert.ok(types[action], 'Solo se simulan las acciones de corrección declaradas');
          const old = structuredClone(p);
          if (action !== 'corregir' && action !== 'corregir-entrega') {
            p.estado_aprobacion = 'PENDIENTE'; p.fecha_aprobacion = null; p.usuario_aprobador = null;
          }
          if (action === 'corregir') p.cantidad_usada = Number(body.cantidad_usada);
          else { p.estado_entrega = 'PENDIENTE'; p.fecha_entrega = null; }
          data.intervenciones.unshift({ id_intervencion: data.intervenciones.length + 1, orden_id: 1, tipo: types[action], motivo: body.motivo, fecha_hora: now, usuario: { nombre_usuario: 'jefe_sintetico' }, datos_anteriores: old, datos_nuevos: structuredClone(p) });
          response = { data: p, message: 'Corrección registrada' };
        } else {
          assert.equal(pathname, '/api/jefe-tecnico/ordenes/1/intervencion'); assert.equal(body.tipo, 'REASIGNACION');
          work.tecnico = techs[1]; response = { data: work, message: 'Asignación corregida' };
        }
      } else throw new Error('Consulta inesperada: ' + pathname);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
    const shot = async (name) => { const file = path.join(output, name + '.png'); await page.screenshot({ path: file, animations: 'disabled' }); captures.push(file); };
    const go = async (name) => { await page.locator('.jefe-nav').getByRole('button', { name, exact: true }).click(); await page.getByRole('heading', { level: 1, name, exact: true }).waitFor(); };
    const row = (id) => page.locator('tbody tr').filter({ has: page.locator('.jefe-reference', { hasText: new RegExp('^#' + id + '$') }) });
    await page.goto(base + '/tecnico-jefe', { waitUntil: 'domcontentloaded' }); await go('Repuestos');
    await page.getByLabel('Filtrar solicitudes de repuestos').selectOption(''); await shot('acciones-repuestos');
    for (const [id, action, title, check] of [
      [1, 'retirar-aprobacion', 'Retirar aprobación'], [2, 'reabrir', 'Devolver a revisión'],
      [3, 'corregir-entrega', 'Corregir entrega', 'Confirmo que la pieza nunca fue entregada físicamente al técnico.'],
      [4, 'devolver', 'Registrar devolución', 'Confirmo que recibí todas las unidades y están en condiciones de volver al almacén.'],
      [5, 'corregir', 'Corregir pieza/cantidad'],
    ]) {
      await row(id).getByRole('button', { name: title, exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.waitFor();
      const before = mutations.length;
      await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click(); assert.equal(mutations.length, before, 'No se envían correcciones sin motivo y confirmación');
      await dialog.getByLabel('Motivo de la acción').fill('Corrección comprobada por el jefe');
      if (check) {
        await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click(); assert.equal(mutations.length, before);
        await dialog.getByLabel(check, { exact: true }).check();
      }
      if (action === 'corregir') await dialog.getByLabel('Cantidad', { exact: true }).fill('2');
      await shot(action); await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
      assert.equal(mutations.at(-1).pathname, `/api/jefe-tecnico/repuestos/${id}/${action}`);
      if (action === 'corregir-entrega') assert.equal(mutations.at(-1).body.entrega_no_realizada, true);
      if (action === 'devolver') assert.equal(mutations.at(-1).body.devolucion_total_confirmada, true);
    }
    await row(4).getByRole('button', { name: 'Historial de solicitud 4', exact: true }).click();
    const history = page.getByRole('dialog'); await history.getByText('Devolución física al almacén', { exact: true }).waitFor();
    assert.ok(await history.getByText('Antes:', { exact: true }).count()); assert.ok(await history.getByText('Después:', { exact: true }).count()); await shot('historial-devolucion');
    await history.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await go('Seguimiento'); await page.getByRole('button', { name: 'Corregir asignación', exact: true }).click();
    const assignment = page.getByRole('dialog'); await assignment.getByLabel('Técnico responsable').selectOption('2'); await assignment.getByLabel('Motivo de la acción').fill('Se eligió un técnico equivocado');
    await assignment.getByRole('button', { name: 'Confirmar', exact: true }).click(); await assignment.waitFor({ state: 'hidden' }); assert.equal(mutations.at(-1).body.tipo, 'REASIGNACION');
    await go('Correcciones y excepciones'); assert.equal(await page.locator('tbody tr').count(), 5); await shot('historial-correcciones');
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Abrir navegación' }).click(); await go('Repuestos');
    await page.getByLabel('Filtrar solicitudes de repuestos').selectOption(''); await row(3).getByRole('button', { name: 'Retirar aprobación', exact: true }).click();
    await shot('movil-correccion'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.deepEqual(errors, []); assert.equal(mutations.length, 6);
    console.log(JSON.stringify({ passed: true, captures: captures.length, syntheticMutations: mutations.length, browserErrors: errors.length }));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
