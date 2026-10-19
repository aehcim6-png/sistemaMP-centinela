const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Rediseño ronda 2: (1) el modal de cierre de un correctivo avisa qué falta, muestra el síntoma UNA vez, enfoca el primer campo
// que falta y se cierra con Esc; (2) los botones de vista del Predictivo salen del <select> real (mismas vistas, mismo modo
// Laboratorio), abiertos en escritorio y plegados en celular, y cambian la vista al tocarlos.
test('modal de cierre y botones de vista del Predictivo', async ({ page }) => {
  test.setTimeout(120000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  const esp = (ms) => page.waitForTimeout(ms);

  // ---- modal de cierre
  const m = await page.evaluate(async () => {
    const hoy = new Date().toISOString().slice(0, 10), pausa = (ms) => new Promise((x) => setTimeout(x, ms));
    const sembrar = () => { S.s('eq', [{ sigla: 'ZZ-1', tipo: 'Camion', modelo: 'X' }]); S.s('ot', [{ _id: 'o1', sigla: 'ZZ-1', tipo: 'Correctivo', fecha: hoy, sintoma: 'Falla de manguera hidráulica con fuga', estadoOT: 'Pendiente', costo: 0, componente: '', causaRaiz: '' }]); };
    sembrar(); go('ot');
    for (let i = 0; i < 100 && !document.querySelector('#s-ot table'); i++) await pausa(100);
    for (let k = 0; k < 6; k++) {
      sembrar(); await pausa(300); await edOT(0, 'estadoOT', 'Cerrada');
      for (let i = 0; i < 20 && !document.getElementById('ocCausa'); i++) await pausa(100);
      if (document.getElementById('ocCausa')) break;
    }
    const mc = document.getElementById('mc');
    return { texto: mc.innerText, sintomas: (mc.innerText.match(/Falla de manguera hidráulica/g) || []).length, enfocado: document.activeElement && document.activeElement.id, botones: [...mc.querySelectorAll('.ot-cierre-actions button')].map((b) => b.innerText) };
  });
  expect(m.texto).toMatch(/Falta: .*causa raíz.*costo/i);
  expect(m.sintomas).toBe(1);                      // el síntoma ya no sale repetido
  expect(m.texto).not.toContain('�');         // sin caracteres corruptos
  expect(m.enfocado).toBe('ocComp');               // el foco parte en el primer campo que falta, no en la ×
  expect(m.botones).toEqual(['Guardar y cerrar', 'Cerrar sin completar', 'Cancelar']);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mbg')).not.toHaveClass(/show/);

  // ---- Predictivo: botones derivados del select real
  for (const [w, h, escritorio] of [[1280, 900, true], [360, 780, false]]) {
    await page.setViewportSize({ width: w, height: h });
    const p = await page.evaluate(async (escritorio) => {
      const pausa = (ms) => new Promise((x) => setTimeout(x, ms));
      window._comp2Sub = 'pred'; go('comp2');
      for (let i = 0; i < 100 && !document.getElementById('fPredVista'); i++) await pausa(100);
      renders.pred(); await pausa(500);
      const sel = () => document.getElementById('fPredVista');
      const botones = () => [...document.querySelectorAll('.pred-vista-btn')];
      const out = { opciones: sel().options.length, botones: botones().length };
      const det = document.querySelector('.pred-vistas-det');
      out.abierto = det.open; out.resumen = document.querySelector('.pred-vistas-sum').innerText;
      out.selectOculto = getComputedStyle(sel()).display === 'none';
      if (!det.open) det.open = true;
      botones().find((b) => /Por Equipo/i.test(b.innerText)).click(); await pausa(600);
      out.vistaTrasClick = sel().value;
      window.alternarModoLab(); await pausa(600);
      out.opcionesLab = sel().options.length; out.botonesLab = botones().length;
      out.desborde = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return out;
    }, escritorio);
    expect(p.botones).toBe(p.opciones);              // un botón por cada opción del select, nunca desincronizado
    expect(p.botonesLab).toBe(p.opcionesLab);
    expect(p.opcionesLab).not.toBe(p.opciones);      // alternar el modo Laboratorio cambia las vistas y también sus botones (el modo persiste entre pasadas)
    expect(p.selectOculto).toBe(true);
    expect(p.abierto).toBe(escritorio);              // abierto en escritorio, plegado en celular
    expect(p.resumen).toMatch(/^Vista:/);
    expect(p.vistaTrasClick).toBe('equipo');
    expect(p.desborde).toBeLessThanOrEqual(4);
  }
});
