const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Chequeo de edición concurrente (_chequearConflicto en modules/store.js):
// antes de subir un cambio, S.s() compara el conjunto de ids que esta
// pestaña cree que existen contra una consulta liviana al servidor. Si
// difieren (otra persona guardó algo mientras tanto), el guardado se aborta
// SIN mandar el POST, la pantalla se refresca con el estado real del
// servidor, y se avisa — nunca debe pisar en silencio el cambio ajeno.
test('detecta un conflicto de edición concurrente y no sobrescribe el cambio de otra persona', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/');
  await page.waitForFunction(() => typeof S !== 'undefined');

  // Esta pestaña "conoce" una sola OT (nunca vio la que otra persona va a
  // agregar mientras tanto).
  const filaConocida = { _id: 'ot-conocida', sigla: 'CAEX-01', tipo: 'Correctivo', fecha: '2026-09-01' };
  await page.evaluate((fila) => S.s('ot', [fila]), filaConocida);
  await expect.poll(() => page.evaluate(() => S.g('ot').length)).toBe(1);

  // Filtra por el contenido posteado (no solo "hubo un POST"): el guardado
  // inicial de arriba (filaConocida) también manda su propio POST de forma
  // asíncrona y puede seguir en vuelo acá — lo que de verdad no debe existir
  // es un POST que contenga el cambio en conflicto (CAEX-03).
  const postsConCambioEnConflicto = [];
  page.on('request', (req) => {
    if (req.method() !== 'POST' || !req.url().includes('/rest/v1/correctivos')) return;
    const body = req.postData() || '';
    if (body.includes('CAEX-03')) postsConCambioEnConflicto.push(body);
  });

  // A partir de ahora, el servidor "tiene" una fila más que esta pestaña
  // nunca cargó (ot-otra-persona) — simula el guardado real de otro usuario
  // mientras esta pestaña seguía con su copia vieja.
  await page.route(`${SB_URL}/rest/v1/correctivos**`, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();
    const select = new URL(req.url()).searchParams.get('select') || '';
    if (select === 'id') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'ot-conocida' }, { id: 'ot-otra-persona' }]),
      });
    }
    // Refetch completo (post-conflicto): el estado real y actual del servidor.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'ot-conocida', sigla: 'CAEX-01', tipo: 'Correctivo', fecha: '2026-09-01' },
        { id: 'ot-otra-persona', sigla: 'CAEX-02', tipo: 'Correctivo', fecha: '2026-09-05' },
      ]),
    });
  });

  // Esta pestaña, sin saber nada de lo anterior, intenta guardar SU propio cambio.
  await page.evaluate(() => {
    const actual = S.g('ot');
    S.s('ot', actual.concat([{ sigla: 'CAEX-03', tipo: 'Correctivo', fecha: '2026-09-10' }]));
  });

  await expect(page.locator('#tst')).toContainText('Otra persona modificó estos datos', { timeout: 10000 });

  // El POST con el cambio propio nunca se mandó — el guardado se abortó.
  await page.waitForTimeout(500);
  expect(postsConCambioEnConflicto.length).toBe(0);

  // La pantalla quedó con el estado real del servidor (2 filas), sin la
  // CAEX-03 que esta pestaña intentó agregar a ciegas.
  const catFinal = await page.evaluate(() => S.g('ot'));
  expect(catFinal.length).toBe(2);
  expect(catFinal.some((f) => f.sigla === 'CAEX-03')).toBe(false);
  expect(catFinal.some((f) => f.sigla === 'CAEX-02')).toBe(true);
});
