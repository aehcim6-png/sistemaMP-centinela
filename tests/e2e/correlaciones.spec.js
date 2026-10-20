const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Correlaciones (Spearman): matriz de metales en Aceite, tabla entre indicadores en Estadística y entre señales en Predictivo.
test('muestra las correlaciones en Aceite, Estadística y Señal Unificada', async ({ page }) => {
  test.setTimeout(90000);   // con la carga en segundo plano y el equipo ocupado puede tardar
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });

  // ── Aceite: 14 muestras de MOTOR con hierro y cobre que suben juntos
  const ace = await page.evaluate(async () => {
    const m = [];
    for (let i = 0; i < 14; i++) m.push({ _id: 'a' + i, sigla: 'ZZ-1', equipo: 'ZZ-1', fecha: '2026-0' + (1 + (i % 9)) + '-10', componente: 'MOTOR', descriptor: '', hierro: 10 + i * 3, cobre: 2 + i, plomo: (i * 5) % 7, aluminio: 12 - (i % 5), silicio: i % 4, cromo: 1, estado: 'NORMAL' });
    S.s('aceite', m);
    go('ace');
    for (let i = 0; i < 100 && !document.getElementById('aceCorrHolder'); i++) await new Promise(r => setTimeout(r, 100));
    for (let i = 0; i < 50 && !document.querySelector('#aceCorrHolder table'); i++) await new Promise(r => setTimeout(r, 100));
    return document.getElementById('aceCorrHolder').innerText;
  });
  expect(ace).toContain('¿Qué metales suben juntos?');
  expect(ace).toContain('MOTOR (14 muestras)');
  expect(ace).toContain('Hierro ↔ Cobre (ρ 1');

  // ── Estadística (Mapa de equipos): se inyectan 10 equipos con indicadores
  const est = await page.evaluate(async () => {
    const claves = ['fallas1000', 'mttr', 'fsPct', 'uso', 'horom'];
    const filas = [];
    for (let i = 0; i < 10; i++) filas.push({ sigla: 'ZZ-' + i, tipo: 'Camion', modelo: 'X', motivo: '', vars: { fallas1000: i + (i % 3), mttr: 5 + i * 2, fsPct: 20 - i, uso: 8 + (i % 4), horom: 1000 + i * 500 } });
    window.pcaVariablesEquipos = () => ({ filas, variables: ['Fallas por 1.000 h', 'Horas por reparación', '% días fuera de servicio', 'Uso (h/día)', 'Horómetro (h)'], claves });
    S.s('eq', filas.map(f => ({ sigla: f.sigla, tipo: 'Camion', modelo: 'X' })));
    window._comp2Sub = 'estadistica'; window._estadisticaVista = 'pca';
    go('comp2');
    for (let i = 0; i < 100 && !document.getElementById('s-estadistica'); i++) await new Promise(r => setTimeout(r, 100));
    for (let i = 0; i < 100 && !/correlaciones/.test((document.getElementById('s-estadistica') || {}).innerText || ''); i++) await new Promise(r => setTimeout(r, 100));
    document.querySelectorAll('#s-estadistica details').forEach(d => { d.open = true; });
    return document.getElementById('s-estadistica').innerText;
  });
  expect(est).toContain('¿Qué indicadores se mueven juntos?');
  expect(est).toContain('Fallas por 1.000 h ↔ Horas por reparación');
  expect(est).toContain('10 equipos');

  // ── Predictivo → Señal Unificada de Reemplazo: el bloque aparece (con pocos equipos, avisa que no alcanza)
  const pred = await page.evaluate(async () => {
    window._comp2Sub = 'pred'; go('comp2');
    for (let i = 0; i < 100 && !document.getElementById('fPredVista'); i++) await new Promise(r => setTimeout(r, 100));
    // con datos reales de 8+ equipos el bloque dibuja la tabla: se simula el resultado para recorrer ese camino
    window.correlacionSenalesReemplazo = () => ({ nEquipos: 12, redundantes: [1], pares: [
      { a: 's1', b: 's2', nombreA: 'Weibull', nombreB: 'Edad Virtual', n: 12, ambas: 6, soloA: 0, soloB: 1, ninguna: 5, phi: 0.85, p: 0.002, pAjustado: 0.01, muestraChica: true, redundante: true },
      { a: 's1', b: 's3', nombreA: 'Weibull', nombreB: 'Costo', n: 12, ambas: 1, soloA: 5, soloB: 2, ninguna: 4, phi: null, p: null, pAjustado: null, muestraChica: true, redundante: false }] });
    window.alternarModoLab();   // la Señal Unificada vive en el modo laboratorio
    await new Promise(r => setTimeout(r, 600));
    const sel = document.getElementById('fPredVista'); sel.value = 'reemplazo'; renders.pred();
    for (let i = 0; i < 100 && !/correlación entre señales/.test(document.getElementById('s-pred').innerText); i++) await new Promise(r => setTimeout(r, 100));
    document.querySelectorAll('#s-pred details').forEach(d => { d.open = true; });
    return document.getElementById('s-pred').innerText;
  });
  expect(pred).toContain('¿Las 6 señales miden cosas distintas?');
  expect(pred).toContain('Weibull ↔ Edad Virtual');
  expect(pred).toContain('Redundantes: se encienden juntas');
  expect(pred).toContain('1 par(es) redundante(s)');
});
