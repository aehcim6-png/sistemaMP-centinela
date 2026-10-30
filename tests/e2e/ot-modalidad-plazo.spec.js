const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Modalidad y plazo comprometido de la reparación (PRO-MAN-002): se cargan en «Nueva OT», la fecha de cierre la anota la app,
// el panel del mes cuenta a tiempo / tarde / vencidas y un equipo con garantía vigente por horómetro muestra el aviso.
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

test('Nueva OT guarda modalidad y plazo, anota la fecha de cierre y el panel cuenta el cumplimiento', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const dIso = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const hoy = dIso(0), mes = hoy.slice(0, 7);
    const eq = [{ sigla: 'ZZ-1', tipo: 'Camion', modelo: 'X', horomActual: 1500, garantiaHasta: 2000 }, { sigla: 'ZZ-2', tipo: 'Camion', modelo: 'X', horomActual: 9000, garantiaHasta: 2000 }];
    // una OT abierta con el plazo vencido ayer (si hoy es día 1 el plazo cae el mes anterior y no entra al panel: se usa hoy mismo como plazo de una cerrada a tiempo)
    const otBase = [{ _id: 'v1', sigla: 'ZZ-2', tipo: 'Correctivo', fecha: dIso(3), fechaEntrada: dIso(3), sintoma: 'Fuga de aceite en mando final', estadoOT: 'En Ejecución', modalidadReparacion: 'Tercero por cotización', plazoComprometido: dIso(1) }];
    const sembrar = () => { S.s('eq', eq); S.s('ot', otBase.map((o) => Object.assign({}, o))); };
    sembrar(); go('ot'); await esp(2500);
    const out = {};
    // 1) aviso de garantía al elegir el equipo en «Nueva OT»
    sembrar(); addOT();
    document.getElementById('oEq').value = 'ZZ-1'; oComprobarGarantia();
    out.avisoGarantia = document.getElementById('oAvisoGarantia').innerText;
    document.getElementById('oEq').value = 'ZZ-2'; oComprobarGarantia();
    out.avisoSinGarantia = document.getElementById('oAvisoGarantia').innerText;
    // 2) guardar una OT cerrada con modalidad y plazo
    document.getElementById('oEq').value = 'ZZ-1';
    document.getElementById('oSint').value = 'Cambio de manguera hidráulica';
    document.getElementById('oModalidad').value = 'Garantía';
    document.getElementById('oPlazo').value = hoy;
    document.getElementById('oFecSal').value = hoy;
    document.getElementById('oEstOT').value = 'Cerrada';
    const t0 = window.toast; window.toast = () => {}; window.confirm = () => true;
    saveOT();
    window.toast = t0;
    const nueva = S.g('ot').find((o) => o.sintoma === 'Cambio de manguera hidráulica');
    out.nueva = nueva && { modalidad: nueva.modalidadReparacion, plazo: nueva.plazoComprometido, fechaCierre: nueva.fechaCierre, hoy };
    // 3) reabrir y volver a cerrar: la fecha de cierre se borra y se vuelve a anotar
    const idx = S.g('ot').indexOf(nueva);
    await edOT(idx, 'estadoOT', 'Pendiente', true);
    out.reabierta = S.g('ot')[idx].fechaCierre;
    await edOT(idx, 'estadoOT', 'Cerrada', true);
    out.recerrada = S.g('ot')[idx].fechaCierre;
    // 4) panel del mes y columnas de la tabla, con lo que haya quedado guardado (se dibuja en el mismo instante, la carga en segundo plano puede pisar lo sembrado)
    const final = S.g('ot');
    S.s('eq', eq); S.s('ot', final); renderOt();
    const sec = document.getElementById('s-ot');
    out.panel = (sec.querySelector('details summary') || {}).innerText || '';
    out.cabecera = [...sec.querySelectorAll('table tr:first-child')].map((tr) => tr.textContent).find((t) => t.includes('Síntoma')).replace(/\s+/g, ' ');
    out.calc = cumplimientoPlazosReparacion(final, mes + '-01', mes + '-31', hoy);
    // solo para la captura: se fijan los datos (la carga en segundo plano simulada vacía los pisaría entre el dibujo y la foto)
    window._dibujarOtFinal = () => { const fijo = { eq, ot: final }, g0 = S.g.bind(S); S.g = (k) => (fijo[k] ? fijo[k].slice() : g0(k)); renderOt(); };
    return out;
  });
  expect(r.avisoGarantia).toContain('Equipo en garantía hasta las 2.000 h');
  expect(r.avisoGarantia).toContain('quedan 500 h');
  expect(r.avisoSinGarantia).toBe('');
  expect(r.nueva).toEqual({ modalidad: 'Garantía', plazo: r.nueva.hoy, fechaCierre: r.nueva.hoy, hoy: r.nueva.hoy });
  expect(r.reabierta).toBeNull();
  expect(r.recerrada).toBe(r.nueva.hoy);
  expect(r.cabecera).toContain('Modalidad');
  expect(r.cabecera).toContain('Plazo');
  expect(r.panel).toContain('Cumplimiento de plazos de reparación');
  expect(r.calc.cumplidas).toBeGreaterThanOrEqual(1);
  expect(r.panel).toContain(r.calc.cumplidas + ' a tiempo');
  expect(r.panel).toContain(r.calc.vencidas + ' vencida(s) abierta(s)');
  if (process.env.OT_CAPTURA) {
    await page.evaluate(() => window._dibujarOtFinal());
    await page.screenshot({ path: process.env.OT_CAPTURA, fullPage: false });
  }
});
