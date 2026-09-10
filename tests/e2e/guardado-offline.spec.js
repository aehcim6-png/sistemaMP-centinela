const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// El motor de sync (S.s(), modules/store.js) es "offline-first": localStorage
// se actualiza siempre, de forma síncrona, sin importar la red — Supabase se
// intenta en paralelo y, si falla, NUNCA debe quedar como si el guardado
// hubiera llegado a la nube (bug real de referencia: un cambio que parecía
// "✅ Guardado" en pantalla pero nunca llegó a la base).
test.describe('Guardado offline', () => {
  test('sin conexión: el dato queda en localStorage y se avisa que NO llegó a la nube', async ({ page, context }) => {
    await mockSupabase(page);
    await page.goto('/');
    await page.waitForFunction(() => typeof window.S !== 'undefined' || typeof S !== 'undefined');

    // Se sacan los mocks antes de simular la desconexión: un route() de
    // Playwright intercepta la petición ANTES de tocar la red real, así que
    // si se dejara puesto, el guardado "a la nube" respondería 200 igual
    // aunque el navegador esté offline — no probaría nada. Sin mock, el
    // fetch de _syncTablaGenericaInner queda sujeto de verdad a
    // context.setOffline(), que es lo que se quiere probar acá.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await context.setOffline(true);

    const idGuardado = await page.evaluate(() => {
      const fila = { sigla: 'CAEX-01', tipo: 'Correctivo', fecha: '2026-09-10', sintoma: 'prueba e2e offline' };
      S.s('ot', [fila]);
      return S.g('ot')[0]._id;
    });

    // 1. localStorage tiene el dato de inmediato (escritura síncrona, no depende de la red)
    const enLocalStorage = await page.evaluate(() => JSON.parse(localStorage.getItem('smp10_ot') || 'null'));
    expect(enLocalStorage).not.toBeNull();
    expect(enLocalStorage.some((f) => f._id === idGuardado)).toBe(true);

    // 2. El intento de sync contra Supabase falla (offline) y se avisa — nunca un falso "guardado"
    const toastEl = page.locator('#tst');
    await expect(toastEl).toHaveClass(/show/, { timeout: 10000 });
    await expect(toastEl).toContainText('No se pudo guardar en la nube');

    await context.setOffline(false);
  });

  test('el rol lector no puede escribir aunque tenga conexión', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await page.waitForFunction(() => typeof S !== 'undefined');

    const resultado = await page.evaluate(() => {
      window._userRole = 'lector';
      const antes = S.g('ot') || [];
      const ok = S.s('ot', antes.concat([{ sigla: 'CAEX-02', tipo: 'Correctivo', fecha: '2026-09-10' }]));
      return { ok, despues: S.g('ot') };
    });

    expect(resultado.ok).toBe(false);
    expect(resultado.despues.length).toBe(0);

    const toastEl = page.locator('#tst');
    await expect(toastEl).toHaveClass(/show/, { timeout: 10000 });
    await expect(toastEl).toContainText('solo lectura');
  });
});
