const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Modo laboratorio: los métodos avanzados quedan detrás del botón; el Backtest se dibuja con datos.
test('laboratorio oculta los métodos avanzados y el backtest muestra su tabla', async ({ page }) => {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });

  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const ciclos = [20, 30, 45, 60, 90, 120, 180, 250];
    const ot = [], eq = [];
    ciclos.forEach((c, i) => {
      eq.push({ sigla: 'E' + i, tipo: 'Camion', modelo: 'X' });
      let d = new Date(Date.UTC(2023, 0, 1) + 5 * i * 864e5), n = 0;
      const fin = Date.now() - 20 * 864e5;
      while (d.getTime() < fin) { ot.push({ _id: 'o' + i + '_' + n, sigla: 'E' + i, tipo: 'Correctivo', fecha: d.toISOString().slice(0, 10), sintoma: 'falla de motor', estadoOT: 'Cerrada', horom: 100 + n, componente: ['Motor', 'Frenos', 'Mangueras'][n % 3] }); d = new Date(d.getTime() + c * 864e5); n++; }
    });
    // la carga en segundo plano puede pisar los datos recién puestos: se vuelven a poner si hace falta
    const sembrar = () => { S.s('eq', eq); S.s('ot', ot); };
    sembrar();
    window._comp2Sub = 'pred'; go('comp2');
    for (let i = 0; i < 100 && !document.getElementById('fPredVista'); i++) await esp(100);
    const sel = () => document.getElementById('fPredVista');
    const out = {};
    out.opcionesOff = [...sel().options].map((o) => o.value);
    window.alternarModoLab(); await esp(600);
    out.opcionesOn = [...sel().options].map((o) => o.value);
    for (let k = 0; k < 6; k++) {
      sembrar(); await esp(400);
      sel().value = 'backtest'; renders.pred(); await esp(500);
      if (/meses probados/i.test(document.getElementById('s-pred').innerText)) break;
    }
    document.querySelectorAll('#s-pred details').forEach((d) => { d.open = true; });
    out.texto = document.getElementById('s-pred').innerText;
    // Probabilidad de falla: muestra las dos formas de ordenar lado a lado, con lo que dice el backtest
    for (let k = 0; k < 6; k++) {
      sembrar(); await esp(400);
      sel().value = 'probabilidad'; renders.pred(); await esp(500);
      if (/qué dice el backtest/i.test(document.getElementById('s-pred').innerText)) break;
    }
    out.textoProb = document.getElementById('s-pred').innerText;
    window.alternarModoLab(); await esp(600);   // al apagar desde una vista de laboratorio vuelve a la general
    out.valorTrasApagar = sel().value;
    out.opcionesFinal = [...sel().options].map((o) => o.value);
    return out;
  });
  expect(r.opcionesOff).not.toContain('kijima');
  expect(r.opcionesOff).toContain('matriz');
  expect(r.opcionesOn).toContain('kijima');
  expect(r.opcionesOn).toContain('backtest');
  expect(r.texto).toContain('Backtest');
  expect(r.texto).toMatch(/meses probados/i);
  expect(r.texto).toContain('Regla simple: fallas de los últimos 365 días');
  expect(r.textoProb).toMatch(/lado a lado/i);
  expect(r.textoProb).toContain('Por fallas recientes');
  expect(r.textoProb).toContain('Qué dice el backtest');
  expect(r.valorTrasApagar).toBe('general');
  expect(r.opcionesFinal).not.toContain('backtest');
});
