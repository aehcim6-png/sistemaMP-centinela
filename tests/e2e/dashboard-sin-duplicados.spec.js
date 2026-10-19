const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Dashboard: los números de la barra de arriba (Equipos, Urgentes, Próximas, Al Día) no se repiten como tarjetas, y «Flota sin falla»
// no dice 100 % cuando no hay correctivos cargados en el mes (sin datos no es sin fallas).
test('el dashboard no repite la barra de arriba y no inventa 100 % sin falla', async ({ page }) => {
  test.setTimeout(90000);
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });

  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const iso = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const eq = [{ sigla: 'ZZ-1', tipo: 'Camion', modelo: 'X', horomActual: 1000, frecPM: 250 }, { sigla: 'ZZ-2', tipo: 'Camion', modelo: 'X', horomActual: 2000, frecPM: 250 }];
    const ot = [{ _id: 'u', sigla: 'ZZ-1', tipo: 'Correctivo', fecha: iso(120), fechaEntrada: iso(120), fechaSalida: iso(119), estadoOT: 'Cerrada', sintoma: 'falla' }];
    let texto = '';
    for (let k = 0; k < 8; k++) {
      S.s('eq', eq); S.s('ot', ot); await esp(400);
      go('dash'); renders.dash && renders.dash(); await esp(900);
      texto = document.getElementById('s-dash') ? document.getElementById('s-dash').innerText : '';
      if (/flota sin falla/i.test(texto)) break;
    }
    return { texto, tarjetasKpi: document.querySelectorAll('#s-dash .kpi-row > *').length };
  });
  expect(r.texto).toMatch(/flota sin falla/i);
  expect(r.texto).toContain('Sin datos');                       // en vez de «100%»
  expect(r.texto).toMatch(/último correctivo cargado es del/i);  // aviso de datos atrasados
  expect(r.tarjetasKpi).toBe(2);                                 // Disponibilidad e Índice de salud; Urgentes y Próximas ya están arriba
  expect(r.texto).not.toMatch(/\n\s*FLOTA\s*\n/);                // la tarjeta «Flota 36» ya está en la barra de arriba
});
