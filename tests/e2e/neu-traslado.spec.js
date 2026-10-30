const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Traslado de un neumático montado a otro equipo (canibalización, PRO-MAN-004): pide causal, mueve el neumático con sus horas, deja el registro y la
// posición del donante aparece como pendiente de reponer.
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

test('trasladar un neumático montado a otro equipo deja donante, receptor y causal, y la posición vacía del donante', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  await page.evaluate(async () => { go('neu'); await new Promise((x) => setTimeout(x, 2500)); });
  // todo en un mismo turno, sin esperas: la carga en segundo plano (simulada vacía) pisaría lo sembrado
  const r = await page.evaluate(() => {
    S.s('eq', [{ sigla: 'AL-1', tipo: 'Camión Aljibe', modelo: 'Arocs', horomActual: 1000 }, { sigla: 'AL-2', tipo: 'Camión Aljibe', modelo: 'Arocs', horomActual: 5000 }]);
    S.s('ot', []); S.s('neuTras', []); S.s('sen', []);
    S.s('neu', [
      { id: 'n1', sigla: 'AL-1', serie: 'FUEGO-17', marca: 'MICHELIN', posicion: 'Trasera Izq', numPos: 3, estado: 'Operativo', horomInstalacion: 800, horasAcum: 0 },
      { id: 'n2', sigla: 'AL-1', serie: 'FUEGO-18', marca: 'MICHELIN', posicion: 'Delantera Der', numPos: 2, estado: 'Stock' },
    ]);
    const toasts = []; const t0 = window.toast; window.toast = (m) => toasts.push(String(m));
    const out = {};
    renderNeu();
    out.botones = document.querySelectorAll('#s-neu button[title="Pasar a otro equipo (canibalización)"]').length;
    out.cabecera = document.querySelector('#s-neu table tr').textContent;
    trasladarNeu(0);
    document.getElementById('trEq').value = 'AL-2';
    document.getElementById('trPos').value = 'Trasera Der';
    saveTrasladoNeu(0);
    out.sinCausal = toasts[toasts.length - 1];
    document.getElementById('trCausal').value = 'Proveedor sin stock';
    saveTrasladoNeu(0);
    const n = S.g('neu')[0];
    out.neu = { sigla: n.sigla, posicion: n.posicion, estado: n.estado, horasAcum: n.horasAcum, horasBase: n.horasBase, horomInstalacion: n.horomInstalacion };
    out.tras = S.g('neuTras').map((t) => ({ serie: t.serie, donante: t.donante, posicionDonante: t.posicionDonante, receptor: t.receptor, posicionReceptor: t.posicionReceptor, causal: t.causal }));
    out.ot = S.g('ot').map((o) => o.tipo + ' · ' + o.sintoma);
    out.toast = toasts[toasts.length - 1];
    verTrasladosNeu();
    out.listado = document.body.innerText.replace(/\s+/g, ' ');
    window.toast = t0;
    return out;
  });
  expect(r.botones).toBe(1);   // solo el montado; el de Stock no
  expect(r.cabecera).toContain('Serie / N° fuego');
  expect(r.sinCausal).toContain('Elige la causal');
  expect(r.neu).toEqual({ sigla: 'AL-2', posicion: 'Trasera Der', estado: 'Operativo', horasAcum: 200, horasBase: 200, horomInstalacion: 5000 });
  expect(r.tras).toEqual([{ serie: 'FUEGO-17', donante: 'AL-1', posicionDonante: 'Trasera Izq', receptor: 'AL-2', posicionReceptor: 'Trasera Der', causal: 'Proveedor sin stock' }]);
  expect(r.ot[0]).toContain('Reasignación de Neumático · Traslado desde AL-1 Trasera Izq (causal: Proveedor sin stock)');
  expect(r.toast).toContain('AL-1 Trasera Izq queda sin neumático');
  expect(r.listado).toContain('Posiciones del donante sin reponer (1)');
  expect(r.listado).toContain('Proveedor sin stock: 1');
});
