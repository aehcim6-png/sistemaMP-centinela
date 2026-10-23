const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Auditoría de Datos → Limpieza asistida de horómetros (24-oct-2026). Es una revisión con reglas (sin IA externa): propone, la persona marca y confirma. Corregir deja el valor original en «origen»;
// eliminar manda la fila a la Papelera; el horómetro actual del equipo no cambia.
async function entrar(page, role) {
  await mockSupabase(page, { loginOk: true, role: role || 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 900 });
}

const DATOS = `
  window._sembrarLimp = () => {
    const f = (sigla, id, fecha, v) => ({ _id: id, sigla, fecha, horomFin: v, horom: v });
    S.s('eq', [{ sigla: 'ZZ-1', tipo: 'Camion', modelo: 'X', hrsDia: 16, horomActual: 14134, fechaHorom: '2026-02-14' }, { sigla: 'ZZ-2', tipo: 'Camion', modelo: 'X', hrsDia: 16, horomActual: 20000, fechaHorom: '2026-02-12' }]);
    S.s('hist', [
      f('ZZ-1', 'a1', '2026-02-09', 14082), f('ZZ-1', 'a2', '2026-02-10', 1492), f('ZZ-1', 'a3', '2026-02-10', 14100), f('ZZ-1', 'a4', '2026-02-11', 14112),
      f('ZZ-1', 'c1', '2026-01-01', 0), f('ZZ-1', 'c2', '2026-01-02', 0),
      f('ZZ-1', 'x1', '2026-02-12', 14125), f('ZZ-1', 'x2', '2026-02-13', 99999), f('ZZ-1', 'x3', '2026-02-14', 14134),
      f('ZZ-2', 'b1', '2026-02-10', 20000), f('ZZ-2', 'b2', '2026-02-11', 20015), f('ZZ-2', 'b3', '2026-02-12', 20030),
    ]);
  };
`;

async function abrirAuditoria(page) {
  await page.evaluate(async (datos) => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    eval(datos);
    window._sembrarLimp(); go('audit');
    for (let i = 0; i < 100 && (typeof renders.audit !== 'function' || !document.getElementById('s-audit')); i++) await esp(100);
    for (let k = 0; k < 12; k++) {
      window._sembrarLimp(); renders.audit(); await esp(400);
      if (document.getElementById('limpHorom')) break;
    }
  }, DATOS);
}

test('revisar propone, y nada cambia hasta marcar y confirmar; corregir deja el valor original anotado', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  page.on('dialog', (d) => d.accept());
  await abrirAuditoria(page);
  await page.evaluate(() => { window._sembrarLimp(); window.limpHoromRevisar(); });
  const bloque = page.locator('#limpHorom');
  await expect(bloque).toContainText('Eliminar los 2 ceros', { timeout: 10000 });
  await expect(bloque).toContainText('Propuestas (2)');
  await expect(bloque).toContainText('Corregir a 14092');
  await expect(bloque).toContainText('Eliminar');
  // revisar no cambia nada
  expect(await page.evaluate(() => (S.g('hist') || []).length)).toBe(12);
  expect(await page.evaluate(() => (S.g('hist') || []).find((h) => h._id === 'a2').horomFin)).toBe(1492);
  // marcar las de confianza alta y aplicar
  await page.evaluate(() => { window.limpHoromMarcarAltas(); });
  await expect(bloque).toContainText('Aplicar las marcadas (1)');
  const r = await page.evaluate(() => {
    window.limpHoromAplicar();
    const h = S.g('hist') || [];
    const a2 = h.find((x) => x._id === 'a2');
    return { n: h.length, valor: a2.horomFin, horom: a2.horom, origen: a2.origen, x2: !!h.find((x) => x._id === 'x2'), eq: S.g('eq').map((e) => e.horomActual) };
  });
  expect(r.valor).toBe(14092);
  expect(r.horom).toBe(14092);
  expect(r.origen).toBe('corregida en limpieza (antes 1492)');
  expect(r.x2).toBe(true);   // la de 99999 no estaba marcada: sigue ahí
  expect(r.n).toBe(12);
  expect(r.eq).toEqual([14134, 20000]);   // el horómetro actual de los equipos no cambia
});

test('eliminar lo marcado manda la fila a la Papelera; eliminar los ceros pide confirmación', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  const dialogos = [];
  page.on('dialog', (d) => { dialogos.push(d.message()); d.accept(); });
  await abrirAuditoria(page);
  await page.evaluate(() => { window._sembrarLimp(); window.limpHoromRevisar(); });
  await expect(page.locator('#limpHorom')).toContainText('Propuestas (2)', { timeout: 10000 });
  const r = await page.evaluate(() => {
    window._sembrarLimp(); window.limpHoromRevisar();
    // marca solo la propuesta «Eliminar» (la de 99999) y aplica
    const props = (window._limpHorom.diag.equipos.find((e) => e.sigla === 'ZZ-1').propuestas).filter((p) => p.tipo === 'descartar');
    window.limpHoromMarcar(window._limpHorom.diag.equipos.flatMap((e) => e.propuestas).filter((p) => p.tipo !== 'sin_dato').findIndex((p) => p.tipo === 'descartar'));
    window.limpHoromAplicar();
    const h = S.g('hist') || [];
    return { descartables: props.length, hay99999: !!h.find((x) => x._id === 'x2'), n: h.length, papelera: JSON.stringify(S.g('papelera') || []).includes('x2') };
  });
  expect(r.descartables).toBe(1);
  expect(r.hay99999).toBe(false);
  expect(r.n).toBe(11);
  expect(r.papelera).toBe(true);   // la fila eliminada quedó en la Papelera (30 días)
  expect(dialogos.some((m) => /eliminar 1/.test(m) && /Papelera/.test(m))).toBe(true);
  // los ceros
  const z = await page.evaluate(() => { window.limpHoromEliminarCeros(); return (S.g('hist') || []).filter((h) => h.horomFin === 0).length; });
  expect(z).toBe(0);
  expect(dialogos.some((m) => /2 lectura\(s\) con valor 0/.test(m))).toBe(true);
});

test('un usuario que no es administrador no ve la limpieza', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page, 'operador');
  await abrirAuditoria(page).catch(() => {});
  await page.evaluate(async () => { const esp = (ms) => new Promise((x) => setTimeout(x, ms)); go('audit'); await esp(1500); });
  const texto = await page.evaluate(() => (document.getElementById('s-audit') || {}).innerText || '');
  expect(texto).toContain('Auditoría de Datos');
  expect(texto).not.toContain('Limpieza asistida de horómetros');
});
