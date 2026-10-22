const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Fotos por modelo en la Torre de Control (22-oct): si el modelo tiene foto se muestra la foto (con aro y punto del color de salud);
// si no tiene, o la imagen falla, se muestra la silueta de siempre. «Komatsu HD785-7» y «Komatsu HD-785-7» comparten foto.
const PNG_OK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_ROTO = 'data:image/png;base64,AAAA';

test('la Torre de Control usa la foto del modelo y cae a la silueta si no hay foto o falla', async ({ page }) => {
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

  const r = await page.evaluate(async (fotos) => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const iso = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const base = { frecPM: 250, fechaHorom: iso(2), horomActual: 3000 };
    const eq = [
      Object.assign({ sigla: 'HD-1', tipo: 'Camion', modelo: 'Komatsu HD785-7' }, base),
      Object.assign({ sigla: 'HD-2', tipo: 'Camion', modelo: 'Komatsu HD-785-7' }, base),   // otra escritura del mismo modelo
      Object.assign({ sigla: 'WA-1', tipo: 'Cargador Frontal', modelo: 'Komatsu WA900-8R' }, base), // sin foto
      Object.assign({ sigla: 'GD-1', tipo: 'Motoniveladora', modelo: 'Komatsu GD-705-5' }, base),  // foto rota
    ];
    // el módulo de la Torre se carga al abrir la pestaña por primera vez
    for (let k = 0; k < 20 && !window._TORRE_FOTOS; k++) { S.s('eq', eq); go('torre'); await esp(600); }
    window._TORRE_FOTOS['komatsuhd7857'] = fotos.ok;
    window._TORRE_FOTOS['komatsugd7055'] = fotos.roto;
    let tiles = [];
    for (let k = 0; k < 8 && tiles.length < 4; k++) {
      S.s('eq', eq); go('torre'); await esp(1200);
      tiles = [...document.querySelectorAll('#s-torre .torre-tile')];
    }
    await esp(800); // deja que la imagen rota dispare su error
    const info = (sigla) => {
      const t = tiles.find((x) => x.querySelector('.ti-sigla').textContent === sigla);
      const ic = t.querySelector('.ti-icon');
      const fb = ic.querySelector('.ti-fallback');
      return { foto: !!ic.querySelector('img.ti-foto'), conFoto: ic.classList.contains('ti-con-foto'), svgVisible: !!ic.querySelector('svg') && (!fb || getComputedStyle(fb).display !== 'none') };
    };
    const out = { n: tiles.length, hd1: info('HD-1'), hd2: info('HD-2'), wa1: info('WA-1'), gd1: info('GD-1') };
    // panel de detalle de un equipo con foto
    window._torreAbrirDrawer('HD-1');
    const d = document.getElementById('torreDIcon');
    out.drawer = { foto: !!d.querySelector('img.ti-foto'), conFoto: d.classList.contains('ti-con-foto') };
    window._torreAbrirDrawer('WA-1');
    out.drawerSin = { foto: !!d.querySelector('img'), svg: !!d.querySelector('svg'), conFoto: d.classList.contains('ti-con-foto') };
    return out;
  }, { ok: PNG_OK, roto: PNG_ROTO });

  expect(r.n).toBe(4);
  expect(r.hd1.foto).toBe(true);                 // modelo con foto
  expect(r.hd2.foto).toBe(true);                 // «HD-785-7» comparte la foto de «HD785-7»
  expect(r.hd1.conFoto).toBe(true);
  expect(r.wa1.foto).toBe(false);                // sin foto: la silueta de siempre
  expect(r.wa1.svgVisible).toBe(true);
  expect(r.gd1.foto).toBe(false);                // foto rota: se quita y vuelve la silueta
  expect(r.gd1.svgVisible).toBe(true);
  expect(r.gd1.conFoto).toBe(false);             // y sin el punto de color de la foto
  expect(r.drawer).toEqual({ foto: true, conFoto: true });
  expect(r.drawerSin).toEqual({ foto: false, svg: true, conFoto: false });
});
