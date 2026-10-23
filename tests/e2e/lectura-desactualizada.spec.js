const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Horómetros desactualizados (23-oct): un equipo sin lectura reciente no se muestra como urgente, próximo ni al día. Aparece como «sin lectura», el Dashboard lo avisa y la
// tabla de Equipos no muestra anillo ni fecha de PM para él.
const iso = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

test('equipos sin lectura reciente: aviso en el Dashboard, contador en el encabezado y sin estado de PM en la tabla', async ({ page }) => {
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

  const r = await page.evaluate(async (fechas) => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const base = { tipo: 'Camion', modelo: 'Komatsu HD785-7', frecPM: 250, hrsDia: 12 };
    const eq = [
      Object.assign({ sigla: 'OK-1', horomActual: 3000, fechaHorom: fechas.hoy }, base),        // vigente
      Object.assign({ sigla: 'AT-1', horomActual: 3100, fechaHorom: fechas.hace20 }, base),     // atrasada (20 días)
      Object.assign({ sigla: 'SL-1', horomActual: 19203, fechaHorom: fechas.hace59 }, base),    // sin lectura (59 días)
      Object.assign({ sigla: 'SL-2', horomActual: 5000, fechaHorom: fechas.hace40 }, base),     // sin lectura (40 días)
      Object.assign({ sigla: 'ND-1', horomActual: 0, fechaHorom: fechas.hoy, hrsDia: 0 }, base), // equipo nuevo sin horómetro
    ];
    let ok = false;
    for (let k = 0; k < 10 && !ok; k++) {
      S.s('eq', eq); C.recalcAll && C.recalcAll(); go('dash'); await esp(1300);
      ok = !!document.getElementById('avisoHorom');
    }
    const out = { avisoHorom: ok };
    out.aviso = (document.getElementById('avisoHorom') || {}).textContent || '';
    out.estados = Object.fromEntries((S.g('eq') || []).map((e) => [e.sigla, e.estado]));
    out.header = [...document.querySelectorAll('#hs .hs')].map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim());
    // la ventana «¿cuáles son?» del contador
    window.verEquiposGrupo('sinlec'); await esp(400);
    out.modal = (document.getElementById('mc') || {}).textContent || '';
    cm();
    // tabla de Equipos
    go('eq'); await esp(1200);
    const fila = (s) => document.querySelector('#tbl-eq tr[data-sigla="' + s + '"]');
    const info = (s) => { const f = fila(s); if (!f) return null; const b = [...f.querySelectorAll('.badge')].pop(); return { badge: b ? b.textContent.trim() : '', clase: b ? b.className : '', anillo: !!f.querySelector('.gauge-ring'), texto: f.textContent.replace(/\s+/g, ' ') }; };
    out.eqSL = info('SL-1'); out.eqOK = info('OK-1'); out.eqAT = info('AT-1'); out.eqND = info('ND-1');
    return out;
  }, { hoy: iso(0), hace20: iso(20), hace40: iso(40), hace59: iso(59) });

  expect(r.avisoHorom).toBe(true);
  expect(r.aviso).toContain('3 de 5 equipos sin lectura reciente de horómetro');
  expect(r.aviso).toContain('1 no tienen horómetro cargado');
  expect(r.aviso).toContain('No se muestran como urgentes, próximos ni al día');
  expect(r.estados['SL-1']).toBe('⚪ SIN LECTURA');
  expect(r.estados['SL-2']).toBe('⚪ SIN LECTURA');
  expect(r.estados['ND-1']).toBe('⚪ SIN DATO');
  expect(r.estados['OK-1']).not.toMatch(/SIN /);
  expect(r.estados['AT-1']).not.toMatch(/SIN /);                      // 20 días: se muestra el estado, con aviso
  expect(r.header.some((t) => /3\s*Sin lectura/.test(t))).toBe(true);  // contador en el encabezado
  expect(r.modal).toContain('SL-1');
  expect(r.modal).toContain('SL-2');
  expect(r.modal).toContain('ND-1');
  expect(r.modal).not.toContain('OK-1');
  expect(r.modal).toContain('hace 59 días');
  expect(r.modal).toContain('sin horómetro cargado');
  expect(r.eqSL.badge).toBe('⚪ SIN LECTURA');
  expect(r.eqSL.clase).toContain('b-n');                               // gris, no verde
  expect(r.eqSL.anillo).toBe(false);                                   // sin anillo de días
  expect(r.eqOK.anillo).toBe(true);
  expect(r.eqAT.texto).toContain('lectura de hace 20 d');
  expect(r.eqND.badge).toBe('⚪ SIN DATO');
});
