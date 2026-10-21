const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Orden por prioridad (21-oct): Disponibilidad pone la tabla del período antes de las proyecciones (plegadas); Configuración agrupa
// sus tarjetas por tema sin perder ninguna ni sus ids; Auditoría muestra primero las revisiones con hallazgos y junta las que están en cero.
test('Disponibilidad, Configuración y Auditoría ordenan sus bloques por prioridad', async ({ page }) => {
  test.setTimeout(120000);
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
    const eq = [1, 2, 3].map((i) => ({ sigla: 'ZZ-' + i, tipo: 'Camion', modelo: 'X', horomActual: 1000 * i, frecPM: 250, fechaHorom: iso(2) }));
    const ot = [
      { _id: 'a', sigla: 'ZZ-1', tipo: 'Correctivo', fecha: iso(30), fechaEntrada: iso(30), fechaSalida: iso(29), estadoOT: 'Cerrada', sintoma: 'falla a', horom: 5000 },
      { _id: 'b', sigla: 'ZZ-1', tipo: 'Correctivo', fecha: iso(10), fechaEntrada: iso(10), fechaSalida: iso(9), estadoOT: 'Cerrada', sintoma: 'falla b', horom: 4200 },
    ];
    const abrir = async (id, hasta) => {
      for (let k = 0; k < 8; k++) {
        S.s('eq', eq); S.s('ot', ot); await esp(350); go(id); await esp(900);
        if (hasta()) return true;
      }
      return false;
    };
    const out = {};
    // Disponibilidad
    out.dispOk = await abrir('disp', () => !!document.querySelector('#s-disp .disp-avz'));
    const sd = document.getElementById('s-disp'), hijos = [...sd.children];
    const iTabla = hijos.findIndex((e) => e.querySelector && e.querySelector('table')), iAvz = hijos.findIndex((e) => e.classList.contains('disp-avz'));
    out.disp = { tablaAntes: iTabla >= 0 && iTabla < iAvz, avzCerrado: !sd.querySelector('.disp-avz').open, avzTexto: /Monte Carlo/.test(sd.querySelector('.disp-avz summary').textContent) };
    sd.querySelector('.disp-avz').open = true; await esp(200);
    renders.disp(); await esp(500);
    out.disp.recuerdaAbierto = document.querySelector('#s-disp .disp-avz').open;
    // Configuración
    out.cfgOk = await abrir('cfg', () => !!document.querySelector('#s-cfg .cfg-grupo'));
    const sc = document.getElementById('s-cfg');
    const tarjetas = [...sc.querySelectorAll('.cfg-grupo-body > .card')];
    out.cfg = { grupos: sc.querySelectorAll('.cfg-grupo').length, tarjetas: tarjetas.length, sueltas: [...sc.querySelectorAll('.card')].filter((c) => !c.closest('.cards') && !c.closest('.cfg-grupo')).length, mfa: !!document.getElementById('mfaCard'), primeroAbierto: sc.querySelector('.cfg-grupo').open, segundoCerrado: !sc.querySelectorAll('.cfg-grupo')[1].open, titulos: tarjetas.map((c) => c.querySelector('b').textContent.trim()) };
    sc.querySelectorAll('.cfg-grupo')[2].open = true; await esp(200);
    renders.cfg(); await esp(500);
    out.cfg.recuerdaGrupo = document.querySelectorAll('#s-cfg .cfg-grupo')[2].open;
    // Auditoría
    out.auditOk = await abrir('audit', () => !!document.querySelector('#s-audit .audit-ok'));
    const sa = document.getElementById('s-audit');
    const secs = [...sa.querySelectorAll('.audit-sec')];
    const dentro = [...sa.querySelectorAll('.audit-ok .audit-sec')].length;
    const iOk = [...sa.children].findIndex((e) => e.classList.contains('audit-ok'));
    const conHallazgo = [...sa.children].filter((e) => e.classList && e.classList.contains('audit-sec'));
    out.audit = { total: secs.length, dentro, conHallazgo: conHallazgo.length, okAlFinal: iOk === sa.children.length - 1, todasConHallazgosTienenN: conHallazgo.every((e) => +e.dataset.n > 0), todasOkEnCero: [...sa.querySelectorAll('.audit-ok .audit-sec')].every((e) => +e.dataset.n === 0), resumen: sa.querySelector('.audit-ok summary').textContent };
    return out;
  });
  expect(r.dispOk).toBe(true);
  expect(r.disp.tablaAntes).toBe(true);        // la tabla del período va antes de las proyecciones
  expect(r.disp.avzCerrado).toBe(true);        // y las proyecciones vienen plegadas
  expect(r.disp.avzTexto).toBe(true);
  expect(r.disp.recuerdaAbierto).toBe(true);   // al cambiar un filtro no se vuelven a cerrar

  expect(r.cfgOk).toBe(true);
  expect(r.cfg.grupos).toBeGreaterThanOrEqual(6);
  expect(r.cfg.sueltas).toBe(0);               // ninguna tarjeta quedó fuera de un grupo (no se pierde ninguna)
  expect(r.cfg.tarjetas).toBeGreaterThanOrEqual(15);
  expect(r.cfg.mfa).toBe(true);                // los ids siguen ahí (las tarjetas se mueven, no se recrean)
  expect(r.cfg.titulos.some((t) => /contraseña/i.test(t))).toBe(true);
  expect(r.cfg.titulos.some((t) => /Respaldo autom/i.test(t))).toBe(true);
  expect(r.cfg.primeroAbierto).toBe(true);     // «Mi cuenta» abierta, el resto plegado
  expect(r.cfg.segundoCerrado).toBe(true);
  expect(r.cfg.recuerdaGrupo).toBe(true);

  expect(r.auditOk).toBe(true);
  expect(r.audit.total).toBe(6);               // las seis revisiones siguen existiendo
  expect(r.audit.conHallazgo).toBeGreaterThanOrEqual(1);   // la de horómetros que retroceden (sembrada) va arriba
  expect(r.audit.conHallazgo + r.audit.dentro).toBe(6);
  expect(r.audit.todasConHallazgosTienenN).toBe(true);
  expect(r.audit.todasOkEnCero).toBe(true);
  expect(r.audit.okAlFinal).toBe(true);
  expect(r.audit.resumen).toMatch(/Controles sin hallazgos \(\d de 6\)/);
});
