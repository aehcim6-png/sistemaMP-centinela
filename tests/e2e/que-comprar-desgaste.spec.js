const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// «Qué comprar» → piezas de desgaste por equipo (23-nov-2026): próximo cambio − plazo real, con el stock del modelo y la última compra de referencia.
test('«Qué comprar» muestra las cuchillas del equipo con pedir antes de, stock del modelo y última compra', async ({ page }) => {
  test.setTimeout(120000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 900 });
  const texto = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const f = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
    const sembrar = () => {
      S.s('eq', [{ sigla: 'MN-6112', tipo: 'Motoniveladora', modelo: 'Komatsu GD-705-5', frecPM: 250, hrsDia: 12, horomActual: 9397, fechaHorom: f(1) }]);
      S.s('getsCambios', [
        { _id: 'a', sigla: 'MN-6112', fecha: f(50), pieza: 'Cuchillas', descripcion: 'Cuchillas: cambio', horometro: null },
        { _id: 'b', sigla: 'MN-6112', fecha: f(30), pieza: 'Cuchillas', descripcion: 'Cuchillas: cambio', horometro: null },
        { _id: 'c', sigla: 'MN-6112', fecha: f(10), pieza: 'Cuchillas', descripcion: 'Cuchillas: cambio', horometro: null },
      ]);
      S.s('repuestos', [{ id: 'r1', componente: 'Cuchilla niveladora', nParte: '4T2233', equipo: 'GD705-5', stockActual: '12', stockMinimo: '6' }]);
      S.s('comprasDetalle', [{ sigla: 'MN-6112', fecha: f(15), detalle: 'Cuchilla 7x8x1 3/4 4t2233', cant: 6, costo: 900000, oc: 'x', estado: 'Recepcion Bodega', pedido: 'q', tiempoRespuesta: '12 dias 0h 0m' }]);
      S.s('ot', []); S.s('otHist', []); S.s('stk', []); S.s('lub', []); S.s('neu', []); S.s('pau', []); S.s('mapaRep', []);
    };
    sembrar(); go('stk2');
    for (let i = 0; i < 100 && typeof window.queComprar !== 'function'; i++) await esp(100);
    let t = '';
    for (let k = 0; k < 50; k++) { sembrar(); window.queComprar(); await esp(100); t = document.body.innerText; if (/Piezas de desgaste por equipo/.test(t) && /MN-6112/.test(t)) break; }
    return t;
  });
  expect(texto).toContain('Piezas de desgaste por equipo');
  expect(texto).toContain('MN-6112');
  expect(texto).toContain('Cuchillas');
  expect(texto).toContain('Pedir antes de');
  expect(texto).toContain('6 un');
});
