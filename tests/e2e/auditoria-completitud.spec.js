const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Auditoría de Datos: completitud de los correctivos y prueba del diccionario de componentes con el historial.
test('Auditoría muestra la completitud de correctivos y la prueba del diccionario', async ({ page }) => {
  test.setTimeout(90000);   // con la carga en segundo plano y el equipo ocupado puede tardar
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });

  const texto = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const hoy = new Date().toISOString().slice(0, 10);
    const ot = [
      { _id: 'a', sigla: 'ZZ-1', tipo: 'Correctivo', fecha: hoy, sintoma: 'fuga de manguera', estadoOT: 'Cerrada', costo: 1000, componente: 'Mangueras/Fugas', causaRaiz: 'desgaste' },
      { _id: 'b', sigla: 'ZZ-1', tipo: 'Correctivo', fecha: hoy, sintoma: 'falla de turbo', estadoOT: 'Cerrada', costo: 0, componente: '', causaRaiz: '' },
    ];
    const hist = [];
    for (let i = 0; i < 20; i++) hist.push({ _id: 'h' + i, sigla: 'ZZ-1', fecha: '2023-01-01', descripcion: 'Control de neumáticos posición ' + (i % 6 + 1), sistema: 'Neumáticos' });
    for (let i = 0; i < 10; i++) hist.push({ _id: 'g' + i, sigla: 'ZZ-1', fecha: '2023-01-02', descripcion: 'Se realiza cambio de cuchillas', sistema: 'GET / Cuchillas' });
    for (let i = 0; i < 6; i++) hist.push({ _id: 'm' + i, sigla: 'ZZ-1', fecha: '2023-01-03', descripcion: 'mantención semanal', sistema: '' });
    const sembrar = () => { S.s('eq', [{ sigla: 'ZZ-1', tipo: 'Camion', modelo: 'X' }]); S.s('ot', ot); S.s('otHist', hist); };
    sembrar();
    go('audit');
    for (let i = 0; i < 100 && (typeof renders.audit !== 'function' || !document.getElementById('s-audit')); i++) await esp(100);   // el módulo se carga bajo demanda
    for (let k = 0; k < 12; k++) {
      sembrar(); await esp(600);
      renders.audit(); await esp(700);
      if (/diccionario que deduce el componente/i.test(document.getElementById('s-audit').innerText)) break;
    }
    return document.getElementById('s-audit').innerText;
  });
  expect(texto).toMatch(/completitud de los correctivos/i);
  expect(texto).toContain('Causa raíz');
  expect(texto).toContain('¿El diccionario que deduce el componente funciona con textos nuevos?');
  expect(texto).toMatch(/de las descripciones del historial recibe un componente/);
  expect(texto).toMatch(/coincide con el «sistema»/);
});
