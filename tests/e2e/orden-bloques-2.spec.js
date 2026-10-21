const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Orden por prioridad, segunda tanda (21-oct): Resumen Ejecutivo ya no repite la tabla de Metas arriba (un panel «hidden» sin regla CSS se veía igual);
// TBO Komatsu lleva el texto «Cómo leerlo» plegado; Correctivos pasa sus dos tarjetas de calidad del cierre debajo de la lista.
test('Resumen Ejecutivo sin Metas duplicada, TBO con guía plegada y Correctivos con la calidad del cierre abajo', async ({ page }) => {
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

  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const iso = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const eq = [1, 2, 3].map((i) => ({ sigla: 'ZZ-' + i, tipo: 'Camion', modelo: 'X', horomActual: 1000 * i, frecPM: 250, fechaHorom: iso(2) }));
    const ot = [1, 2, 3, 4].map((i) => ({ _id: 'o' + i, sigla: 'ZZ-' + ((i % 3) + 1), tipo: 'Correctivo', fecha: iso(i * 9), fechaEntrada: iso(i * 9), estadoOT: i % 2 ? 'Cerrada' : 'En Ejecución', sintoma: 'falla ' + i, componente: 'Bomba', costo: 1000 * i }));
    const abrir = async (preparar, hasta) => {
      for (let k = 0; k < 8; k++) { S.s('eq', eq); S.s('ot', ot); preparar(); await esp(1100); const ya = hasta(); if (ya) return true; }
      return false;
    };
    const out = {};
    // Resumen Ejecutivo
    window._mkpiSub = 'metas'; go('mkpi'); await esp(1500);   // como en el uso real: se entra por Metas y luego se elige Resumen Ejecutivo
    out.resOk = await abrir(() => { mkpiSub('resumen'); }, () => { return !!(document.getElementById('s-resumen') || {}).textContent && /Resumen Ejecutivo/.test(document.getElementById('s-resumen').textContent); });
    await esp(900);
    const m = document.getElementById('s-metas');
    out.res = { metasOculto: getComputedStyle(m).display === 'none', metasAlto: m.offsetHeight, resumenVisible: document.getElementById('s-resumen').offsetHeight > 0, textoMetasEnResumen: /Metas vs Realidad/.test(document.getElementById('s-resumen').innerText) };
    // TBO
    out.tboOk = await abrir(() => { window._comp2Sub = 'tbo'; go('comp2'); }, () => !!document.querySelector('#s-tbo .cards'));
    await esp(600);
    const tbo = document.getElementById('s-tbo');
    const det = [...tbo.querySelectorAll('details')].find((d) => /Cómo leerlo/.test(d.querySelector('summary').textContent));
    const cards = tbo.querySelector('.cards');
    out.tbo = { hayGuia: !!det, cerrada: !!det && !det.open, guiaAntesDeTarjetas: !!det && !!cards && (det.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, guiaTexto: !!det && /plan teórico/.test(det.textContent) };
    // Correctivos
    out.otOk = await abrir(() => { go('ot'); }, () => !!document.querySelector('#s-ot .ot-calidad'));
    await esp(400);
    const so = document.getElementById('s-ot');
    const arriba = so.querySelector('.cards'), cal = so.querySelector('.ot-calidad'), tabla = so.querySelector('.tbl-wrap') || so.querySelector('.vacio-tabla');
    out.ot = { tarjetasArriba: arriba ? arriba.children.length : -1, calidadAbajo: !!cal && !!tabla && (tabla.compareDocumentPosition(cal) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, calidadTarjetas: cal ? cal.querySelectorAll('.card').length : -1, textos: cal ? cal.textContent : '' };
    return out;
  });
  expect(r.resOk).toBe(true);
  expect(r.res.metasOculto).toBe(true);        // el panel de Metas ya no se ve dentro de Resumen Ejecutivo
  expect(r.res.metasAlto).toBe(0);
  expect(r.res.resumenVisible).toBe(true);
  expect(r.res.textoMetasEnResumen).toBe(false);

  expect(r.tboOk).toBe(true);
  expect(r.tbo.hayGuia).toBe(true);
  expect(r.tbo.cerrada).toBe(true);            // «Cómo leerlo» viene plegado
  expect(r.tbo.guiaAntesDeTarjetas).toBe(true);
  expect(r.tbo.guiaTexto).toBe(true);          // y el texto sigue ahí

  expect(r.otOk).toBe(true);
  expect(r.ot.tarjetasArriba).toBe(5);         // total, pendientes, en ejecución, cerradas, costo
  expect(r.ot.calidadAbajo).toBe(true);
  expect(r.ot.calidadTarjetas).toBe(2);
  expect(r.ot.textos).toMatch(/sin soluci[oó]n/i);
  expect(r.ot.textos).toMatch(/tipo de causa/i);
});
