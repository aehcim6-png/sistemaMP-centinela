const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Componentes → «Reparar vs comprar» (28-oct-2026): compara reparar y comprar con precio, plazo, vida y detención; sin datos no recomienda.
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

test('«Reparar vs comprar» muestra el veredicto, el equilibrio cuando falta la vida y cambia con la pieza de reserva', async ({ page }) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const compra = (d, p, plazo) => ({ _id: d + p, detalle: d, precioUnit: p, costo: p, cant: 1, estado: 'Recepcion Bodega', tiempoRespuesta: plazo || '10 dias 0h 0m', fecha: '2026-05-01', sigla: 'CN-1' });
    const sembrar = () => {
      S.s('eq', [{ sigla: 'CN-1', tipo: 'Camion', modelo: 'HD785-7', horomActual: 5000 }]);
      S.s('comprasDetalle', [compra('Reparacion Asiento Caex', 500000), compra('Reparacion Asiento Caex', 540000), compra('Asiento 4215731112', 2800000), compra('Reparacion Alternador Cam', 600000)]);
      S.s('compHist', []);
      S.s('ot', []);
    };
    window._comp2Sub = 'rvc'; go('comp2');
    for (let i = 0; i < 100 && !document.querySelector('#s-rvc'); i++) await esp(100);
    sembrar(); await window.renderRvc();
    const a = document.getElementById('s-rvc').innerText;
    sembrar(); window.rvcCambiarReserva('si');
    const b = document.getElementById('rvcReserva').value + '|' + document.getElementById('s-rvc').innerHTML;
    sembrar(); document.getElementById('rvcOtra').value = 'radiador'; window.rvcBuscarPieza();
    const c = document.getElementById('s-rvc').innerText;
    return { a, b, c };
  });
  expect(r.a).toMatch(/Reparar vs comprar/);
  expect(r.a).toMatch(/Asiento de operador/);
  expect(r.a).toMatch(/Falta medir la vida de lo reparado/);
  expect(r.a).toMatch(/al menos \d+ % de lo que dura uno nuevo/);
  expect(r.a).toMatch(/Alternador/);
  expect(r.a).toMatch(/Sin datos/);
  expect(r.a).toMatch(/espera el plazo completo|se cuenta la espera/);
  expect(r.b.startsWith('si|')).toBe(true);
  expect(r.b).toMatch(/con pieza de reserva: no se cuenta espera/);
  expect(r.c).toMatch(/radiador/i);
  expect(errores).toEqual([]);
});
