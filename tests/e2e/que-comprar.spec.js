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
    for (let k = 0; k < 12; k++) {
      window._sembrarCompras(); window.queComprar(); await esp(400);
      t = document.body.innerText;
      if (/Qué comprar — próximo mes/.test(t)) break;
    }
    return t;
  }, SEMBRAR);
  expect(texto).toContain('Qué comprar — próximo mes, semestre y año');
  expect(texto).toContain('Filtro aceite');
  expect(texto).toContain('LF9009');
  expect(texto).toMatch(/PM programados/);
  expect(texto).toMatch(/horómetro sin actualizar hace más de 30 días/);
  // 1 equipo, 10 h/día, PM cada 250 h desde 1.000 h: 2 filtros por PM, hay 4 + 2 pendientes
  const filas = await page.evaluate((sem) => { eval(sem); window._sembrarCompras(); const r = planCompras({ hoy: new Date(), demanda: demandaPlanificadaPM(S.g('eq'), getPautasConsumo, S.g('stk'), S.g('lub'), S.g('mapaRep'), new Date(), 365), stk: S.g('stk'), lub: S.g('lub'), equipos: S.g('eq'), neu: {}, desgaste: [] }); return r.filtros[0]; }, SEMBRAR);
  expect(filas.necesidad.anio).toBeGreaterThan(filas.necesidad.semestre);
  expect(filas.comprar.mes).toBe(0);
  expect(filas.comprar.anio).toBe(filas.necesidad.anio - 6);
});
