const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Orden por prioridad, tercera tanda (21-oct): TBO Komatsu pone lo accionable y el gasto arriba y el análisis de vida útil plegado al final;
// Planificador de Materiales pone controles, totales y materiales del período antes de la Curva S y el flujo de caja.
test('TBO con el análisis de vida útil plegado al final y Planificador con la Curva S debajo', async ({ page }) => {
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
    const abrir = async (preparar, hasta) => {
      for (let k = 0; k < 8; k++) { S.s('eq', eq); preparar(); await esp(1100); if (hasta()) return true; }
      return false;
    };
    const out = {};
    // entrar como en el uso real: por la pestaña y luego la subpestaña
    window._comp2Sub = 'comp'; go('comp2'); await esp(1500);
    out.tboOk = await abrir(() => { comp2Sub('tbo'); }, () => !!document.querySelector('#s-tbo .tbo-avz'));
    const tbo = document.getElementById('s-tbo');
    const titulos = [...tbo.querySelectorAll('.card-t')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
    const pos = (re) => titulos.findIndex((t) => re.test(t));
    const avz = tbo.querySelector('.tbo-avz');
    out.tbo = {
      orden: [pos(/Qué toca cambiar/), pos(/Plan de compra/), pos(/plata limitada/), pos(/Matriz de riesgo/), pos(/Gasto real dentro/), pos(/gastar en repuestos/), pos(/listado "Sugerido"/)],
      avzCerrado: !!avz && !avz.open,
      avzTitulos: avz ? [...avz.querySelectorAll('.card-t')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) : [],
      avzAlFinal: !!avz && avz.nextElementSibling === null,
      sueltosDespues: [...tbo.querySelectorAll('.card-t')].filter((e) => /Cuánto dura|reemplazo óptimo|Cada cuántas horas|calibración|distribución correcta/i.test(e.textContent) && !e.closest('.tbo-avz')).length,
    };
    // Planificador de Materiales
    window._planiSub = 'sem'; go('plani'); await esp(1500);
    out.planOk = await abrir(() => { planiSub('plan'); }, () => !!document.getElementById('planCurvaS') && !!document.querySelector('#s-plan .sec-h'));
    const sp = document.getElementById('s-plan');
    const curva = document.getElementById('planCurvaS');
    const tarjetas = [...sp.querySelectorAll('div')].find((d) => /PM programadas/.test(d.textContent) && d.children.length === 4);
    const flujo = [...sp.querySelectorAll('.chart-t')].find((e) => /Flujo de Caja/.test(e.textContent));
    out.plan = { curvaDespuesDeTotales: !!curva && !!tarjetas && (tarjetas.compareDocumentPosition(curva) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, flujoDespuesDeCurva: !!flujo && !!curva && (curva.compareDocumentPosition(flujo) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, hayFlujo: !!flujo };
    return out;
  });
  expect(r.tboOk).toBe(true);
  const o = r.tbo.orden;
  expect(o.every((x) => x >= 0)).toBe(true);                     // las siete secciones accionables y de gasto siguen existiendo
  expect([...o].sort((a, b) => a - b)).toEqual(o);               // y vienen en este orden: cambiar, comprar, plata limitada, riesgo, gasto, pronóstico, listado
  expect(r.tbo.avzCerrado).toBe(true);                           // el análisis de vida útil viene plegado
  expect(r.tbo.avzAlFinal).toBe(true);                           // y va al final
  expect(r.tbo.avzTitulos.length).toBeGreaterThanOrEqual(4);     // con sus secciones adentro (vida real, reemplazo óptimo, calibración, ajuste)
  expect(r.tbo.sueltosDespues).toBe(0);                          // ninguna quedó fuera del bloque plegado

  expect(r.planOk).toBe(true);
  expect(r.plan.hayFlujo).toBe(true);
  expect(r.plan.curvaDespuesDeTotales).toBe(true);
  expect(r.plan.flujoDespuesDeCurva).toBe(true);
});
