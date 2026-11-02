const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');
const fs = require('fs');
const XLSX = require('../../vendor/xlsx.core.min.js');

// Excel real (2-nov-2026): el botón «Excel» del encabezado baja todas las tablas de la pestaña, una hoja por tabla, con números y fechas de verdad.
// El botón «CSV» de siempre sigue en su lugar.
async function entrar(page) {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1400, height: 900 });
}

test('el botón Excel baja un .xlsx con cada tabla en su hoja y los números como números; el CSV sigue', async ({ page }) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  await expect(page.locator('#exportBar button[aria-label="Exportar a Excel"]')).toBeVisible();
  await expect(page.locator('#exportBar button[aria-label="Exportar a CSV"]')).toBeVisible();
  // pestaña con una tabla armada a mano (no depende de la carga en segundo plano): se inserta en la sección y se exporta en el mismo turno
  await page.evaluate(async () => {
    go('eq');
    await new Promise((x) => setTimeout(x, 1500));
    const sec = document.getElementById('s-eq');
    sec.querySelectorAll('.xl-prueba').forEach((n) => n.remove());
    const caja = document.createElement('div'); caja.className = 'xl-prueba';
    caja.innerHTML = '<h3>Equipos livianos</h3><table><tr><th>Sigla</th><th>Km actual</th><th>Fecha</th><th>Serie</th></tr>'
      + '<tr><td>CA-5979</td><td>124.127</td><td>2026-11-01</td><td>007</td></tr>'
      + '<tr><td>BS-5752</td><td>436.018</td><td>01-11-2026</td><td><input value="=1+1"></td></tr></table>'
      + '<h3>Equipos livianos</h3><table><tr><th>Otra</th></tr><tr><td>94,5%</td></tr></table>';
    sec.appendChild(caja);
  });
  // la descarga real
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => { document.querySelector('#exportBar button[aria-label="Exportar a Excel"]').click(); }),
  ]);
  expect(descarga.suggestedFilename()).toMatch(/^eq_\d{4}-\d{2}-\d{2}\.xlsx$/);
  const ruta = await descarga.path();
  const wb = XLSX.read(fs.readFileSync(ruta), { type: 'buffer' });
  const nombres = wb.SheetNames;
  expect(nombres).toContain('Equipos livianos');
  expect(nombres).toContain('Equipos livianos (2)');
  const ws = wb.Sheets['Equipos livianos'];
  expect(ws.A2.v).toBe('CA-5979');
  expect(ws.B2.t).toBe('n');
  expect(ws.B2.v).toBe(124127);                 // número, no texto
  expect(ws.C2.t).toBe('n');
  expect(ws.C2.v).toBe(46327);                  // 01-11-2026 como fecha de Excel
  expect(ws.D2.t).toBe('s');
  expect(ws.D2.v).toBe('007');                  // el cero a la izquierda se conserva
  expect(ws.D3.t).toBe('s');
  expect(ws.D3.v).toBe('=1+1');                 // un texto con = queda como texto, no como fórmula
  expect(ws.D3.f).toBeUndefined();
  expect(wb.Sheets['Equipos livianos (2)'].A2.v).toBe('94,5%');
  // el CSV de siempre sigue funcionando
  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => { document.querySelector('#exportBar button[aria-label="Exportar a CSV"]').click(); }),
  ]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  expect(errores).toEqual([]);
});

test('una pestaña sin tablas ni cifras avisa en vez de bajar un archivo vacío', async ({ page }) => {
  test.setTimeout(60000);
  await entrar(page);
  const aviso = await page.evaluate(async () => {
    go('eq');
    await new Promise((x) => setTimeout(x, 1500));
    const sec = document.getElementById('s-eq');
    sec.querySelectorAll('table').forEach((t) => t.remove());
    sec.querySelectorAll('.kpi-row').forEach((t) => t.remove());
    const toasts = []; const t0 = window.toast; window.toast = (m) => toasts.push(String(m));
    exportExcel('eq', 'eq');
    window.toast = t0;
    return toasts[0] || '';
  });
  expect(aviso).toContain('no tiene tablas ni cifras');
});
