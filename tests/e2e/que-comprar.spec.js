const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Stock & Insumos → «Qué comprar» (24-oct-2026): filtros, lubricantes, neumáticos y desgaste a mes / semestre / año, restando existencias y avisando de datos viejos.
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

const SEMBRAR = `
  window._sembrarCompras = () => {
    const viejo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    S.s('eq', [{ sigla: 'CF-9510', tipo: 'Camion', modelo: 'X', frecPM: 250, hrsDia: 10, horomActual: 1000, fechaHorom: viejo }]);
    S.s('pau', [{ _id: 'p1', sigla: 'CF-9510', hoja: 'h', pm: 'PM1', rep: 'Filtro aceite LF9009', can: 2 }]);
    S.s('stk', [{ _id: 'f1', nParte: 'LF9009', descripcion: 'Filtro aceite', stockBodega: 4, pendiente: 2, consumoMes: 0, precioUnit: 10000 }]);
    S.s('lub', []);
    S.s('mapaRep', [{ pautaId: 'p1', tipo: 'filtro', refId: 'f1' }]);
    S.s('neu', [
      { id: 'n1', sigla: 'CF-9510', serie: 'S1', medida: '295/80R22.5', estado: 'Stock' },
    ]);
    S.s('ot', []);
    S.s('comprasDetalle', Array.from({ length: 40 }, (_, i) => ({ estado: 'Recepcion Bodega', oc: 'oc' + i, pedido: 'p' + i, tiempoRespuesta: (10 + (i % 5)) + ' dias 0h 0m', costo: 500000 })));
  };
`;

test('«Qué comprar» muestra lo que falta por mes, semestre y año con las existencias descontadas y los avisos', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const texto = await page.evaluate(async (sem) => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    eval(sem);
    window._sembrarCompras(); go('stk2');
    for (let i = 0; i < 100 && typeof window.queComprar !== 'function'; i++) await esp(100);
    let t = '';
    for (let k = 0; k < 50; k++) {
      window._sembrarCompras(); window.queComprar(); await esp(100);
      t = document.body.innerText;
      if (/Qué comprar — próximo mes/.test(t) && /Filtro aceite/.test(t)) break;
    }
    return t;
  }, SEMBRAR);
  expect(texto).toContain('Qué comprar — próximo mes, semestre y año');
  expect(texto).toContain('Filtro aceite');
  expect(texto).toContain('LF9009');
  expect(texto).toMatch(/PM programados/);
  expect(texto).toContain('Pedir antes de');
  expect(texto).toMatch(/horómetro sin actualizar hace más de 30 días/);
  // 1 equipo, 10 h/día, PM cada 250 h desde 1.000 h: 2 filtros por PM, hay 4 + 2 pendientes
  const filas = await page.evaluate((sem) => { eval(sem); window._sembrarCompras(); const r = planCompras({ hoy: new Date(), demanda: demandaPlanificadaPM(S.g('eq'), getPautasConsumo, S.g('stk'), S.g('lub'), S.g('mapaRep'), new Date(), 365), stk: S.g('stk'), lub: S.g('lub'), equipos: S.g('eq'), neu: {}, desgaste: [], plazoFn: plazoEntregaCompras(S.g('comprasDetalle')).para }); return r.filtros[0]; }, SEMBRAR);
  expect(filas.necesidad.anio).toBeGreaterThan(filas.necesidad.semestre);
  expect(filas.comprar.mes).toBe(0);
  expect(filas.plazo.dias).toBe(12);                   // mediana real de las 40 OC sembradas, no 34
  expect(filas.pedirAntes.dias).toBe(filas.quiebreDias - 12);
  expect(filas.comprar.anio).toBe(filas.necesidad.anio - 6);
});

test('Stock Filtros: el plan de reposición usa el plazo real y muestra «pedir antes de» con la fecha y el peor caso', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const texto = await page.evaluate(async (sem) => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    eval(sem);
    window._sembrarCompras(); go('stk2');
    // la carga de fondo simulada vacía los datos sembrados: se fijan los de esta prueba delante del store
    const fijos = {};
    for (const c of ['eq', 'pau', 'stk', 'lub', 'mapaRep', 'neu', 'ot', 'comprasDetalle']) fijos[c] = S.g(c);
    fijos.stk = [{ ...fijos.stk[0], stockBodega: 3, pendiente: 0 }];   // alcanza para el primer PM pero no para el segundo: entra al plan
    const gOrig = S.g.bind(S);
    S.g = (c) => (c in fijos ? fijos[c] : gOrig(c));
    let t = '';
    for (let k = 0; k < 60; k++) {
      if (typeof renders.stk === 'function' && document.getElementById('s-stk')) renders.stk();
      await esp(80);
      t = (document.getElementById('s-stk') || {}).innerText || '';
      if (/pedir antes de/i.test(t) && /peor caso/.test(t)) break;
    }
    return t;
  }, SEMBRAR);
  expect(texto).toMatch(/pedir antes de/i);
  expect(texto).toMatch(/peor caso/);
});
