const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Metas & KPIs → «Preguntas del gerente» (27-oct-2026): ocho preguntas con respuesta corta, datos y límites; sin datos lo dice.
async function entrar(page) {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 900 });
}

test('«Preguntas del gerente» muestra las ocho preguntas con sus respuestas, datos y límites', async ({ page }) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  const texto = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const viejo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    S.s('eq', [{ sigla: 'CF-9510', tipo: 'Camion', modelo: 'X', frecPM: 250, hrsDia: 10, horomActual: 1000, horomProxPM: 1250, fechaHorom: viejo }]);
    S.s('pau', [{ _id: 'p1', sigla: 'CF-9510', hoja: 'h', pm: 'PM1', rep: 'Filtro aceite LF9009', can: 2 }]);
    S.s('stk', [{ _id: 'f1', nParte: 'LF9009', descripcion: 'Filtro aceite', stockBodega: 1, pendiente: 0, consumoMes: 0, precioUnit: 10000 }]);
    S.s('lub', []); S.s('mapaRep', [{ pautaId: 'p1', tipo: 'filtro', refId: 'f1' }]);
    S.s('ot', [
      { _id: 'o1', sigla: 'CF-9510', tipo: 'Correctivo', estadoOT: 'Cerrada', fechaEntrada: '2026-03-02', duracion: '3h', sintoma: 'Fuga' },
      { _id: 'o2', sigla: 'CF-9510', tipo: 'Correctivo', estadoOT: 'Cerrada', fechaEntrada: '2026-03-03', duracion: '900h', sintoma: 'Motor fundido', motivoDemora: 'Proveedor sin stock o con demora' },
    ]);
    S.s('comprasDetalle', []); S.s('backlogPM', []); S.s('progDia', []); S.s('reg', []);
    window._mkpiSub = 'ger'; go('mkpi');
    for (let i = 0; i < 100 && !document.querySelector('#ger-dur'); i++) await esp(100);
    return document.getElementById('s-ger').innerText;
  });
  for (const t of ['¿Cuánto demora una reparación?', '¿Por qué demoran tanto', 'programa de PM del mes', 'elementos de desgaste', 'reactivo', '¿Se planifica de verdad', 'cadena administrativa', 'mecánicos y electromecánicos']) {
    expect(texto.toLowerCase()).toContain(t.toLowerCase());
  }
  expect(texto).toMatch(/críticas/i);
  expect(texto).toMatch(/Faltan las fechas de cada aprobación/i);
  expect(texto).toMatch(/desactualizadas/i);
  await expect(page.locator('#ger-dur')).toBeVisible();
  expect(errores).toEqual([]);
});
