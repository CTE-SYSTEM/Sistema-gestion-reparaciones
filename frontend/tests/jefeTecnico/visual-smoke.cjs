// Revisión visual local sin modificar datos. Requiere Playwright y Edge/Chromium.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { chromium } = require(process.env.CTE_PLAYWRIGHT_PATH || 'playwright');

const root = path.resolve(__dirname, '../../..');
const baseUrl = process.env.CTE_VISUAL_URL || 'http://localhost:5173';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname), 'Solo se revisa el entorno local.');
const output = path.join(root, 'tmp/jefe-tecnico');
const sessionScript = `
  import { PrismaClient } from '@prisma/client';
  import jwt from 'jsonwebtoken';
  import { env } from './src/config/env.js';
  const url = new URL(process.env.DATABASE_URL);
  if (!['db','localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Solo lectura local');
  const prisma = new PrismaClient();
  try {
    const user = await prisma.usuarios.findFirst({ where: { activo: true, rol: 'TecnicoJefe' }, select: { id_usuario: true, nombre_usuario: true, rol: true } });
    if (!user) throw new Error('No hay una cuenta de jefe activa para revisar');
    const token = jwt.sign({ id: user.id_usuario }, env.jwtSecret, { expiresIn: '5m' });
    process.stdout.write(JSON.stringify({ token, user: { username: user.nombre_usuario, rol: user.rol } }));
  } finally { await prisma.$disconnect(); }
`;

(async () => {
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'backend', 'node', '--input-type=module', '-'], { cwd: root, input: sessionScript, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, 'No se pudo preparar la sesión local de lectura desde Docker.');
  // La sesión viaja únicamente en memoria; nunca se imprime ni se guarda en una captura.
  const session = JSON.parse(result.stdout);
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CTE_BROWSER_EXECUTABLE ? { executablePath: process.env.CTE_BROWSER_EXECUTABLE } : {}) });
  const failures = [], errors = [], screenshots = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-NI', reducedMotion: 'reduce' });
    await context.addInitScript(({ token, user }) => { sessionStorage.setItem('token', token); sessionStorage.setItem('cte_user', JSON.stringify(user)); }, session);
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => { if (response.url().includes('/api/') && response.status() >= 400) failures.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    await page.route('**/api/**', async (route) => {
      assert.equal(route.request().method(), 'GET', 'La revisión visual no modifica datos.');
      await route.continue();
    });
    const screenshot = async (name) => { const file = path.join(output, `${name}.png`); await page.screenshot({ path: file, fullPage: true }); screenshots.push(file); };
    const go = async (title) => { await page.locator('.jefe-nav').getByRole('button', { name: new RegExp(`^${title}`) }).click(); await page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor(); };
    await page.goto(`${baseUrl}/tecnico-jefe`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Resumen del taller', level: 1 }).waitFor();
    await page.locator('.jefe-stats').waitFor();
    assert.equal(await page.locator('.app-page').getAttribute('class'), 'w-full app-page');
    assert.equal(await page.locator('.jefe-stat').count(), 4);
    assert.equal(await page.locator('.jefe-message.error').count(), 0);
    await screenshot('escritorio-resumen');
    await go('Asignaciones');
    await screenshot('escritorio-asignaciones');
    const assignButtons = page.getByRole('button', { name: 'Asignar', exact: true });
    if (await assignButtons.count()) {
      await assignButtons.first().click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.equal(await dialog.getByLabel('Técnico responsable').inputValue(), '');
      await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
      assert.equal(await dialog.getByLabel('Técnico responsable').evaluate((el) => el.validity.valueMissing), true);
      await screenshot('dialogo-asignacion');
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    }
    await go('Seguimiento');
    await page.getByLabel('Filtrar trabajos activos o todos').selectOption('todos');
    const table = page.locator('.jefe-table');
    const firstReference = await table.locator('tbody tr').first().locator('td').first().innerText();
    if (await page.getByLabel('Página siguiente', { exact: true }).count()) {
      await page.getByLabel('Página siguiente', { exact: true }).click();
      assert.notEqual(await table.locator('tbody tr').first().locator('td').first().innerText(), firstReference);
    }
    await page.getByLabel('Buscar registros', { exact: true }).fill('dato-imposible-para-verificar-filtro');
    await page.getByText('No hay registros para estos filtros.').waitFor();
    await page.getByLabel('Buscar registros', { exact: true }).fill('');
    const detailButton = page.getByRole('button', { name: /^Ver (orden|diagnostico)/ }).first();
    if (await detailButton.count()) {
      await detailButton.click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Datos generales', exact: true }).waitFor();
      assert.ok(await dialog.getByText('Técnico responsable', { exact: true }).count());
      await dialog.getByRole('button', { name: 'Avances e historial', exact: true }).click();
      await dialog.getByRole('heading', { name: 'Cambios de estado y asignaciones' }).waitFor();
      await dialog.getByRole('button', { name: 'Fotografías', exact: true }).click();
      assert.equal(await dialog.getByRole('button', { name: 'Actualizar fotos' }).count(), 0);
      assert.equal(await dialog.getByLabel('Tomar fotografía con cámara').count(), 0);
      const photoButton = dialog.locator('section button.text-left').first();
      if (await photoButton.count()) {
        await photoButton.click();
        await dialog.getByLabel('Motivo de la revisión fotográfica').waitFor();
        const reviewButton = dialog.getByRole('button', { name: /^(Autorizar para el técnico|Retirar del expediente técnico)$/ });
        assert.equal(await reviewButton.isDisabled(), true);
      }
      await screenshot('dialogo-detalle');
      await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    }
    await screenshot('escritorio-seguimiento');
    for (const [title, name] of [['Diagnósticos cerrados', 'diagnosticos-cerrados'], ['Órdenes cerradas', 'ordenes-cerradas'], ['Equipo técnico', 'equipo'], ['Repuestos', 'repuestos'], ['Irreparables', 'irreparables'], ['Pendientes y retrasos', 'alertas'], ['Correcciones y excepciones', 'intervenciones']]) {
      await go(title); await screenshot(`escritorio-${name}`);
    }
    await go('Resumen del taller');
    const lightBackground = await page.locator('.jefe-panel').evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.getByRole('button', { name: 'Cambiar a modo oscuro', exact: true }).click();
    await page.locator('html[data-theme="dark"]').waitFor({ state: 'attached' });
    await page.waitForFunction((light) => getComputedStyle(document.querySelector('.jefe-panel')).backgroundColor !== light, lightBackground);
    await screenshot('escritorio-oscuro');
    await page.getByRole('button', { name: 'Cambiar a modo normal', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot('movil-resumen');
    const mobileLayout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 && r.width > 0; }).slice(0, 12).map((el) => ({ tag: el.tagName, className: typeof el.className === 'string' ? el.className : '', width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right })) }));
    if (mobileLayout.scroll > mobileLayout.width) console.log(JSON.stringify(mobileLayout));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'La página móvil no debe desbordarse horizontalmente.');
    await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
    await page.locator('.jefe-sidebar.open').waitFor();
    await screenshot('movil-menu');
    await go('Asignaciones');
    assert.equal(await page.locator('.jefe-sidebar.open').count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await screenshot('movil-asignaciones');
    assert.deepEqual(errors, [], 'Errores de React/navegador');
    assert.deepEqual(failures, [], 'Errores de las consultas de API');
    console.log(JSON.stringify({ resultado: 'correcto', secciones: 8, consultasFallidas: failures.length, erroresNavegador: errors.length, capturas: screenshots }, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
