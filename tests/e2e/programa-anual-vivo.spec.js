const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Programa Anual «vivo» (23-nov-2026): lo ejecutado sale de los registros de PM con su tipo real, lo que viene se proyecta desde el último PM real y un mes pasado del plan sin registro se avisa.
test('Programa Anual muestra el PM ejecutado con su tipo real, el vencido, el sin registro y el equipo sin lectura', async ({ page }) => {
  test.setTimeout(120000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1400, height: 900 });
  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const hoy = new Date(), anio = hoy.getFullYear(), mesAct = hoy.getMonth();
    const MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const iso = (d) => d.toISOString().slice(0, 10);
    const dd = (dias) => iso(new Date(Date.now() + dias * 864e5));
    const mesPasado = Math.max(0, mesAct - 2);
    const fechaPasada = `${anio}-${String(mesPasado + 1).padStart(2, '0')}-10`;
    const sembrar = () => {
      S.s('eq', [
        // al día: próximo hito a 40 h (≈ 4 días a 10 h/día)
        { sigla: 'XX-0001', tipo: 'Camión', modelo: 'M1', frecPM: 250, hrsDia: 10, horomActual: 1010, horomProxPM: 1250, fechaProxPM: dd(24), fechaHorom: dd(-1) },
        // vencido: el hito pasó
        { sigla: 'XX-0002', tipo: 'Camión', modelo: 'M2', frecPM: 250, hrsDia: 10, horomActual: 2100, horomProxPM: 2000, fechaProxPM: dd(-5), fechaHorom: dd(-1) },
        // sin lectura confiable
        { sigla: 'XX-0003', tipo: 'Camión', modelo: 'M3', frecPM: 250, hrsDia: 10, horomActual: 500, horomProxPM: 500, fechaProxPM: '', fechaHorom: dd(-60) },
      ]);
      const plan = (extra) => Object.assign({}, ...MES.map((m) => ({ [m]: '' })), extra);
      S.s('prg', [
        { _id: 'g1', sigla: 'XX-0001', meses: plan({ [MES[mesPasado]]: 'PM3' }) },
        { _id: 'g2', sigla: 'XX-0002', meses: plan({}) },
        { _id: 'g3', sigla: 'XX-0003', meses: plan({}) },
      ]);
      // XX-0001: ejecutó PM2 el mes pasado ESE mismo mes el plan decía PM3 (el tipo real manda)
      S.s('reg', [{ _id: 'r1', equipo: 'XX-0001', tipoPM: 'PM2', fechaEntrada: fechaPasada, horomReal: 1000 }]);
    };
    sembrar(); go('dash'); await esp(1200); go('plani'); await esp(800); window.planiSub('prg');
    for (let i = 0; i < 100 && typeof window.renderPrg !== 'function'; i++) await esp(100);
    // sembrar y dibujar sin esperar en medio: la carga del mock puede pisar lo sembrado entre una espera y otra
    let t = '';
    for (let k = 0; k < 50; k++) { sembrar(); window.renderPrg(); t = (document.getElementById('s-prg') || {}).innerText || ''; if (/XX-0001/.test(t) && /XX-0003/.test(t)) break; await esp(100); }
    const celdas = [...document.querySelectorAll('#s-prg .prog-grid .pg-c')].map((c) => c.innerText.trim());
    const filas = {};
    for (let i = 13; i + 12 < celdas.length + 1; i += 13) { filas[celdas[i].replace(/\s*⚠$/, '').trim()] = celdas.slice(i + 1, i + 13); }
    return { t, filas, mesPasado, mesAct, anioSel: (document.getElementById('fPrgAnio') || {}).value, opciones: [...document.querySelectorAll('#fPrgAnio option')].map(o => o.value), vivo: JSON.stringify((S.g('reg') || []).slice(0, 2)) };
  });
  // ejecutado: el tipo real (PM2✓), no «EJEC» y no el PM3 que decía el plan
  expect(r.filas['XX-0001'][r.mesPasado]).toContain('PM2✓');
  expect(r.t).not.toContain('EJEC≠');
  // vencido: cae en el mes actual y se marca ⚠
  expect(r.filas['XX-0002'][r.mesAct]).toContain('⚠');
  // sin lectura: se avisa y no se proyecta
  expect(r.t).toContain('Equipos sin proyección confiable');
  expect(r.t).toContain('XX-0003');
  expect(r.filas['XX-0003'].every((c) => c === '·')).toBe(true);
});
