const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Stock & Insumos → Repuestos (6-nov-2026): un stock vacío es «⚪ sin contar» y no cuenta como rojo; un 0 escrito a mano sí es «🔴 sin stock».
async function entrar(page) {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 1000 });
}

test('Repuestos: sin contar vs sin stock, tarjeta, filtro y paso a color al escribir el stock', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    window.toast = () => {};
    go('stk2');
    for (let i = 0; i < 100 && typeof renders.stk2 !== 'function'; i++) await esp(100);
    const mem = {
      stk: [], lub: [], mov: [],
      repuestos: [
        { _id: 'a', componente: 'Turbo derecho', nParte: 'T-1', equipo: 'HD785-7', stockActual: null, stockMinimo: 2, precioUnit: 0 },
        { _id: 'b', componente: 'Alternador', nParte: 'A-1', equipo: 'HD785-7', stockActual: 0, stockMinimo: 2, precioUnit: 0 },
        { _id: 'c', componente: 'Correa', nParte: 'C-1', equipo: 'HD785-7', stockActual: 5, stockMinimo: 2, precioUnit: 0 },
      ],
    };
    const g = S.g.bind(S), s = S.s.bind(S);
    S.g = (k) => (k in mem ? mem[k] : g(k)); S.s = (k, v) => { if (k in mem) { mem[k] = v; return true; } return s(k, v); };
    const out = {};
    window._stk2Sub = 'rep'; await renders.stk2();
    for (let i = 0; i < 100 && !(document.getElementById('s-rep') || {}).innerText; i++) await esp(100);
    const txt = () => document.getElementById('s-rep').innerText;
    out.estados = mem.repuestos.map((x) => x.estado);
    out.tarjetas = txt();
    out.celdaVacia = document.querySelector('#s-rep tr:nth-child(2) td:nth-child(6) input').value;
    out.accionSinContar = [...document.querySelectorAll('#s-rep tr')].find((tr) => tr.querySelector('input') && tr.querySelector('input').value === 'Turbo derecho').innerText;
    // filtro «Sin contar»
    document.getElementById('fRepEst').value = 'gris'; await renders.rep();
    out.filas = [...document.querySelectorAll('#s-rep tr')].filter((tr) => tr.querySelector('input')).map((tr) => tr.querySelector('input').value);
    // escribir el stock contado: pasa a verde
    document.getElementById('fRepEst').value = '';
    edRep(0, 'stockActual', 8); await esp(100);
    out.trasContar = mem.repuestos[0].estado;
    // borrar el número lo devuelve a «sin contar»
    edRep(0, 'stockActual', null); await esp(100);
    out.trasBorrar = mem.repuestos[0].estado;
    return out;
  });
  expect(r.estados).toEqual(['⚪ SIN CONTAR', '🔴 SIN STOCK', '🟢 OK']);
  expect(r.tarjetas).toContain('Sin contar');
  expect(r.celdaVacia).toBe('');
  expect(r.accionSinContar).toContain('Contar stock');
  expect(r.accionSinContar).not.toContain('Comprar');
  expect(r.filas).toEqual(['Turbo derecho']);   // el filtro «Sin contar» deja solo ese ítem
  expect(r.trasContar).toBe('🟢 OK');
  expect(r.trasBorrar).toBe('⚪ SIN CONTAR');
});
