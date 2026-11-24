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

// El programa es editable: cada toque en una celda sin ejecutar la cambia a mano (PM1 → … → PM4 → sin PM → automático), se guarda y sobrevive a «Recalcular».
test('Programa Anual: una celda se ajusta a mano, se guarda y se conserva al recalcular', async ({ page }) => {
  test.setTimeout(120000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const hoy = new Date(), mesSig = (hoy.getMonth() + 1) % 12, anio = hoy.getFullYear();
    if (hoy.getMonth() === 11) return { omitido: true };
    const dd = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
    const sembrar = () => {
      S.s('eq', [{ sigla: 'XX-0001', tipo: 'Camión', modelo: 'M1', frecPM: 250, hrsDia: 10, horomActual: 1000, horomProxPM: 1250, fechaProxPM: dd(25), fechaHorom: dd(-1) }]);
      S.s('prg', [{ _id: 'g1', sigla: 'XX-0001', meses: Object.assign({}, ...MES.map((m) => ({ [m]: '' }))) }]);
      S.s('reg', [{ _id: 'r1', equipo: 'XX-0001', tipoPM: 'PM1', fechaEntrada: `${anio}-01-10`, horomReal: 750 }]);
    };
    sembrar(); go('dash'); await esp(1200); go('plani'); await esp(800); window.planiSub('prg');
    for (let k = 0; k < 50; k++) { sembrar(); window.renderPrg(); if (/XX-0001/.test((document.getElementById('s-prg') || {}).innerText || '')) break; await esp(100); }
    const celda = () => [...document.querySelectorAll('#s-prg .prog-grid .pg-c')].map((c) => c.innerText.trim()).slice(14)[mesSig];
    const toques = [];
    for (let i = 0; i < 4; i++) { cyclePrg('XX-0001', MES[mesSig]); toques.push(celda()); }   // PM1, PM2, PM3, PM4
    cyclePrg('XX-0001', MES[mesSig]); toques.push(celda());                                    // sin PM
    const guardado = JSON.stringify((S.g('prg') || [])[0].meses._manual || null);
    cyclePrg('XX-0001', MES[mesSig]); toques.push(celda());                                    // vuelve al automático
    const sinManual = (S.g('prg') || [])[0].meses._manual === undefined;
    // dejar uno fijado y recalcular el plan guardado: se conserva
    cyclePrg('XX-0001', MES[mesSig]); cyclePrg('XX-0001', MES[mesSig]);                        // PM2
    const pmFijado = celda();
    window.confirm = () => true; window.regenPrg();   // sin esperar: la carga en segundo plano puede vaciar los equipos del mock
    return { toques, guardado, sinManual, pmFijado, despuesRecalcular: celda(), mesSig, anio, mesNom: MES[mesSig], dbg: JSON.stringify({ n: document.querySelectorAll('#s-prg .prog-grid .pg-c').length, eq: (S.g('eq') || []).length, prg: (S.g('prg') || []).map(p => [p.sigla, JSON.stringify(p.meses._manual)]) }) };
  });
  if (r.omitido) return;
  expect(r.toques[0]).toContain('PM1 ✎');
  expect(r.toques[1]).toContain('PM2 ✎');
  expect(r.toques[2]).toContain('PM3 ✎');
  expect(r.toques[3]).toContain('PM4 ✎');
  expect(r.toques[4]).toContain('sin PM');
  expect(r.guardado).toContain('NONE');
  expect(r.toques[5]).not.toContain('✎');
  expect(r.sinManual).toBe(true);
  expect(r.pmFijado).toContain('PM2 ✎');
  expect(r.despuesRecalcular).toContain('PM2 ✎');
});

// Precisión del pronóstico (24-nov-2026): con suficientes PM ya ejecutados, el Programa Anual dice cuántos días se equivocó el sistema.
test('Programa Anual muestra qué tan bien acierta el pronóstico de PM con los PM ya ejecutados', async ({ page }) => {
  test.setTimeout(120000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.waitForTimeout(3000);
  const t = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const dia = (n) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
    const sembrar = () => {
      S.s('eq', [{ sigla: 'BT-1', tipo: 'Camión', modelo: 'M', frecPM: 250, hrsDia: 10, horomActual: 4000, horomProxPM: 4250, fechaProxPM: dia(300), fechaHorom: dia(299) }]);
      S.s('prg', [{ _id: 'g1', sigla: 'BT-1', meses: {} }]);
      S.s('hist', Array.from({ length: 290 }, (_, i) => ({ sigla: 'BT-1', fecha: dia(i), horom: 1000 + i * 10, horomFin: 1000 + i * 10 })));
      // un PM cada 25 días a las 250, 500, 750… h: el pronóstico acierta
      S.s('reg', Array.from({ length: 12 }, (_, k) => ({ _id: 'r' + k, equipo: 'BT-1', tipoPM: 'PM1', fechaEntrada: dia(20 + k * 25 + 5 - 5), horomReal: 1250 + k * 250 })));
    };
    sembrar(); go('dash'); await esp(1200); go('plani'); await esp(800); window.planiSub('prg');
    for (let k = 0; k < 50; k++) { sembrar(); window.renderPrg(); const x = (document.getElementById('s-prg') || {}).innerText || ''; if (/BT-1/.test(x)) return x; await esp(100); }
    return '';
  });
  expect(t).toContain('Qué tan bien acierta este pronóstico');
  expect(t).toContain('±7 días');
});
